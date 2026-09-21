import type { Request, Response } from "express";
import httpStatus from "http-status";

import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { AuthService } from "./auth.service";

const isProduction = config.node_env === "production";

const cookieOptions = {
	httpOnly: true,
	secure: isProduction,
	sameSite: isProduction ? ("none" as const) : ("lax" as const),
	path: "/",
};

const accessTokenCookieOptions = {
	...cookieOptions,
	maxAge: 1000 * 60 * 60 * 24, // 1 day
};

const refreshTokenCookieOptions = {
	...cookieOptions,
	maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};


const registerClient = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	await AuthService.registerClient(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent to your email",
		data: null,
	});
});

const verifyClientEmail = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		const result = await AuthService.verifyClientEmail(payload);

		const {
			accessToken,
			refreshToken,
			user,
			client,
		} = result;

		res.cookie(
			"accessToken",
			accessToken,
			accessTokenCookieOptions,
		);

		res.cookie(
			"refreshToken",
			refreshToken,
			refreshTokenCookieOptions,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Email verified successfully",
			data: {
				accessToken,
				refreshToken,
				user,
				client,
			},
		});
	},
);


const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.loginUser(payload);

	const {
		accessToken,
		refreshToken,
	} = result;

	res.cookie(
		"accessToken",
		accessToken,
		accessTokenCookieOptions,
	);

	res.cookie(
		"refreshToken",
		refreshToken,
		refreshTokenCookieOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			accessToken,
			refreshToken,
		},
	});
});


const googleLogin = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		const result = await AuthService.googleLogin(payload);

		const {
			accessToken,
			refreshToken,
		} = result;

		res.cookie(
			"accessToken",
			accessToken,
			accessTokenCookieOptions,
		);

		res.cookie(
			"refreshToken",
			refreshToken,
			refreshTokenCookieOptions,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Google login successful",
			data: {
				accessToken,
				refreshToken,
			},
		});
	},
);



const getMe = catchAsync(async (req: Request, res: Response) => {
	if (!req.user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	const result = await AuthService.getMe(req.user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(
	async (req: Request, res: Response) => {
		const oldRefreshToken =
			req.cookies?.refreshToken;

		if (!oldRefreshToken) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Refresh token is missing",
			);
		}

		const result =
			await AuthService.refreshToken(
				oldRefreshToken,
			);

		const {
			accessToken,
			refreshToken: newRefreshToken,
		} = result;

		res.cookie(
			"accessToken",
			accessToken,
			accessTokenCookieOptions,
		);

		res.cookie(
			"refreshToken",
			newRefreshToken,
			refreshTokenCookieOptions,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "New tokens generated successfully",
			data: {
				accessToken,
				refreshToken: newRefreshToken,
			},
		});
	},
);


const forgotPassword = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		await AuthService.forgotPassword(payload);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Password reset OTP sent to your email",
			data: null,
		});
	},
);


const resetPassword = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		await AuthService.resetPassword(payload);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Password changed successfully",
			data: null,
		});
	},
);


const logoutUser = catchAsync(
	async (req: Request, res: Response) => {
		const refreshToken =
			req.cookies?.refreshToken;
		if (refreshToken) {
			await AuthService.logoutUser(
				refreshToken,
			);
		}
		res.clearCookie(
			"accessToken",
			cookieOptions,
		);

		res.clearCookie(
			"refreshToken",
			cookieOptions,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Logged out successfully",
			data: null,
		});
	},
);


export const AuthController = {
	registerClient,
	verifyClientEmail,
	loginUser,
	googleLogin,
	getMe,
	refreshToken,
	forgotPassword,
	resetPassword,
	logoutUser,
};

