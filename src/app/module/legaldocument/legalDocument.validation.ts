import { z } from "zod";
import { DocumentType } from "../../../../prisma/generated/prisma/enums";



export const CreateLegalDocumentValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Document Title Is Required")
    .max(200, "Document Title Cannot Exceed 200 Characters"),

  description: z
    .string()
    .max(5000, "Document Description Cannot Exceed 5000 Characters")
    .optional(),

  fileUrl: z
    .string()
    .url("File URL Must Be A Valid URL"),

  filePublicId: z
    .string()
    .min(1, "File Public Id Cannot Be Empty")
    .optional(),

  fileType: z
    .string()
    .min(1, "File Type Cannot Be Empty")
    .optional(),

  fileSize: z
    .number()
    .int("File Size Must Be An Integer")
    .positive("File Size Must Be Greater Than 0")
    .optional(),

  documentType: z.enum(DocumentType),

});

export const UpdateLegalDocumentValidationZodSchema = z.object({
  title: z
    .string()
    .min(1, "Document Title Cannot Be Empty")
    .max(200, "Document Title Cannot Exceed 200 Characters")
    .optional(),

  description: z
    .string()
    .max(5000, "Document Description Cannot Exceed 5000 Characters")
    .optional(),

  documentType: z
    .enum(DocumentType)
    .optional(),
});