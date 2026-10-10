import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { LawyerServices } from "./lawyer.service";

const applyAsLawyer = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as
		| {
				resume?: Express.Multer.File[];
				additionalFiles?: Express.Multer.File[];
		  }
		| undefined;

	const resume = files?.resume?.[0] ?? null;
	const additionalFiles = files?.additionalFiles ?? [];

	const result = await LawyerServices.applyAsLawyer(
		req.body,
		resume,
		additionalFiles,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Lawyer Application Submitted Successfully. Please Verify Your Email.",
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
	const result = await LawyerServices.updateLawyerProfile(
		req.body,
		req.user!,
		req.params.lawyerId as string | undefined,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lawyer Profile Updated Successfully",
		data: result,
	});
});

const updateLawyerStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await LawyerServices.updateLawyerStatus(
		req.params.lawyerId as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lawyer Status Updated Successfully",
		data: result,
	});
});

const deleteLawyer = catchAsync(async (req: Request, res: Response) => {
	const result = await LawyerServices.deleteLawyer(
		req.params.lawyerId as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lawyer Deleted Successfully",
		data: result,
	});
});

const suspendLawyer = catchAsync(async (req: Request, res: Response) => {
	const result = await LawyerServices.suspendLawyer(
		req.params.lawyerId as string,
		req.body.suspended,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: req.body.suspended
			? "Lawyer Suspended Successfully"
			: "Lawyer Unsuspended Successfully",
		data: result,
	});
});

const getLawyerDocuments = catchAsync(async (req: Request, res: Response) => {
	const result = await LawyerServices.getLawyerDocuments(
		req.params.lawyerId as string,
		req.user!,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lawyer Documents Retrieved Successfully",
		data: result,
	});
});

const updateLawyerDocuments = catchAsync(
	async (req: Request, res: Response) => {
		const files = req.files as
			| {
					resume?: Express.Multer.File[];
					additionalFiles?: Express.Multer.File[];
			  }
			| undefined;
		const result = await LawyerServices.updateLawyerDocuments(
			req.params.lawyerId as string,
			files?.resume?.[0] ?? null,
			files?.additionalFiles ?? [],
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Lawyer Documents Updated Successfully",
			data: result,
		});
	},
);

const deleteLawyerDocument = catchAsync(async (req: Request, res: Response) => {
	const result = await LawyerServices.deleteLawyerDocument(
		req.params.lawyerId as string,
		req.body,
		req.user!,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Lawyer Document Deleted Successfully",
		data: result,
	});
});

const getAvailableLawyerByTodaysSchedule = catchAsync(
	async (req: Request, res: Response) => {
		const { data, meta } =
			await LawyerServices.getAvailableLawyerByTodaysSchedule(req.query);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Today's Available Lawyers Retrieved Successfully",
			data,
			meta,
		});
	},
);

const getAllLawyersListPublic = catchAsync(
	async (req: Request, res: Response) => {
		const { data, meta } = await LawyerServices.getAllLawyersListPublic(
			req.query,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Lawyers Retrieved Successfully",
			data,
			meta,
		});
	},
);

const getSingleLawyerPublicProfile = catchAsync(
	async (req: Request, res: Response) => {
		const result = await LawyerServices.getSingleLawyerPublicProfile(
			req.params.lawyerId as string,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Lawyer Retrieved Successfully",
			data: result,
		});
	},
);

export const LawyerControllers = {
	applyAsLawyer,
	verifyLawyerEmail,
	approveLawyer,
	getAllLawyers,
	updateLawyerProfile,
	updateLawyerStatus,
	deleteLawyer,
	suspendLawyer,
	getLawyerDocuments,
	updateLawyerDocuments,
	deleteLawyerDocument,
	getAvailableLawyerByTodaysSchedule,
	getAllLawyersListPublic,
	getSingleLawyerPublicProfile,
};
