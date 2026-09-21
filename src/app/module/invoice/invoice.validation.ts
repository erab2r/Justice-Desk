
import { z } from "zod";
import { InvoiceStatus } from "../../../../prisma/generated/prisma/enums";

export const CreateInvoiceValidationZodSchema = z.object({
  amount: z
    .number({
      message: "Invoice Amount Is Required",
    })
    .positive("Invoice Amount Must Be Greater Than 0"),

  tax: z
    .number()
    .min(0, "Tax Cannot Be Negative")
    .optional(),

  currency: z
    .string()
    .min(1, "Currency Cannot Be Empty")
    .max(10, "Currency Cannot Exceed 10 Characters")
    .optional(),

  dueDate: z
    .coerce
    .date({
      message: "Due Date Must Be A Valid Date",
    })
    .optional(),

  description: z
    .string()
    .max(5000, "Invoice Description Cannot Exceed 5000 Characters")
    .optional(),

  caseId: z
    .string()
    .min(1, "Case Id Is Required"),

  clientId: z
    .string()
    .min(1, "Client Id Is Required"),

  lawyerId: z
    .string()
    .min(1, "Lawyer Id Is Required"),
});

export const UpdateInvoiceValidationZodSchema = z.object({
  amount: z
    .number()
    .positive("Invoice Amount Must Be Greater Than 0")
    .optional(),

  tax: z
    .number()
    .min(0, "Tax Cannot Be Negative")
    .optional(),

  currency: z
    .string()
    .min(1, "Currency Cannot Be Empty")
    .max(10, "Currency Cannot Exceed 10 Characters")
    .optional(),

  dueDate: z
    .coerce
    .date({
      message: "Due Date Must Be A Valid Date",
    })
    .optional(),

  description: z
    .string()
    .max(5000, "Invoice Description Cannot Exceed 5000 Characters")
    .optional(),
});

export const UpdateInvoiceStatusValidationZodSchema = z.object({
  status: z.enum(InvoiceStatus),
});

