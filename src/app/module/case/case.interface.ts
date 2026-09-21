import {
  CasePriority,
  CaseStatus,
} from "../../../../prisma/generated/prisma/enums";

export interface ICreateCasePayload {
  title: string;
  description?: string;
  caseType?: string;
  priority?: CasePriority;
  courtName?: string;
  courtCaseNumber?: string;
  filingDate?: string;
  lawyerId: string;
  appointmentId?: string;
}

export interface IUpdateCasePayload {
  title?: string;
  description?: string;
  caseType?: string;
  priority?: CasePriority;
  courtName?: string;
  courtCaseNumber?: string;
  filingDate?: string;
}

export interface IChangeCaseStatusPayload {
  status: CaseStatus;
}

export interface IAssignLawyerPayload {
  lawyerId: string;
}