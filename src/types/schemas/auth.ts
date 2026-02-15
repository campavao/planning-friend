import { z } from "zod";

export const verifyBodySchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  code: z.string().min(1, "Code is required"),
});

export const sendCodeBodySchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
});
