import { z } from "zod";
import {
	LawyerVerificationStatus,
	UserStatus,
} from "../../../../prisma/generated/prisma/enums";

export const ApplyAsLawyerValidationZodSchema = z.object({
	user: z.object({
		name: z.string().min(1, "Name Is Required"),
		email: z.string().email("A Valid Email Is Required"),
	}),

	lawyer: z
		.object({
			address: z.string().optional(),
			licenseNumber: z.string().min(1, "License Number Is Required"),
			qualifications: z.string().min(1, "Qualifications Are Required"),

			experienceYears: z.coerce
				.number()
				.int()
				.min(0, "Experience Years Must Be Positive"),
			bio: z.string().optional(),
			consultationFee: z.coerce.number().positive().optional(),
			contactNumber: z.string().optional(),
			specializationIds: z
				.array(z.string().min(1))
				.optional()
				.refine(
					(ids) => new Set(ids ?? []).size === (ids?.length ?? 0),
					"Specializations Cannot Be Duplicated",
				),
			newPracticeArea: z.string().trim().min(1).max(100).optional(),
		})
		.refine(
			(data) =>
				(data.specializationIds?.length ?? 0) > 0 || !!data.newPracticeArea,
			"At Least One Specialization Or New Practice Area Is Required",
		),
});

export const VerifyLawyerEmailValidationZodSchema = z.object({
	email: z.string().email("A Valid Email Is Required"),
	otp: z.string().length(6, "OTP Must Be 6 Digits"),
});

export const ApproveLawyerValidationZodSchema = z
	.object({
		lawyerId: z.string().min(1, "Lawyer ID Is Required"),
		verificationStatus: z.enum(LawyerVerificationStatus),
		rejectionReason: z.string().min(3).max(500).optional(),
	})
	.refine(
		(data) =>
			data.verificationStatus !== LawyerVerificationStatus.REJECTED ||
			!!data.rejectionReason,
		{
			message:
				"Rejection Reason Is Required When Rejecting A Lawyer Application",
			path: ["rejectionReason"],
		},
	);

export const UpdateLawyerProfileValidationZodSchema = z.object({
	address: z.string().optional(),
	bio: z.string().optional(),
	consultationFee: z.coerce.number().positive().optional(),
	contactNumber: z.string().optional(),
	qualifications: z.string().optional(),
	experienceYears: z.coerce.number().int().min(0).optional(),
	specializationIds: z.array(z.string().min(1)).min(1).optional(),
});

export const UpdateLawyerStatusValidationZodSchema = z.object({
	status: z.enum([UserStatus.ACTIVE, UserStatus.BLOCKED]),
});

export const SuspendLawyerValidationZodSchema = z.object({
	suspended: z.boolean(),
});

export const DeleteLawyerDocumentValidationZodSchema = z.object({
	documentType: z.enum(["resume", "additionalFile"]),
	publicId: z.string().min(1).optional(),
});
