import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { LegalDocumentServices } from "./legaldocument.service";


export const createLegalDocument = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.createLegalDocument(
      {
        ...req.body,
        caseId: req.params.caseId as string,
      },
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Legal Document Created Successfully",
      data: result,
    });
  },
);

export const getLegalDocumentById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.getLegalDocumentById(
      req.params.documentId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Legal Document Retrieved Successfully",
      data: result,
    });
  },
);

export const getDocumentsByCase = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.getDocumentsByCase(
      req.params.caseId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Legal Documents Retrieved Successfully",
      data: result,
    });
  },
);

export const getMyDocuments = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.getMyDocuments(
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My Legal Documents Retrieved Successfully",
      data: result,
    });
  },
);

export const updateLegalDocument = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.updateLegalDocument(
      req.params.documentId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Legal Document Updated Successfully",
      data: result,
    });
  },
);

export const deleteLegalDocument = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LegalDocumentServices.deleteLegalDocument(
      req.params.documentId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Legal Document Deleted Successfully",
      data: result,
    });
  },
);

export const LegalDocumentControllers = {
  createLegalDocument,
  getLegalDocumentById,
  getDocumentsByCase,
  getMyDocuments,
  updateLegalDocument,
  deleteLegalDocument,
};