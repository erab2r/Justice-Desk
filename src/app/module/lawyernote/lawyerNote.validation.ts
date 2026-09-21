import { z } from "zod";

export const CreateLawyerNoteValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Note Title Cannot Be Empty")
    .max(200, "Note Title Cannot Exceed 200 Characters")
    .optional(),

  content: z
    .string()
    .min(1, "Note Content Is Required")
    .max(10000, "Note Content Cannot Exceed 10000 Characters"),

  isPrivate: z
    .boolean()
    .optional(),

});

export const UpdateLawyerNoteValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Note Title Cannot Be Empty")
    .max(200, "Note Title Cannot Exceed 200 Characters")
    .optional(),

  content: z
    .string()
    .min(1, "Note Content Cannot Be Empty")
    .max(10000, "Note Content Cannot Exceed 10000 Characters")
    .optional(),

  isPrivate: z
    .boolean()
    .optional(),
});

