
import type { Request, Response } from "express";
import httpStatus from "http-status";

import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.file) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No profile image provided.",
			);
		}

		if (!req.user?.userId) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User authentication information is missing.",
			);
		}

		const result =
			await UserServices.uploadProfileImage(
				req.file.buffer,
				req.user.userId,
			);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Profile image uploaded successfully.",
			data: result,
		});
	},
);

export const UserController = {
	uploadProfileImage,
};
