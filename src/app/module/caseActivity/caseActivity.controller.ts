import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CaseActivityServices } from "./caseActivity.service";

const createCaseActivity = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseActivityServices.createCaseActivity(
    { ...req.body, caseId: req.params.caseId as string },
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Case Activity Logged Successfully",
    data: result,
  });
});

const getCaseActivities = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseActivityServices.getCaseActivities(
    req.params.caseId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Case Activities Retrieved Successfully",
    data: result,
  });
});

const getActivityById = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseActivityServices.getActivityById(
    req.params.activityId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Case Activity Retrieved Successfully",
    data: result,
  });
});

export const CaseActivityControllers = {
  createCaseActivity,
  getCaseActivities,
  getActivityById,
};