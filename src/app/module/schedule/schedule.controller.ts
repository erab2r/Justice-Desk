
import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleServices } from "./schedule.service";

const createSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.createSchedule(
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Schedule Created Successfully",
      data: result,
    });
  },
);

const updateSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.updateSchedule(
      req.params.scheduleId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Schedule Updated Successfully",
      data: result,
    });
  },
);

const updateScheduleStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.updateScheduleStatus(
      req.params.scheduleId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Schedule Published Successfully",
      data: result,
    });
  },
);

const deleteSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.deleteSchedule(
      req.params.scheduleId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Schedule Deleted Successfully",
      data: result,
    });
  },
);

const getMySchedules = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.getMySchedules(
      req.query,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My Schedules Retrieved Successfully",
      data: result,
    });
  },
);

const getAvailableSchedules = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.getAvailableSchedules(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Available Schedules Retrieved Successfully",
      data: result,
    });
  },
);

const getScheduleById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.getScheduleById(
      req.params.scheduleId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Schedule Retrieved Successfully",
      data: result,
    });
  },
);

const getAllSchedules = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.getAllSchedules(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All Schedules Retrieved Successfully",
      data: result,
    });
  },
);

const getTodaysSchedules = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ScheduleServices.getTodaysSchedules();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Today's Schedules Retrieved Successfully",
      data: result,
    });
  },
);

export const ScheduleControllers = {
  createSchedule,
  updateSchedule,
  updateScheduleStatus,
  deleteSchedule,
  getMySchedules,
  getAvailableSchedules,
  getScheduleById,
  getAllSchedules,
  getTodaysSchedules,
};

