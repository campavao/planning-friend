/**
 * Shortens an extracted duration for tight spots — a figure in a row of three,
 * a card's one meta line. Extraction writes them out in full ("15 minutes",
 * "Less than 10 minutes"), which wrapped the item page's Prep/Cook row and ate
 * most of a planner card's meta line.
 *
 * Only words are swapped; the numbers and anything unrecognised pass through
 * untouched, so an odd value reads as it was saved rather than mangled.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/^\s*(?:less than|under)\s+/i, "<"],
  [/^\s*(?:about|around|approx(?:imately|\.)?|roughly)\s+/i, "~"],
  [/\bhours?\b|\bhrs\b/gi, "hr"],
  [/\bminutes?\b|\bmins\b/gi, "min"],
  [/\bseconds?\b|\bsecs\b/gi, "sec"],
  [/\s+and\s+(?=\d)/gi, " "],
];

export function shortDuration(value: string): string {
  return REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value.trim()
  );
}
