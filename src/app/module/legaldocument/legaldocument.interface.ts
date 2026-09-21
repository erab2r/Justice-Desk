import { DocumentType } from "../../../../prisma/generated/prisma/enums";


export interface ICreateLegalDocumentPayload {
  title: string;
  description?: string;
  fileUrl: string;
  filePublicId?: string;
  fileType?: string;
  fileSize?: number;
  documentType: DocumentType;
  caseId: string;
  clientId?: string;
  lawyerId?: string;
}

export interface IUpdateLegalDocumentPayload {
  title?: string;
  description?: string;
  documentType?: DocumentType;
}