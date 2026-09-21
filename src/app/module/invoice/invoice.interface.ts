
import type { InvoiceStatus } from "../../../../prisma/generated/prisma/enums";

export interface ICreateInvoicePayload {
  amount: number;
  tax?: number;
  currency?: string;
  dueDate?: string;
  description?: string;
  caseId: string;
  clientId: string;
  lawyerId: string;
}

export interface IUpdateInvoicePayload {
  amount?: number;
  tax?: number;
  currency?: string;
  dueDate?: string;
  description?: string;
}

export interface IUpdateInvoiceStatusPayload {
  status: InvoiceStatus;
}

