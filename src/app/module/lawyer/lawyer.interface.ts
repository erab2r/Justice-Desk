import {
	LawyerVerificationStatus,
	UserStatus,
} from "../../../../prisma/generated/prisma/enums";

export interface IApplyAsLawyerPayload {
	user: {
		name: string;
		email: string;
	};

	lawyer: {
		address?: string;
		licenseNumber: string;
		qualifications: string;
		experienceYears: number;
		bio?: string;
		consultationFee?: number;
		contactNumber?: string;
		specializationIds: string[];
		newPracticeArea?: string;
	};
}

export interface IVerifyLawyerEmailPayload {
	email: string;
	otp: string;
}

export interface IApproveLawyerPayload {
	lawyerId: string;
	verificationStatus: LawyerVerificationStatus;
	rejectionReason?: string;
}

export interface IUpdateLawyerProfilePayload {
	address?: string;
	bio?: string;
	consultationFee?: number;
	contactNumber?: string;
	qualifications?: string;
	experienceYears?: number;
	specializationIds?: string[];
}

export interface IUpdateLawyerStatusPayload {
	status: Extract<UserStatus, "ACTIVE" | "BLOCKED">;
}

export interface ISubmitLawyerReviewPayload {
	rating: number;
	review_comment: string;
	user_id: string;
	lawyer_id: string;
}

export type LawyerDocumentType = "resume" | "additionalFile";
