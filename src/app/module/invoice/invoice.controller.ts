
import type { Request, Response } from "express";
import httpStatus from "http-status";


import { InvoiceServices } from "./invoice.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const createInvoice = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.createInvoice(
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Invoice Created Successfully",
      data: result,
    });
  },
);

const getInvoiceById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.getInvoiceById(
      req.params.invoiceId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Invoice Retrieved Successfully",
      data: result,
    });
  },
);

const getInvoicesByCase = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.getInvoicesByCase(
      req.params.caseId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Case Invoices Retrieved Successfully",
      data: result,
    });
  },
);

const getMyInvoices = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.getMyInvoices(
      req.query,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My Invoices Retrieved Successfully",
      data: result,
    });
  },
);

const getAllInvoices = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.getAllInvoices(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All Invoices Retrieved Successfully",
      data: result,
    });
  },
);

const updateInvoice = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.updateInvoice(
      req.params.invoiceId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Invoice Updated Successfully",
      data: result,
    });
  },
);

const updateInvoiceStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.updateInvoiceStatus(
      req.params.invoiceId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Invoice Status Updated Successfully",
      data: result,
    });
  },
);

const regenerateInvoicePdf = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.regenerateInvoicePdf(
      req.params.invoiceId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Invoice PDF Generated Successfully",
      data: result,
    });
  },
);

const deleteInvoice = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InvoiceServices.deleteInvoice(
      req.params.invoiceId as string, 
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Invoice Deleted Successfully",
      data: result,
    });
  },
);

export const InvoiceControllers = {
  createInvoice,
  getInvoiceById,
  getInvoicesByCase,
  getMyInvoices,
  getAllInvoices,
  updateInvoice,
  updateInvoiceStatus,
  regenerateInvoicePdf,
  deleteInvoice,
};

