import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.bookAppointment(payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Payment Initiated Successfully",
		data: result,
	});
});

const payAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.payAppointment(payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Payment Initiated Successfully",
		data: result,
	});
});

const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { redirectUrl } = await AppointmentServices.bookAppointmentCallback(
			req.query,
		);

		res.redirect(redirectUrl);
	},
);

/**
 * Stripe requires the RAW request body to verify the webhook signature.
 * This route must be mounted with `express.raw({ type: "application/json" })`
 * BEFORE the app's global `express.json()` middleware runs for this path
 * (or excluded from it) — otherwise req.body will already be a parsed
 * object instead of a Buffer and signature verification will fail.
 */
const stripeWebhookHandler = catchAsync(async (req: Request, res: Response) => {
	const signature = req.headers["stripe-signature"];
	console.log("[Stripe webhook] Request received", {
		method: req.method,
		path: req.originalUrl,
		hasSignature: typeof signature === "string" && signature.length > 0,
		bodyIsBuffer: Buffer.isBuffer(req.body),
		bodyLength: Buffer.isBuffer(req.body) ? req.body.length : undefined,
	});

	if (typeof signature !== "string" || !signature) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing Stripe signature. This endpoint must be called by Stripe, not the browser or Postman.",
		);
	}

	if (!Buffer.isBuffer(req.body)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Stripe webhook body must be raw. Ensure express.raw() runs before express.json().",
		);
	}

	const result = await AppointmentServices.stripeWebhookHandler(
		req.body,
		signature,
	);
	console.log("[Stripe webhook] Response sent", result);

	res.status(httpStatus.OK).json(result);
});

const stripeSuccessHandler = catchAsync(async (req: Request, res: Response) => {
	const sessionId = typeof req.query.session_id === "string"
		? req.query.session_id
		: undefined;

	if (!sessionId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Stripe Session Id Missing");
	}

	const result = await AppointmentServices.stripeSuccessHandler(sessionId);
	res.status(httpStatus.OK).json(result);
});

const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.cancelAppointment(payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Cancelled And Refunded Successfully",
		data: result,
	});
});

const updateAppointmentStatus = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId as string;
		const payload = req.body;
		const user = req.user!;

		const result = await AppointmentServices.updateAppointmentStatus(
			appointmentId,
			payload,
			user,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Appointment Status Updated Successfully",
			data: result,
		});
	},
);

const joinAppointment = catchAsync(async (req: Request, res: Response) => {
	const appointmentId = req.params.appointmentId as string;
	const user = req.user!;

	const result = await AppointmentServices.joinAppointment(
		appointmentId,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Joined Successfully",
		data: result,
	});
});

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const { data, meta } = await AppointmentServices.getMyAppointments(
		req.query,
		user,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointments Retrieved Successfully",
		data,
		meta,
	});
});

const getLawyerAppointments = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;

		const { data, meta } = await AppointmentServices.getLawyerAppointments(
			req.query,
			user,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Appointments Retrieved Successfully",
			data,
			meta,
		});
	},
);

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AppointmentServices.getAllAppointments(
		req.query,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointments Retrieved Successfully",
		data,
		meta,
	});
});

const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
	const appointmentId = req.params.appointmentId as string;
	const user = req.user!;

	const result = await AppointmentServices.getSingleAppointment(
		appointmentId,
		user,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Retrieved Successfully",
		data: result,
	});
});


export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	stripeWebhookHandler,
	stripeSuccessHandler,
	cancelAppointment,
	updateAppointmentStatus,
	joinAppointment,
	getMyAppointments,
	getLawyerAppointments,
	getAllAppointments,
	getSingleAppointment,
};