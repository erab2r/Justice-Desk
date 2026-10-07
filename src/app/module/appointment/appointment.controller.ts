import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentServices } from "./appointment.service";

const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};

		return entities[character] ?? character;
	});

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
	const sessionId =
		typeof req.query.session_id === "string" ? req.query.session_id : undefined;

	if (!sessionId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Stripe Session Id Missing");
	}

	const { paymentSuccessful } =
		await AppointmentServices.stripeSuccessHandler(sessionId);

	if (paymentSuccessful) {
		if (!config.frontend_url) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Frontend URL is not configured",
			);
		}

		const appointmentsUrl = `${config.frontend_url.replace(/\/+$/, "")}/client/appointments`;
		const escapedAppointmentsUrl = escapeHtml(appointmentsUrl);

		res
			.status(httpStatus.OK)
			.set("Cache-Control", "no-store")
			.type("html")
			.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="3;url=${escapedAppointmentsUrl}">
  <title>Payment successful</title>
  <style>
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f3f6fb;
      color: #182230;
      font-family: Arial, Helvetica, sans-serif;
    }
    main {
      width: min(100%, 460px);
      padding: 48px 36px;
      text-align: center;
      background: #fff;
      border: 1px solid #e5eaf1;
      border-radius: 20px;
      box-shadow: 0 18px 50px rgba(23, 43, 77, .10);
    }
    .success-icon {
      width: 76px;
      height: 76px;
      display: grid;
      place-items: center;
      margin: 0 auto 24px;
      border-radius: 50%;
      background: #e7f7ee;
      color: #16834b;
      font-size: 40px;
      font-weight: 700;
    }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0; color: #596579; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; color: #1769aa; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <div class="success-icon" aria-hidden="true">&#10003;</div>
    <h1>Payment successful</h1>
    <p>Your payment has been confirmed. You will be redirected to your appointments in 3 seconds.</p>
    <a href="${escapedAppointmentsUrl}">Go to my appointments</a>
  </main>
</body>
</html>`);
		return;
	}

	res
		.status(httpStatus.OK)
		.set("Cache-Control", "no-store")
		.type("html")
		.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment not completed</title>
  <style>
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #f3f6fb; color: #182230; font-family: Arial, Helvetica, sans-serif; }
    main { width: min(100%, 460px); padding: 48px 36px; text-align: center; background: #fff; border: 1px solid #e5eaf1; border-radius: 20px; box-shadow: 0 18px 50px rgba(23, 43, 77, .10); }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0; color: #596579; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>Payment not completed</h1>
    <p>We could not confirm your payment. Please return to your appointments and check its status.</p>
  </main>
</body>
</html>`);
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