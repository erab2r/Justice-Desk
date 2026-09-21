import { LawyerVerificationStatus } from "../../../../prisma/generated/prisma/enums";

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