import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";

import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";

import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterClientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";

import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../../prisma/generated/prisma/enums";



const createAuthTokens = (user: {
	id: string;
	name: string;
	email: string;
	role: Role;
}) => {
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};



const registerClient = async (
	payload: IRegisterClientPayload,
) => {
	const { name, password, client: clientData } = payload;

	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}
	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	const expirationSeconds = 5 * 60;

	const otpKey =
		`client-registration-otp:${email}`;

	const otpValue =
		crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(
		otpKey,
		otpValue,
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const clientRegistrationKey =
		`client-registration-data:${email}`;

	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		client: clientData,
	};

	await redisClient.set(
		clientRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);

	const templateData = {
		name,
		email,
		otp: otpValue,
		expirationMinutes: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(
		templatePath,
		templateData,
	);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Justice Desk - Email Verification",
		html,
	});

	return {
		message: "Verification OTP sent to your email",
	};
};

const verifyClientEmail = async (
	payload: IVerifyEmailPayload,
) => {
	const email = payload.email.trim().toLowerCase();
	const otp = payload.otp.trim();

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser) {
		if (existingUser.status === UserStatus.BLOCKED) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"User is blocked",
			);
		}

		if (
			existingUser.isDeleted ||
			existingUser.status === UserStatus.DELETED
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"User is deleted",
			);
		}

		if (existingUser.emailVerified) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Email already verified",
			);
		}
	}

	const otpKey =
		`client-registration-otp:${email}`;

	const redisOtp =
		await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired OTP",
		);
	}

	if (redisOtp !== otp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP does not match",
		);
	}       
	const clientRegistrationKey =
		`client-registration-data:${email}`;

	const redisClientData =
		await redisClient.get(
			clientRegistrationKey,
		);

	if (!redisClientData) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Registration data not found or expired",
		);
	}

	const clientPayload =
		JSON.parse(
			redisClientData,
		) as IRegisterClientPayload;

	let dateOfBirth: Date | null = null;

	if (clientPayload.client?.dateOfBirth) {
		const parsedDate =
			new Date(
				clientPayload.client.dateOfBirth,
			);

		if (Number.isNaN(parsedDate.getTime())) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Invalid date of birth",
			);
		}

		dateOfBirth = parsedDate;
	}

	const createdUser = await prisma.user.create({
		data: {
			name: clientPayload.name,
			email: email,
			password: clientPayload.password,

			role: Role.CLIENT,
			status: UserStatus.ACTIVE,

			emailVerified: true,

			client: {
				create: {
					name: clientPayload.name,
					email: email,

					contactNumber:
						clientPayload.client?.contactNumber,

					address:
						clientPayload.client?.address,

					gender:
						clientPayload.client?.gender,

					dateOfBirth,
				},
			},
		},

		omit: {
			password: true,
		},

		include: {
			client: true,
		},
	});

	await redisClient.del(otpKey);
	await redisClient.del(clientRegistrationKey);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/client-welcome-email.ejs",
	);

	const templateData = {
		name: createdUser.name,
	};

	const html = await ejs.renderFile(
		templatePath,
		templateData,
	);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject:
			"Welcome To Justice Desk - Lawyer Consultation & Case Management System",
		html,
	});

	const { client, ...user } = createdUser;

	const {
		accessToken,
		refreshToken,
	} = createAuthTokens(user);

	return {
		user,
		client,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (
	payload: ILoginUserPayload,
) => {
	// const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: {
			email,
		},
		omit: {
			password: false,
		},
	});

	if (!user) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User not found",
		);
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is blocked",
		);
	}

	if (
		user.isDeleted ||
		user.status === UserStatus.DELETED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is deleted",
		);
	}


	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email before logging in",
		);
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account is registered with Google. Please login with Google.",
		);
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Password authentication is not available for this account",
		);
	}

	const isPasswordMatched =
		await bcrypt.compare(
			payload.password,
			user.password,
		);

	if (!isPasswordMatched) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid credentials",
		);
	}

	const {
		accessToken,
		refreshToken,
	} = createAuthTokens(user);

	return {
		accessToken,
		refreshToken,
		user,
  		needPasswordChange: user.needPasswordChange,
	};
};

const getMe = async (
	user: IRequestUser,
) => {
	const existingUser =
		await prisma.user.findUnique({
			where: {
				id: user.userId,
			},

			omit: {
				password: true,
			},

			include: {
				client: true,

				lawyer: {
					include: {
						specializations: {
							include: {
								specialization: true,
							},
						},
					},
				},
			},
		});

	if (!existingUser) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User not found",
		);
	}

	if (
		existingUser.isDeleted ||
		existingUser.status === UserStatus.DELETED
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User account is deleted",
		);
	}

	if (
		existingUser.status === UserStatus.BLOCKED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User account is blocked",
		);
	}

	return existingUser;
};


const refreshToken = async (
	token: string,
) => {
	if (!token) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Refresh token is required",
		);
	}

	const verifiedRefreshToken =
		jwtUtils.verifyToken(
			token,
			config.jwt_refresh_secret,
		);

	if (
		!verifiedRefreshToken.success ||
		!verifiedRefreshToken.data
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired refresh token",
		);
	}

	const data =
		verifiedRefreshToken.data as JwtPayload;

	if (
		typeof data.userId !== "string" ||
		!data.userId
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid refresh token payload",
		);
	}

	const logoutKey =
		`revoked-refresh-token:${token}`;

	const isRevoked =
		await redisClient.get(logoutKey);

	if (isRevoked) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Refresh token has been revoked. Please login again.",
		);
	}

	const user = await prisma.user.findUnique({
		where: {
			id: data.userId,
		},
	});

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User not found",
		);
	}

	if (
		user.isDeleted ||
		user.status !== UserStatus.ACTIVE
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive",
		);
	}

	const {
		accessToken,
		refreshToken,
	} = createAuthTokens(user);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (
	payload: IGoogleLoginPayload,
) => {
	let googleIdTokenPayload:
		| TokenPayload
		| null
		| undefined = null;

	try {
		const ticket =
			await googleClient.verifyIdToken({
				idToken: payload.idToken,
				audience: config.google_client_id,
			});

		googleIdTokenPayload =
			ticket.getPayload();
	} catch (error) {
		console.error(
			"Google ID Token Verification Failed:",
			error,
		);

		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token",
		);
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token",
		);
	}

	if (!googleIdTokenPayload.sub) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Google user ID not found",
		);
	}

	if (!googleIdTokenPayload.email) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google email not found",
		);
	}

	if (!googleIdTokenPayload.name) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google user name not found",
		);
	}

	if (googleIdTokenPayload.email_verified !== true) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Google email is not verified",
		);
	}

	const email =
		googleIdTokenPayload.email
			.trim()
			.toLowerCase();

	const googleId =
		googleIdTokenPayload.sub;

	let user = await prisma.user.findUnique({
		where: {
			email,
		},
	});


	if (user) {

		if (
			user.status === UserStatus.BLOCKED
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"User is blocked",
			);
		}

		if (
			user.isDeleted ||
			user.status === UserStatus.DELETED
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"User is deleted",
			);
		}

		if (
			user.authProvider === AuthProvider.GOOGLE
		) {
			if (
				user.googleId &&
				user.googleId !== googleId
			) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Google account does not match this user",
				);
			}

			if (!user.googleId) {
				user =
					await prisma.user.update({
						where: {
							id: user.id,
						},
						data: {
							googleId,
						},
					});
			}
		}

		else if (
			user.authProvider ===
			AuthProvider.CREDENTIAL
		) {
			if (!user.emailVerified) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Please verify your email before using Google login",
				);
			}
			if (!user.googleId) {
				user =
					await prisma.user.update({
						where: {
							id: user.id,
						},
						data: {
							googleId,
						},
					});
			} else if (
				user.googleId !== googleId
			) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Google account does not match this user",
				);
			}
		}
	}

	if (!user) {
		user = await prisma.user.create({
			data: {
				name: googleIdTokenPayload.name,
				email,

				role: Role.CLIENT,

				googleId,
				authProvider:
					AuthProvider.GOOGLE,

				emailVerified: true,

				client: {
					create: {
						name: googleIdTokenPayload.name,
						email,
					},
				},
			},
		});

		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/client-welcome-email.ejs",
		);

		const templateData = {
			name: user.name,
		};

		const html = await ejs.renderFile(
			templatePath,
			templateData,
		);

		await transporter.sendMail({
			from: config.email_sender,
			to: user.email,
			subject:
				"Welcome To Justice Desk - Lawyer Consultation & Case Management System",
			html,
		});
	}

	if (
		user.status === UserStatus.BLOCKED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is blocked",
		);
	}

	if (
		user.isDeleted ||
		user.status === UserStatus.DELETED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is deleted",
		);
	}
	const {
		accessToken,
		refreshToken,
	} = createAuthTokens(user);

	return {
		accessToken,
		refreshToken,
	};
};

const forgotPassword = async (
	payload: IForgotPasswordPayload,
) => {
	const email =
		payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: {
			email,
		},
		omit: {
			password: false,
		},
	});

	if (!user) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User does not exist",
		);
	}

	if (
		user.status === UserStatus.BLOCKED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is blocked",
		);
	}

	if (
		user.isDeleted ||
		user.status === UserStatus.DELETED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is deleted",
		);
	}

	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email first",
		);
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account does not use password authentication",
		);
	}

	const otp =
		crypto.randomInt(100000, 1000000).toString();

	const key =
		`forgot-password-otp:${email}`;

	const expirationSeconds = 5 * 60;

	await redisClient.set(
		key,
		otp,
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password.ejs",
	);

	const templateData = {
		name: user.name,
		otp,
		expirationMinutes:
			expirationSeconds / 60,
	};

	const html = await ejs.renderFile(
		templatePath,
		templateData,
	);

	await transporter.sendMail({
		from: config.email_sender,
		to: user.email,
		subject:
			"Justice Desk - Forgot Password",
		html,
	});

	return {
		message:
			"Password reset OTP sent to your email",
	};
};
const resetPassword = async (
	payload: IResetPasswordPayload,
) => {
	const email =
		payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: {
			email,
		},
		omit: {
			password: false,
		},
	});

	if (!user) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User does not exist",
		);
	}

	if (
		user.status === UserStatus.BLOCKED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is blocked",
		);
	}

	if (
		user.isDeleted ||
		user.status === UserStatus.DELETED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User is deleted",
		);
	}

	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email first",
		);
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account does not use password authentication",
		);
	}

	const key =
		`forgot-password-otp:${email}`;

	const redisOtp =
		await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired OTP",
		);
	}

	if (redisOtp !== payload.otp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP does not match",
		);
	}

	const hashedNewPassword =
		await bcrypt.hash(
			payload.newPassword,
			Number(config.bcrypt_salt_rounds),
		);

	await prisma.user.update({
		where: {
			id: user.id,
		},

		data: {
			password: hashedNewPassword,
			needPasswordChange: false,
		},
	});

	await redisClient.del(key);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);

	const templateData = {
		name: user.name,
	};

	const html = await ejs.renderFile(
		templatePath,
		templateData,
	);

	await transporter.sendMail({
		from: config.email_sender,
		to: user.email,
		subject:
			"Justice Desk - Password Changed",
		html,
	});

	return {
		message: "Password reset successfully",
	};
};

const logoutUser = async (
	refreshToken: string,
) => {
	if (!refreshToken) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Refresh token is required",
		);
	}

	const verifiedRefreshToken =
		jwtUtils.verifyToken(
			refreshToken,
			config.jwt_refresh_secret,
		);

	if (
		!verifiedRefreshToken.success ||
		!verifiedRefreshToken.data
	) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid refresh token",
		);
	}

	const decoded =
		verifiedRefreshToken.data as JwtPayload;

	const currentTime =
		Math.floor(Date.now() / 1000);

	const remainingSeconds =
		decoded.exp
			? decoded.exp - currentTime
			: 0;

	if (remainingSeconds > 0) {
		const logoutKey =
			`revoked-refresh-token:${refreshToken}`;

		await redisClient.set(
			logoutKey,
			"true",
			{
				expiration: {
					type: "EX",
					value: remainingSeconds,
				},
			},
		);
	}

	return null;
};

export const AuthService = {
	registerClient,
	verifyClientEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
	logoutUser,
};


































