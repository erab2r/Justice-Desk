import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { VideoSessionServices } from "./videoSession.service";

const createVideoSession = catchAsync(async (req: Request, res: Response) => {
  const result = await VideoSessionServices.createVideoSession(
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Video Session Created Successfully",
    data: result,
  });
});

const startVideoSession = catchAsync(async (req: Request, res: Response) => {
  const result = await VideoSessionServices.startVideoSession(
    req.params.appointmentId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Video Session Started Successfully",
    data: result,
  });
});

const endVideoSession = catchAsync(async (req: Request, res: Response) => {
  const result = await VideoSessionServices.endVideoSession(
    req.params.appointmentId as string,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Video Session Ended Successfully",
    data: result,
  });
});

const getVideoSessionByAppointment = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VideoSessionServices.getVideoSessionByAppointment(
      req.params.appointmentId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Video Session Retrieved Successfully",
      data: result,
    });
  },
);

export const VideoSessionControllers = {
  createVideoSession,
  startVideoSession,
  endVideoSession,
  getVideoSessionByAppointment,
};