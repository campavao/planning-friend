import { z } from "zod";

/** Long enough for a real reflection, short enough not to be an essay upload. */
export const NOTE_BODY_MAX_LENGTH = 2000;

const noteBody = z
  .string()
  .trim()
  .min(1, "Note cannot be empty")
  .max(NOTE_BODY_MAX_LENGTH, `Note must be ${NOTE_BODY_MAX_LENGTH} characters or fewer`);

// Nullable as well as optional: clearing a rating is a real edit, distinct from
// leaving it untouched.
const rating = z
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5")
  .nullable()
  .optional();

export const createItemNoteBodySchema = z.object({
  body: noteBody,
  rating,
  planItemId: z.string().uuid().nullable().optional(),
});

export const updateItemNoteBodySchema = z
  .object({
    id: z.string().uuid(),
    body: noteBody.optional(),
    rating,
  })
  .refine((data) => data.body !== undefined || data.rating !== undefined, {
    message: "Nothing to update",
    path: ["body"],
  });

export type CreateItemNoteBody = z.infer<typeof createItemNoteBodySchema>;
export type UpdateItemNoteBody = z.infer<typeof updateItemNoteBodySchema>;
