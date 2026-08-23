/**
 * Drop extracted links that lead nowhere.
 *
 * The prompt now forbids constructing a URL out of a name, but a prompt is a
 * request, not a guarantee — and the failure is silent and confident: an event
 * called "The Great American Lobster Fest" came back with `lobsterfest.com`,
 * which has no DNS record at all. The real site, `americanlobsterfest.com`, was
 * the link in the account's bio. A tapped link that goes nowhere is worse than
 * a row that was never there, so the last thing before a save is a check that
 * the link resolves.
 *
 * **Conservative by construction.** Only two verdicts drop a link: the URL is
 * unusable, or the host says the page does not exist. A 403 from a CDN that
 * dislikes datacentre IPs, a rate limit, a 500, a slow response — all keep the
 * link, because none of them are evidence it is wrong, and dropping a good link
 * is the more expensive mistake.
 */

/** The fields an extraction can put a URL in. `amazon_link` is deliberately
 *  absent: it is a search URL the prompt builds on purpose, and it always
 *  resolves. */
const LINK_FIELDS = [
  "website",
  "ticket_link",
  "menu_link",
  "reservation_link",
  "booking_link",
  "purchase_link",
] as const;

const TIMEOUT_MS = 6000;

type Verdict = "ok" | "dead";

/**
 * Whether a URL is worth keeping.
 *
 * A throw here is usually DNS: the host does not exist. It can also be a
 * transient network fault, so the request is tried twice before a throw is
 * believed — the whole point is to be sure before removing something a reader
 * might have wanted.
 */
async function checkUrl(url: string): Promise<Verdict> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "dead";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "dead";
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(parsed.toString(), {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Some hosts serve a different — or no — response to an unnamed agent.
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; PlanningFriend/1.0)",
        },
      });
      // 404/410 are the host stating the page is not there. A 405 means it
      // dislikes HEAD, not that the page is missing.
      if (response.status === 404 || response.status === 410) return "dead";
      return "ok";
    } catch (error) {
      // A slow host is not a missing one, and waiting longer would not tell us
      // anything new — keep the link and stop.
      if ((error as Error | undefined)?.name === "TimeoutError") return "ok";
      // Anything else is connection-level, usually DNS. Try once more before
      // believing it, so a blip does not delete a link the reader wanted.
    }
  }

  return "dead";
}

/**
 * Return `data` with any dead link field removed.
 *
 * Returns the same object when nothing was dropped, so a caller can tell
 * whether the check changed anything, and every non-link key is carried
 * through untouched.
 */
export async function dropDeadLinks(
  data: Record<string, unknown>,
  context?: string
): Promise<Record<string, unknown>> {
  const candidates = LINK_FIELDS.filter(
    (field) => typeof data[field] === "string" && (data[field] as string).trim()
  );
  if (candidates.length === 0) return data;

  const verdicts = await Promise.all(
    candidates.map(async (field) => ({
      field,
      verdict: await checkUrl((data[field] as string).trim()),
    }))
  );

  const dead = verdicts.filter((v) => v.verdict === "dead");
  if (dead.length === 0) return data;

  const next = { ...data };
  for (const { field } of dead) {
    console.warn(
      `Dropping unreachable ${field} "${data[field] as string}"${
        context ? ` from ${context}` : ""
      }`
    );
    delete next[field];
  }
  return next;
}
