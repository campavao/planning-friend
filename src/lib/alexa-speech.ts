/**
 * Escape characters that would break SSML / XML parsing when user-provided
 * strings (recipe titles, locations, ingredients) are embedded in the
 * speech response. Alexa wraps our speech in <speak>...</speak> tags, so
 * raw "&", "<", ">" anywhere inside produce a malformed document and
 * Alexa responds with "there was a problem with the requested skill's
 * response".
 */
export function escapeSsml(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
