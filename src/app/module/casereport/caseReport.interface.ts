
export interface ICreateCaseReportPayload {
  title: string;
  summary?: string;
  reportUrl?: string;
  reportPublicId?: string;
  generatedById?: string;
  caseId: string;
}

export interface IUpdateCaseReportPayload {
  title?: string;
  summary?: string;
  reportUrl?: string;
  reportPublicId?: string;
}

