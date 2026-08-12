#!/usr/bin/env python3
"""
Extraction probe for PLA-15.

Runs yt-dlp metadata extraction (no download) against a fixed set of URLs and
emits one JSON summary. The point is to measure *where* extraction is blocked,
not to extract anything useful — so run the same sample from a residential IP
and from Vercel egress and compare the `outcome` counts.

    python scripts/extraction-probe.py                  # default sample
    python scripts/extraction-probe.py url1 url2 ...    # explicit urls

Outcomes are deliberately coarse:
  ok           metadata came back
  unsupported  yt-dlp has no extractor for this URL shape (e.g. TikTok /photo/)
  blocked      the platform refused us — captcha, 403, rate limit, login wall
  unavailable  the post is gone/private; not a signal about our IP
  error        anything else, kept separate so it can't be mistaken for a block
"""

import json
import sys
import time

try:
    from yt_dlp import YoutubeDL
except ImportError:
    print(json.dumps({"error": "yt-dlp not installed: pip install yt-dlp"}))
    sys.exit(1)

# Real URLs from the saved collection, chosen to cover the shapes that matter.
DEFAULT_URLS = [
    "https://www.tiktok.com/t/ZTAE6Gv37",   # video
    "https://www.tiktok.com/t/ZTATBJWmS",   # video
    "https://www.tiktok.com/t/ZTAstH4ER",   # video (restaurant)
    "https://www.tiktok.com/t/ZTA366XM4",   # video
    "https://www.tiktok.com/t/ZTAnJP2uF",   # photo/slideshow — known to break today
    "https://www.instagram.com/p/C8QltIDRk_h/",  # instagram post
]

# Substrings that indicate the platform pushed back on *us*, as opposed to the
# content simply not existing. Kept explicit so a new failure mode shows up as
# "error" and gets looked at rather than silently counted as a block.
BLOCK_MARKERS = (
    "captcha",
    "rate limit",
    "rate-limit",
    "too many requests",
    "http error 403",
    "http error 429",
    "login required",
    "sign in",
    "requested content is not available",
    "blocked",
)
UNAVAILABLE_MARKERS = ("not available", "private", "removed", "deleted", "404")


def classify(err: str) -> str:
    e = err.lower()
    if "unsupported url" in e:
        return "unsupported"
    if any(m in e for m in BLOCK_MARKERS):
        return "blocked"
    if any(m in e for m in UNAVAILABLE_MARKERS):
        return "unavailable"
    return "error"


def probe(url: str) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noprogress": True,
        "socket_timeout": 30,
    }
    started = time.time()
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        entries = info.get("entries") or []
        return {
            "url": url,
            "outcome": "ok",
            "kind": info.get("_type") or "video",
            "formats": len(info.get("formats") or []),
            "images": len(entries),
            "duration": info.get("duration"),
            "title": (info.get("title") or "")[:60],
            "ms": round((time.time() - started) * 1000),
        }
    except Exception as exc:  # noqa: BLE001 — every failure is data here
        msg = str(exc)
        return {
            "url": url,
            "outcome": classify(msg),
            "error": msg[:200],
            "ms": round((time.time() - started) * 1000),
        }


def main() -> None:
    urls = sys.argv[1:] or DEFAULT_URLS
    results = []
    for u in urls:
        results.append(probe(u))
        time.sleep(1)  # be a good citizen; also avoids self-inflicted rate limits

    counts: dict[str, int] = {}
    for r in results:
        counts[r["outcome"]] = counts.get(r["outcome"], 0) + 1

    print(
        json.dumps(
            {
                "probed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "total": len(results),
                "counts": counts,
                "results": results,
            },
            indent=1,
        )
    )


if __name__ == "__main__":
    main()
