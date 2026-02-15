import { z } from "zod";

export const addPlanItemBodySchema = z.object({
  weekStart: z.string().optional(),
  contentId: z.string().uuid().optional().nullable(),
  noteTitle: z.string().optional().nullable(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  notes: z.string().optional().nullable(),
  plannedDate: z.string().datetime().optional(),
}).refine((data) => data.contentId != null || (data.noteTitle != null && data.noteTitle !== ""), {
  message: "Either contentId or noteTitle is required",
  path: ["contentId"],
});

export const updatePlanItemBodySchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid().optional().nullable(),
  noteTitle: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  plannedDate: z.string().datetime(),
}).refine((data) => data.contentId != null || (data.noteTitle != null && data.noteTitle !== ""), {
  message: "Either contentId or noteTitle is required",
  path: ["contentId"],
});
