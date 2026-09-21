import { z } from "zod";

export const CreateCaseValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Case Title Is Required")
    .max(200, "Case Title Cannot Exceed 200 Characters"),

  description: z
    .string()
    .max(5000, "Case Description Cannot Exceed 5000 Characters")
    .optional(),

  caseType: z
    .string()
    .max(100, "Case Type Cannot Exceed 100 Characters")
    .optional(),

  priority: z
    .enum(
      ["LOW", "MEDIUM", "HIGH", "URGENT"],
      "Priority Must Be LOW, MEDIUM, HIGH Or URGENT",
    )
    .optional(),
 
  courtName: z
    .string()
    .max(200, "Court Name Cannot Exceed 200 Characters")
    .optional(),

  courtCaseNumber: z
    .string()
    .max(100, "Court Case Number Cannot Exceed 100 Characters")
    .optional(),

  filingDate: z
    .string()
    .datetime("Filing Date Must Be A Valid Date")
    .optional(),

  lawyerId: z
    .string()
    .min(1, "Lawyer Id Is Required"),

  appointmentId: z
    .string()
    .min(1, "Appointment Id Cannot Be Empty")
    .optional(),
});

export const UpdateCaseValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Case Title Cannot Be Empty")
    .max(200, "Case Title Cannot Exceed 200 Characters")
    .optional(),

  description: z
    .string()
    .max(5000, "Case Description Cannot Exceed 5000 Characters")
    .optional(),

  caseType: z
    .string()
    .max(100, "Case Type Cannot Exceed 100 Characters")
    .optional(),

  priority: z
    .enum(
      ["LOW", "MEDIUM", "HIGH", "URGENT"],
      "Priority Must Be LOW, MEDIUM, HIGH Or URGENT",
    )
    .optional(),

  courtName: z
    .string()
    .max(200, "Court Name Cannot Exceed 200 Characters")
    .optional(),

  courtCaseNumber: z
    .string()
    .max(100, "Court Case Number Cannot Exceed 100 Characters")
    .optional(),

  filingDate: z
    .string()
    .datetime("Filing Date Must Be A Valid Date")
    .optional(),
});

export const ChangeCaseStatusValidationZodSchema = z.object({
  status: z.enum(
    [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_CLIENT",
      "RESOLVED",
      "CLOSED",
    ],
    "Invalid Case Status",
  ),
});

export const AssignLawyerValidationZodSchema = z.object({
  lawyerId: z
    .string()
    .min(1, "Lawyer Id Is Required"),
});