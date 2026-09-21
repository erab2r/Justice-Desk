
import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CaseReportServices } from "./caseReport.service";



export const createCaseReport = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.createCaseReport(
      {
        ...req.body,
        caseId: req.params.caseId,
      },
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Case Report Created Successfully",
      data: result,
    });
  },
);

export const getCaseReportById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.getCaseReportById(
      req.params.reportId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Case Report Retrieved Successfully",
      data: result,
    });
  },
);

export const getCaseReports = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.getCaseReports(
      req.params.caseId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Case Reports Retrieved Successfully",
      data: result,
    });
  },
);

export const getMyReports = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.getMyReports(
      req.query,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My Case Reports Retrieved Successfully",
      data: result,
    });
  },
);

export const getAllReports = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.getAllReports(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All Case Reports Retrieved Successfully",
      data: result,
    });
  },
);

export const updateCaseReport = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.updateCaseReport(
      req.params.reportId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Case Report Updated Successfully",
      data: result,
    });
  },
);

export const deleteCaseReport = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CaseReportServices.deleteCaseReport(
      req.params.reportId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Case Report Deleted Successfully",
      data: result,
    });
  },
);

export const CaseReportControllers = {
  createCaseReport,
  getCaseReportById,
  getCaseReports,
  getMyReports,
  getAllReports,
  updateCaseReport,
  deleteCaseReport,
};

