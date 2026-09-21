import { z } from "zod";

export const CreateCaseMessageValidationZodSchema = z.object({
  content: z
    .string()
    .min(1, "Message Content Is Required")
    .max(5000, "Message Content Cannot Exceed 5000 Characters"),
});