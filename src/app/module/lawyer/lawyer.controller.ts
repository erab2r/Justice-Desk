import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { LawyerServices } from "./lawyer.service";

const applyAsLawyer = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as
    | { resume?: Express.Multer.File[]; additionalFiles?: Express.Multer.File[] }
    | undefined;

  const resume = files?.resume?.[0] ?? null;
  const additionalFiles = files?.additionalFiles ?? [];

  const result = await LawyerServices.applyAsLawyer(req.body, resume, additionalFiles);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Lawyer Application Submitted Successfully. Please Verify Your Email.",
    data: result,
  });
});

const verifyLawyerEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await LawyerServices.verifyLawyerEmail(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email Verified Successfully",
    data: result,
  });
});

const approveLawyer = catchAsync(async (req: Request, res: Response) => {
  const result = await LawyerServices.approveLawyer(req.body, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lawyer Application Reviewed Successfully",
    data: result,
  });
});

const getAllLawyers = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await LawyerServices.getAllLawyers(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lawyers Retrieved Successfully",
    data,
    meta,
  });
});

const updateLawyerProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await LawyerServices.updateLawyerProfile(req.body, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lawyer Profile Updated Successfully",
    data: result,
  });
});

const getAvailableLawyerByTodaysSchedule = catchAsync(
	async (req: Request, res: Response) => {
	

		const { data, meta } = await LawyerServices.getAvailableLawyerByTodaysSchedule(
			req.query
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Today's Available Lawyers Retrieved Successfully",
			data,
			meta,
		});
	},
);


const getAllLawyersListPublic = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await LawyerServices.getAllLawyersListPublic(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lawyers Retrieved Successfully",
    data,
    meta,
  });
});

const getSingleLawyerPublicProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await LawyerServices.getSingleLawyerPublicProfile(
    req.params.lawyerId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lawyer Retrieved Successfully",
    data: result,
  });
});

export const LawyerControllers = {
  applyAsLawyer,
  verifyLawyerEmail,
  approveLawyer,
  getAllLawyers,
  updateLawyerProfile,
  getAvailableLawyerByTodaysSchedule,
  getAllLawyersListPublic,
  getSingleLawyerPublicProfile,
};