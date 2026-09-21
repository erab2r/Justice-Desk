import { z } from "zod";

export const CreateVideoSessionValidationZodSchema = z.object({
  appointmentId: z.string().min(1, "Appointment Id Is Required"),
  provider: z.string().max(50).optional(),
  roomUrl: z.string().url("Room URL Must Be A Valid URL").optional(),
});