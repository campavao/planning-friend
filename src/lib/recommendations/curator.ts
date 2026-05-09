import { getGeminiClient } from "@/lib/gemini";
import type { ScoredCandidate } from "./scorer";

const CURATOR_TIMEOUT_MS = 6000;
const CURATOR_MODEL = "gemini-2.5-flash";

export interface CuratorPick {
  contentId: string;
  why: string | null;
}

export interface CuratorContext {
  weekStart: string;
  alreadyPlanned: Array<{ dayIndex: number; title: string; category: string }>;
  patternProfile: string;
  candidatesByDay: Record<number, ScoredCandidate[]>;
}

export interface CuratorResult {
  picks: Record<number, CuratorPick[]>;
  source: "ai" | "fallback";
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fallbackPicks(
  candidatesByDay: Record<number, ScoredCandidate[]>
): Record<number, CuratorPick[]> {
  const out: Record<number, CuratorPick[]> = {};
  for (const [dayStr, candidates] of Object.entries(candidatesByDay)) {
    const day = Number(dayStr);
    out[day] = candidates.slice(0, 3).map((c) => ({
      contentId: c.content.id,
      why: null,
    }));
  }
  return out;
}

function buildPrompt(ctx: CuratorContext): string {
  const planned = ctx.alreadyPlanned.length
    ? ctx.alreadyPlanned
        .map(
          (p) =>
            `  ${DAY_LABELS[p.dayIndex] ?? p.dayIndex}: { ${p.category}: "${p.title.replace(/"/g, "'")}" }`
        )
        .join("\n")
    : "  (nothing planned yet)";

  const candidates = Object.entries(ctx.candidatesByDay)
    .map(([dayStr, list]) => {
      const day = Number(dayStr);
      const itemLines = list
        .map((c) => {
          const tagStr = c.content.tags.map((t) => t.name).join(",") || "-";
          return `    - id=${c.content.id} | ${c.content.category} | "${c.content.title.replace(/"/g, "'")}" | tags=${tagStr}`;
        })
        .join("\n");
      return `  ${DAY_LABELS[day] ?? day} (dayIndex ${day}):\n${itemLines}`;
    })
    .join("\n");

  return [
    `Week of ${ctx.weekStart}.`,
    `Already planned:`,
    planned,
    `Pattern profile: ${ctx.patternProfile}`,
    `Empty days with candidates:`,
    candidates,
    ``,
    `Pick 2-3 items per empty dayIndex from the candidates above.`,
    `Prefer variety across the week. Don't reuse an id across days.`,
    `Avoid clashing with already-planned items.`,
    `Each "why" must be ≤8 words, grounded in the pattern profile or recency.`,
    `Return strict JSON, no markdown:`,
    `{ "<dayIndex>": [{"id":"<contentId>","why":"<≤8 words>"}], ... }`,
  ].join("\n");
}

function parseCuratorResponse(
  text: string,
  candidatesByDay: Record<number, ScoredCandidate[]>
): Record<number, CuratorPick[]> | null {
  const stripped = text
    .replace(/```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const out: Record<number, CuratorPick[]> = {};
  for (const [dayStr, value] of Object.entries(parsed as Record<string, unknown>)) {
    const day = Number(dayStr);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    const candidates = candidatesByDay[day];
    if (!candidates?.length) continue;
    const validIds = new Set(candidates.map((c) => c.content.id));

    if (!Array.isArray(value)) continue;
    const picks: CuratorPick[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const id = (entry as { id?: unknown }).id;
      const why = (entry as { why?: unknown }).why;
      if (typeof id !== "string" || !validIds.has(id)) continue;
      if (picks.some((p) => p.contentId === id)) continue;
      picks.push({
        contentId: id,
        why: typeof why === "string" && why.trim() ? why.trim() : null,
      });
      if (picks.length >= 3) break;
    }
    if (picks.length > 0) out[day] = picks;
  }
  return out;
}

export async function curate(ctx: CuratorContext): Promise<CuratorResult> {
  const eligibleDays = Object.entries(ctx.candidatesByDay).filter(
    ([, list]) => list.length > 0
  );
  if (eligibleDays.length === 0) {
    return { picks: {}, source: "fallback" };
  }

  let model;
  try {
    model = getGeminiClient().getGenerativeModel({
      model: CURATOR_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
  } catch (err) {
    console.warn("Curator: gemini client unavailable", err);
    return { picks: fallbackPicks(ctx.candidatesByDay), source: "fallback" };
  }

  const prompt = buildPrompt(ctx);
  const systemInstruction =
    "You curate weekly plan suggestions. Pick 2-3 items per day from the candidates I provide. Prefer variety across the week. Never invent items not in the candidate list. Return strict JSON only.";

  const generation = (async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    });
    return result.response.text();
  })();

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), CURATOR_TIMEOUT_MS)
  );

  let raw: string | null;
  try {
    raw = (await Promise.race([generation, timeout])) as string | null;
  } catch (err) {
    console.warn("Curator: gemini call failed", err);
    return { picks: fallbackPicks(ctx.candidatesByDay), source: "fallback" };
  }

  if (!raw) {
    console.warn("Curator: gemini call timed out after", CURATOR_TIMEOUT_MS, "ms");
    return { picks: fallbackPicks(ctx.candidatesByDay), source: "fallback" };
  }

  const parsed = parseCuratorResponse(raw, ctx.candidatesByDay);
  if (!parsed) {
    console.warn("Curator: failed to parse gemini response", raw.slice(0, 200));
    return { picks: fallbackPicks(ctx.candidatesByDay), source: "fallback" };
  }

  // Backfill any empty days with deterministic top-3.
  for (const [dayStr, candidates] of Object.entries(ctx.candidatesByDay)) {
    const day = Number(dayStr);
    if (!parsed[day] || parsed[day].length === 0) {
      parsed[day] = candidates.slice(0, 3).map((c) => ({
        contentId: c.content.id,
        why: null,
      }));
    }
  }

  return { picks: parsed, source: "ai" };
}

export const __test__ = { buildPrompt, parseCuratorResponse, fallbackPicks };
