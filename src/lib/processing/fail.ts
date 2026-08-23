import { getContentById, updateContent } from "@/lib/supabase";
import { hasSalvageableContent } from "./preserve";
import type { ProcessResult } from "./types";

/**
 * Record that a processing attempt failed, without taking the row down with it.
 *
 * Every failure path in the processors used to write its placeholder straight
 * over the row: `title: "Failed to process image"`, `data: { error }`, status
 * failed. On a first ingest that is exactly right — there was nothing there,
 * and the owner needs to see that it did not work.
 *
 * On a re-process it is destruction. The stored image 404s, or the analysis
 * comes back empty, and a saved item the owner has had for months becomes an
 * error message. The guard in `preserve.ts` was written for precisely these
 * strings — they are all in PLACEHOLDER_TITLES — but these call sites never
 * consulted it, because they return before there is any analysis to compare
 * against.
 *
 * So the check moves to the row instead of the result: if what is already
 * saved is worth keeping, keep it and just clear the "processing" flag the
 * reprocess route set on the way in. The caller still gets its error, so the
 * failure is still logged and still reported.
 */
export async function failProcessing(
  contentId: string,
  title: string,
  error: string
): Promise<ProcessResult> {
  let existing = null;
  try {
    existing = await getContentById(contentId);
  } catch {
    // A row we cannot read is a row we cannot judge. Fall through and write
    // the failure — the alternative is leaving it stuck in "processing".
  }

  if (hasSalvageableContent(existing)) {
    console.warn(
      `Preserving existing content ${contentId} after a failed reprocess: ${error}`
    );
    await updateContent(contentId, { status: "completed" });
    return { error };
  }

  await updateContent(contentId, {
    status: "failed",
    title,
    data: { error },
  });
  return { error };
}
