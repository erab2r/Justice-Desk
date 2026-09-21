export interface ICreateCaseActivityPayload {
  action: string;
  message?: string;
  metadata?: Record<string, unknown>;
  caseId: string;
}