import { z } from "zod";

export const CreateSpecializationValidationZodSchema = z.object({
  name: z
    .string()
    .min(1, "Specialization Name Is Required")
    .max(100, "Specialization Name Cannot Exceed 100 Characters"),

  description: z
    .string()
    .max(1000, "Specialization Description Cannot Exceed 1000 Characters")
    .optional(),
});

export const UpdateSpecializationValidationZodSchema = z.object({
  name: z
    .string()
    .min(1, "Specialization Name Cannot Be Empty")  
    .max(100, "Specialization Name Cannot Exceed 100 Characters")
    .optional(),  

  description: z
    .string()      
    .max(1000, "Specialization Description Cannot Exceed 1000 Characters")
    .optional(),
});
export const AssignSpecializationValidationZodSchema = z.object({
  specializationId: z
    .string()
    .min(1, "Specialization Id Is Required"),
});

export const ReviewSpecializationRequestValidationZodSchema = z
  .object({
    requestId: z.string().min(1, "Request Id Is Required"),
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().min(3).max(500).optional(),
  })
  .refine(
    (data) => data.status !== "REJECTED" || !!data.rejectionReason,
    {
      message: "Rejection Reason Is Required When Rejecting A Request",
      path: ["rejectionReason"],
    },
  );