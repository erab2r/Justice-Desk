import { z } from "zod";

export const CreateCaseActivityValidationZodSchema = z.object({
  action: z.string().min(1, "Action Is Required").max(100),
  message: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});