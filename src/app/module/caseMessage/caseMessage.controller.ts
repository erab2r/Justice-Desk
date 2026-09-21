import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CaseMessageServices } from "./caseMessage.service";


const createCaseMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseMessageServices.createCaseMessage(
    { ...req.body, caseId: req.params.caseId as string },
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message Sent Successfully",
    data: result,
  });
});

const getCaseMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseMessageServices.getCaseMessages(
    req.params.caseId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages Retrieved Successfully",
    data: result,
  });
});

const deleteCaseMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await CaseMessageServices.deleteCaseMessage(
    req.params.messageId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message Deleted Successfully",
    data: result,
  });
});

export const CaseMessageControllers = {
  createCaseMessage,
  getCaseMessages,
  deleteCaseMessage,
};