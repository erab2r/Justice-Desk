import { z } from "zod";

export const AnalyzeIntakeValidationSchema = z.object({
	prompt: z
		.string()
		.trim()
		.min(1, "Please describe your situation.")
		.max(12_000, "Situation description cannot exceed 12,000 characters."),
});

export const AnalyzeDocumentValidationSchema = z.object({
	documentName: z.string().trim().max(200).optional(),
	documentType: z.string().trim().max(100).optional(),
	documentText: z
		.string()
		.trim()
		.min(1, "Paste the document text you want reviewed.")
		.max(20_000, "Document text cannot exceed 20,000 characters."),
});
