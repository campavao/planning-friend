/**
 * The Gemini model every call in this app runs on.
 *
 * One constant rather than the four copies of the string this replaces: a
 * missed copy is invisible, because the call still works — it just quietly
 * keeps running on the old model.
 *
 * 3.x drops `temperature`, `top_p` and `top_k`, none of which this app ever
 * passed, and turns thinking on by default at the `medium` level. That is the
 * point of the upgrade for extraction, and a hazard anywhere on a clock: the
 * curator races a 6s timeout, so it asks for `low` explicitly.
 */
export const GEMINI_MODEL = "gemini-3.7-flash";
