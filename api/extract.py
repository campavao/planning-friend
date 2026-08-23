"""
Self-hosted TikTok extraction (PLA-15).

Replaces the RapidAPI dependency (`tiktok-video-no-watermark2`) with yt-dlp
running on our own Vercel egress. The spike measured this: 64 TikTok video
requests from `iad1` across four consecutive passes, zero blocked, zero rate
limited, byte-identical to a residential control. The premise the spike was
opened on — that datacenter IPs get challenged and we would need a Raspberry Pi
on a home connection — did not survive measurement.

Why Python here rather than Node: yt-dlp is the extractor, and its Node ports
lag it by months on exactly the sites that break most often. TikTok changes
shape often enough that being on the upstream project is the whole point.

## Why this serves bytes and not a URL

The first cut of this returned the direct CDN URL for the caller to fetch,
which is cheaper in every way and does not work. Measured against a real post:
yt-dlp downloads it in 1.9s, and the *same* URL fetched moments later returns
**403 — with yt-dlp's own headers replayed, with a browser user-agent, and with
no headers at all.** The URL is bound to the session that negotiated it, so
there is no header set the caller can send to make it work.

So `mode=video` downloads through yt-dlp and streams the bytes back. The cost
is real — the video crosses the wire twice — and it is the only thing that
works short of moving the whole processing pipeline into Python.

## Format choice

h264 is preferred over the smaller h265 variants even though it is roughly
twice the size (16.4 MB vs 7.25 MB on a representative post). These files are
handed to Gemini to watch, and h264 in mp4 is the universally decodable
combination; saving 9 MB is not worth a codec the reader may reject.

Not handled here, deliberately:
  - `/photo/` slideshows — yt-dlp has no extractor for them (PLA-16).
  - Age-gated posts — a login wall, not a block; fails the same anywhere.
Both come back as ok:false, and the Node fallback chain takes over.
"""

from http.server import BaseHTTPRequestHandler
import hmac
import json
import os
import re
import shutil
import tempfile
import time
import urllib.request
from urllib.parse import parse_qs, urlparse

try:
    from yt_dlp import YoutubeDL
except ImportError:  # pragma: no cover - surfaces as a 500 with a clear cause
    YoutubeDL = None

# The only hosts yt-dlp is ever pointed at. Without an allowlist this endpoint
# would fetch arbitrary URLs on request, which is an SSRF primitive wearing an
# extractor's clothes.
#
# Instagram is here because yt-dlp handles live reels directly: measured at 12
# formats including progressive mp4, downloaded through this same code path
# unchanged. The earlier belief that Instagram needed an authenticated session
# came from a probe sample that had been deleted — there is no login wall on a
# live post. Instagram *carousels* are still unsupported here, because those
# render client-side and need a browser.
ALLOWED_HOSTS = ("tiktok.com", "instagram.com")

# Mirrors MAX_VIDEO_SIZE_BYTES in src/lib/processing/social-processor.ts, which
# falls back to thumbnail analysis above this. Enforced here too so an oversized
# post is never pulled across the wire only to be discarded on arrival.
MAX_VIDEO_BYTES = 50 * 1024 * 1024

# Muxed only (`b`, not `bv*+ba`) — pairing separate streams needs ffmpeg, and
# silent video is worse for analysis than falling back to the thumbnail. The
# ladder is: h264 under the cap, any h264, anything under the cap, anything.
#
# Both `h264` and `avc` are matched because the codec string is the extractor's
# to choose: TikTok reports a bare "h264" here, while many sites report
# "avc1.640028". An earlier version tested only `avc` and silently selected the
# h265 stream on every TikTok post — the exact codec this is meant to avoid.
FORMAT_SELECTOR = (
    "b[vcodec^=h264][filesize<50M]/b[vcodec^=avc][filesize<50M]"
    "/b[vcodec^=h264]/b[vcodec^=avc]"
    "/b[filesize<50M]/b"
)

# Same coarse buckets the PLA-15 probe used, so production logs stay comparable
# with the spike's measurements. "blocked" is the one that matters: if it ever
# starts appearing, the hosting decision needs revisiting.
BLOCK_MARKERS = (
    "captcha",
    "rate limit",
    "rate-limit",
    "too many requests",
    "http error 403",
    "http error 429",
    "blocked",
)
LOGIN_MARKERS = ("log in", "login required", "sign in", "cookies")
UNAVAILABLE_MARKERS = ("not available", "private", "removed", "deleted", "404")


def classify(err: str) -> str:
    e = err.lower()
    if "unsupported url" in e:
        return "unsupported"
    # Login is checked before blocked: an age gate says "Log in for access",
    # which is a content restriction rather than a signal about our IP, and
    # conflating the two would make a block-rate alarm cry wolf.
    if any(m in e for m in LOGIN_MARKERS):
        return "login_required"
    if any(m in e for m in BLOCK_MARKERS):
        return "blocked"
    if any(m in e for m in UNAVAILABLE_MARKERS):
        return "unavailable"
    return "error"


def failure(exc: Exception, started: float) -> dict:
    message = str(exc)
    return {
        "ok": False,
        "outcome": classify(message),
        "error": message[:300],
        "ms": round((time.time() - started) * 1000),
    }


def has_muxed_format(info: dict) -> bool:
    for fmt in info.get("formats") or []:
        if fmt.get("acodec") == "none" or fmt.get("vcodec") == "none":
            continue
        if fmt.get("url") and str(fmt.get("protocol") or "").startswith("http"):
            return True
    return False


BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)

# Headers a TikTok photo CDN URL needs. Unlike the video CDN — whose URLs are
# bound to the session that negotiated them and 403 everyone else — these are
# fetchable by anyone who sends a referer, so the caller downloads them itself.
IMAGE_HEADERS = {"User-Agent": BROWSER_UA, "Referer": "https://www.tiktok.com/"}

# Enough to read a recipe off a carousel without sending Gemini forty photos.
MAX_IMAGES = 12

TIKTOK_PHOTO_RE = re.compile(r"/photo/(\d+)")


def tiktok_slideshow(url: str) -> dict | None:
    """
    The images of a TikTok photo post, via the embed endpoint.

    yt-dlp has no extractor for `/photo/` and the post page returns a
    bot-detected shell with no media payload — measured, along with oEmbed
    (HTTP 400) and `/api/item/detail/` (200 with an empty body). The **embed**
    endpoint is the exception, because it exists to be rendered inside other
    people's iframes, so TikTok has a reason to keep it servable. It carries
    the whole slideshow in a `__FRONTITY_CONNECT_STATE__` JSON blob.

    Returns None when this is not a photo post or the shape has changed, and
    the caller falls back exactly as before.
    """
    match = TIKTOK_PHOTO_RE.search(url)
    if not match:
        return None

    embed = f"https://www.tiktok.com/embed/v2/{match.group(1)}"
    request = urllib.request.Request(embed, headers={"User-Agent": BROWSER_UA})
    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", "ignore")

    blob = re.search(
        r'<script id="__FRONTITY_CONNECT_STATE__"[^>]*>(.*?)</script>', html, re.S
    )
    if not blob:
        return None

    state = json.loads(blob.group(1))

    # The payload is keyed by request path and has changed shape before, so
    # walk for the field rather than hard-coding a route through it.
    found: list[dict] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if "imagePostInfo" in node:
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(state)
    if not found:
        return None

    post = found[0]
    images = (post.get("imagePostInfo") or {}).get("displayImages") or []
    urls = [
        image["urlList"][0]
        for image in images
        if isinstance(image.get("urlList"), list) and image["urlList"]
    ]
    if not urls:
        return None

    author = None
    for node in found:
        infos = node.get("authorInfos") or {}
        author = infos.get("uniqueId") or infos.get("nickname")
        if author:
            break

    # The caption lives at itemInfos.text on the embed payload, not at `desc`
    # like the video extractor uses. It is frequently nothing but hashtags,
    # which is fine — on a slideshow the words are inside the images, and
    # reading them is the analysis step's job.
    caption = (post.get("itemInfos") or {}).get("text") or post.get("desc") or ""

    return {
        "images": urls[:MAX_IMAGES],
        "imageHeaders": IMAGE_HEADERS,
        "description": caption,
        "author": author,
    }


def extract_metadata(url: str) -> dict:
    started = time.time()
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noprogress": True,
        "socket_timeout": 30,
    }

    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:  # noqa: BLE001 — every failure is a documented outcome
        # A TikTok slideshow lands here as `unsupported`. It is not a failure,
        # just a post with no video in it, so try the images before giving up.
        try:
            slideshow = tiktok_slideshow(url)
        except Exception:  # noqa: BLE001 — a broken embed is not worse than none
            slideshow = None

        if slideshow:
            return {
                "ok": True,
                "hasVideo": False,
                "thumbnailUrl": slideshow["images"][0],
                "images": slideshow["images"],
                "imageHeaders": slideshow["imageHeaders"],
                "description": slideshow["description"],
                "author": slideshow["author"],
                "duration": None,
                "originalUrl": url,
                "ms": round((time.time() - started) * 1000),
            }

        return failure(exc, started)

    return {
        "ok": True,
        # Whether mode=video is worth attempting. The caller uses this to decide
        # between video analysis and the thumbnail path, so a false here costs
        # quality but never a failed save.
        "hasVideo": has_muxed_format(info),
        "thumbnailUrl": info.get("thumbnail"),
        # yt-dlp puts the caption in `description` for TikTok and falls back to
        # the title on posts that have none. This is the text Gemini reads when
        # there is no video, so an empty string here is a real loss of quality.
        "description": info.get("description") or info.get("title") or "",
        "author": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
        "duration": info.get("duration"),
        "originalUrl": info.get("webpage_url") or url,
        "ms": round((time.time() - started) * 1000),
    }


def download_video(url: str) -> tuple[bytes | None, dict | None]:
    """
    Returns (bytes, None) on success or (None, error_payload) on failure.

    Downloads into a temp directory rather than streaming, because yt-dlp writes
    files. mkdtemp honours TMPDIR, which is the writable /tmp on Vercel.
    """
    started = time.time()
    tmpdir = tempfile.mkdtemp()
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": 30,
        "format": FORMAT_SELECTOR,
        "outtmpl": os.path.join(tmpdir, "video.%(ext)s"),
    }

    try:
        with YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=True)

        written = [
            os.path.join(tmpdir, name)
            for name in os.listdir(tmpdir)
            if name.startswith("video.")
        ]
        if not written:
            return None, {"ok": False, "outcome": "error", "error": "no file written"}

        path = written[0]
        size = os.path.getsize(path)
        if size > MAX_VIDEO_BYTES:
            # Only reachable when every format reported an unknown size, since
            # the selector filters on filesize when it is known.
            return None, {
                "ok": False,
                "outcome": "too_large",
                "error": f"{size} bytes exceeds the {MAX_VIDEO_BYTES} cap",
            }

        with open(path, "rb") as handle:
            return handle.read(), None
    except Exception as exc:  # noqa: BLE001 — every failure is a documented outcome
        return None, failure(exc, started)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self._send_bytes(status, "application/json", body)

    def _send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        # Responses are per-post and large; caching them would fill the edge
        # with videos that are read exactly once, during processing.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 — name fixed by BaseHTTPRequestHandler
        secret = os.environ.get("EXTRACTOR_SECRET")
        # Fails closed. SSO protection on this project covers every domain
        # except the custom one, so this route is reachable from the internet
        # in production — without a secret set it would be an open extraction
        # service running on our compute.
        if not secret:
            self._send_json(500, {"ok": False, "error": "EXTRACTOR_SECRET is not set"})
            return

        provided = self.headers.get("x-extractor-secret") or ""
        if not hmac.compare_digest(provided, secret):
            self._send_json(401, {"ok": False, "error": "unauthorized"})
            return

        if YoutubeDL is None:
            self._send_json(500, {"ok": False, "error": "yt-dlp is not installed"})
            return

        params = parse_qs(urlparse(self.path).query)
        url = (params.get("url") or [""])[0].strip()
        mode = (params.get("mode") or ["meta"])[0]

        if not url:
            self._send_json(400, {"ok": False, "error": "missing url"})
            return

        parsed = urlparse(url)
        # Only ever point yt-dlp at the platform we mean to extract. Without
        # this the endpoint would fetch arbitrary URLs on request, which is an
        # SSRF primitive wearing an extractor's clothes.
        if parsed.scheme not in ("http", "https"):
            self._send_json(400, {"ok": False, "error": "unsupported scheme"})
            return
        host = (parsed.hostname or "").lower()
        if not any(
            host == domain or host.endswith("." + domain) for domain in ALLOWED_HOSTS
        ):
            self._send_json(400, {"ok": False, "error": "unsupported host"})
            return

        if mode == "video":
            body, error = download_video(url)
            if error is not None:
                self._send_json(200, error)
                return
            self._send_bytes(200, "video/mp4", body or b"")
            return

        self._send_json(200, extract_metadata(url))
