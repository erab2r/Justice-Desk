import { isBefore, subHours } from "date-fns";
import httpStatus from "http-status";
import type Stripe from "stripe";
import { Prisma } from "../../../../prisma/generated/prisma/client";

// import { ApppointmentWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import { IQuery } from "../../interfaces";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { createStripeCheckoutSession, finalizeConfirmedAppointment } from "./appointment.utils";
import { IBookAppointmentPayload, ICancelAppointmentPayload, IPayAppointmentPayload, IUpdateAppointmentStatusPayload } from "./appointment.interface";
import { AppointmentStatus, PaymentGateway, PaymentStatus, Role, ScheduleStatus } from "../../../../prisma/generated/prisma/enums";
import { AppointmentWhereInput } from "../../../../prisma/generated/prisma/models";

const getExistingPaymentUrl = (gatewayResponse: unknown): string | undefined => {
	if (!gatewayResponse || typeof gatewayResponse !== "object") {
		return undefined;
	}

	const response = gatewayResponse as Record<string, unknown>;
	const paymentUrl = response.url ?? response.bkashURL;

	return typeof paymentUrl === "string" ? paymentUrl : undefined;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
	JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const getAppointmentStatus = (
	status: string | undefined,
): AppointmentStatus | undefined => {
	if (
		status === AppointmentStatus.PENDING ||
		status === AppointmentStatus.CONFIRMED ||
		status === AppointmentStatus.CANCELLED ||
		status === AppointmentStatus.ONGOING ||
		status === AppointmentStatus.COMPLETED
	) {
		return status;
	}

	return undefined;
};

const bookAppointment = async (payload: IBookAppointmentPayload, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {

		const client = await tx.client.findUnique({
			where: { userId: user.userId },
		});

		if (!client) {
			throw new AppError(httpStatus.NOT_FOUND, "client Profile Not Found");
		}

		const schedule = await tx.schedule.findUnique({
			where: { id: payload.scheduleId },
			include: { lawyer: true },
		});

		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Is Not Published Yet",
			);
		}

		const now = new Date();

		if (!isBefore(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Has Already Started",
			);
		}
		const existingAppointment = await tx.appointment.findFirst({
			where : {
				clientId : client.id,
				scheduleId : schedule.id,
			}
		})

		if(existingAppointment?.status === AppointmentStatus.PENDING){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Pending Appointment. Please Pay For That")
		}
		if(existingAppointment?.status === AppointmentStatus.CONFIRMED){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Confirmed Appointment.")
		}
		if(existingAppointment?.status === AppointmentStatus.ONGOING){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have A Ongoing Appointment")
		}
		if(existingAppointment?.status === AppointmentStatus.COMPLETED){
			throw new AppError(httpStatus.BAD_REQUEST, "You Already Have Completed An Appointment On This Schedule. Please Try Again Another Day")
		}

		const bookedAppointments = await tx.appointment.count({
			where: {
				scheduleId: schedule.id,
				status: {
					in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
				},
			},
		});

		if (bookedAppointments >= schedule.totalSlots) {
			throw new AppError(httpStatus.BAD_REQUEST, "This Schedule Is Fully Booked");
		}

		if(!schedule.lawyer.consultationFee){
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Lawyer Has Not Set A Consultation Fee Yet",
			);
		}

		const amount = schedule.lawyer.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				clientId : client.id,
				lawyerId : schedule.lawyer.id,
				scheduleId : schedule.id,
				meetingLink: schedule.meetingLink,
			},
		});

		// ---- STRIPE (price created directly in BDT — no conversion) ----
		if (payload.paymentGateway === PaymentGateway.STRIPE) {
			const session = await createStripeCheckoutSession(
				appointment.id,
				schedule.lawyer.consultationFee.toString(),
				user.email,
			);

			await tx.payment.create({
				data: {
					merchantInvoiceNumber: appointment.id,
					appointmentId: appointment.id,
					amount,
					paymentGateway: PaymentGateway.STRIPE,
					stripeSessionId: session.id,
					payerReference: user.email,
					gatewayResponse: toJsonValue(session),
				},
			});

			return {
				paymentUrl: session.url,
			};
		}

		// ---- BKASH (default / unchanged) ----
		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
		}

		const bkashCreatePaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					mode: "0011",
					payerReference: user.email, 
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					amount: amount,
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: appointment.id,
				}),
			},
		);

		const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

		await tx.payment.create({
			data: {
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
				appointmentId: appointment.id,
				amount: amount,
				paymentGateway: PaymentGateway.BKASH,
				gatewayResponse: bkashCreatePaymentResult,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				payerReference: user.email,
			},
		});

		return {
			paymentUrl: bkashCreatePaymentResult.bkashURL,
		};
	}, {
		isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
		maxWait: 10000,
		timeout: 30000,
	});

	return transactionResult;
};

const payAppointment = async (payload: IPayAppointmentPayload, user: RequestUser) => {
	const appointmentId = payload.appointmentId;

	const existingAppointment = await prisma.appointment.findFirst({
		where: {
			id: appointmentId,
			client: {
				userId: user.userId,
			},
		},
		include : {
			payment: true,
			schedule : {
				include : {
					lawyer : true
				}
			}
		}
	});

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exists");
	}

	if (existingAppointment.status !== "PENDING") {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Is Not Pending!");
	}

	if (
		existingAppointment.payment?.status === PaymentStatus.PAID ||
		existingAppointment.payment?.status === PaymentStatus.REFUNDED
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Payment Is Already Completed");
	}

	// Stripe Checkout URLs are single-use and may be completed or expired.
	// Always create a fresh Stripe session when a pending appointment is retried.
	if (
		existingAppointment.payment?.paymentGateway === payload.paymentGateway &&
		payload.paymentGateway !== PaymentGateway.STRIPE
	) {
		const existingPaymentUrl = getExistingPaymentUrl(
			existingAppointment.payment.gatewayResponse,
		);

		if (existingPaymentUrl) {
			return { paymentUrl: existingPaymentUrl };
		}
	}

	if (!existingAppointment.schedule.lawyer.consultationFee){
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"lawyer Has Not Set A Consultation Fee Yet",
		);
	}

	const amount = existingAppointment.schedule.lawyer.consultationFee.toString();

	// ---- STRIPE (price created directly in BDT — no conversion) ----
	if (payload.paymentGateway === PaymentGateway.STRIPE) {
		const session = await createStripeCheckoutSession(
			existingAppointment.id,
			existingAppointment.schedule.lawyer.consultationFee.toString(),
			user.email,
		);

		await prisma.payment.update({
			where: {
				appointmentId: existingAppointment.id,
			},
			data: {
				paymentGateway: PaymentGateway.STRIPE,
				stripeSessionId: session.id,
				payerReference: user.email,
				gatewayResponse: toJsonValue(session),
			},
		});

		return {
			paymentUrl: session.url,
		};
	}

	// ---- BKASH (default / unchanged) ----
	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
	}

	const bkashCreatePaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				payerReference: user.email, 
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				amount: amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: existingAppointment.id,
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
		},

		data: {
			paymentGateway: PaymentGateway.BKASH,
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			gatewayResponse: bkashCreatePaymentResult,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});

	return {
		paymentUrl: bkashCreatePaymentResult.bkashURL,
	};
};

const bookAppointmentCallback = async (query: Record<string, unknown>) => {
	const paymentId = typeof query.paymentID === "string" ? query.paymentID : undefined;

	if (!paymentId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment Id Missing");
	}

	const status = typeof query.status === "string" ? query.status : undefined;

	if (!status) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment Status is Missing");
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
	}

	const executedPaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({ paymentID: paymentId }),
		},
	);

	const executedPaymentResult = await executedPaymentResponse.json();

	const transactionResult = await prisma.$transaction(async (tx) => {
		if (status === "success") {
			return finalizeConfirmedAppointment(
				tx,
				executedPaymentResult.merchantInvoiceNumber,
				{
					bkashTrxId: executedPaymentResult.trxID,
					paidAt: executedPaymentResult.paymentExecuteTime,
					gatewayResponse: executedPaymentResult,
				},
			);
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: executedPaymentResult,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failue`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: executedPaymentResult,
				},
			});
			return {
				executedPaymentResult,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		} else {
			return {
				executedPaymentResult,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
			};
		}
	}, {
		maxWait: 10000, // default: 2000
		isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
		timeout: 30000, // default: 5000
	});

	return transactionResult;
};

/**
 * Handles Stripe webhook events. The route must supply the RAW request
 * body (Buffer) — do not run this through express.json() first, or
 * signature verification below will always fail.
 */
const finalizeStripeAppointmentWithRetry = async (
	appointmentId: string,
	session: Stripe.Checkout.Session,
) => {
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await prisma.$transaction(
				async (tx) => finalizeConfirmedAppointment(tx, appointmentId, {
					stripePaymentIntentId:
						typeof session.payment_intent === "string"
							? session.payment_intent
							: session.payment_intent?.id,
					paidAt: new Date(),
					gatewayResponse: session,
				}),
				{
					maxWait: 10000,
					timeout: 30000,
					isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
				},
			);
		} catch (error: unknown) {
			const isSerializationConflict =
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				(error as { code?: string }).code === "P2034";

			if (!isSerializationConflict || attempt === 3) {
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, attempt * 100));
		}
	}
};

const stripeWebhookHandler = async (rawBody: Buffer, signature: string) => {
	let event: Stripe.Event;
	console.log("[Stripe webhook] Verifying signature", {
		bodyLength: rawBody.length,
		secretConfigured: Boolean(config.stripe_webhook_secret),
		secretSuffix: config.stripe_webhook_secret.slice(-6),
		signatureTimestamp: signature.match(/(?:^|,)t=(\d+)/)?.[1],
	});

	try {
		event = stripe.webhooks.constructEvent(
			rawBody,
			signature,
			config.stripe_webhook_secret,
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Invalid Stripe signature";
		console.error("[Stripe webhook] Signature verification failed", message);
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Webhook Signature Verification Failed: ${message}`,
		);
	}

	console.log("[Stripe webhook] Event verified", {
		eventId: event.id,
		eventType: event.type,
		livemode: event.livemode,
	});

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const appointmentId = session.metadata?.appointmentId;
		console.log("[Stripe webhook] Checkout completed", {
			sessionId: session.id,
			appointmentId,
			paymentStatus: session.payment_status,
		});

		if (!appointmentId) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment Id Missing In Stripe Session Metadata",
			);
		}

		console.log("[Stripe webhook] Finalizing appointment", { appointmentId });
		const result = await finalizeStripeAppointmentWithRetry(appointmentId, session);
		console.log("[Stripe webhook] Finalization prepared", result);
		console.log("[Stripe webhook] Database transaction committed", {
			appointmentId,
		});
	}

	if (
		event.type === "checkout.session.expired" ||
		event.type === "payment_intent.payment_failed"
	) {
		const paymentObject = event.data.object as
			| Stripe.Checkout.Session
			| Stripe.PaymentIntent;
		const appointmentId = paymentObject.metadata?.appointmentId;

		if (appointmentId) {
			await prisma.payment.updateMany({
				where: {
					appointmentId,
					status: { not: PaymentStatus.PAID },
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: toJsonValue(paymentObject),
				},
			});
		}
	}

	return { received: true };
};

const stripeSuccessHandler = async (sessionId: string) => {
	let session: Stripe.Checkout.Session;

	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unable to retrieve Stripe session";
		throw new AppError(httpStatus.BAD_REQUEST, message);
	}

	const appointmentId = session.metadata?.appointmentId;

	if (!appointmentId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment Id Missing In Stripe Session Metadata",
		);
	}

	if (session.payment_status === "paid") {
		await finalizeStripeAppointmentWithRetry(appointmentId, session);
	}

	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId },
		include: {
			lawyer: { select: { id: true, name: true } },
			schedule: true,
			payment: true,
		},
	});

	return {
		message:
			session.payment_status === "paid"
				? "Payment completed successfully"
				: "Payment is not completed",
		sessionId: session.id,
		stripePaymentStatus: session.payment_status,
		appointment,
	};
};

const cancelAppointment = async (payload: ICancelAppointmentPayload, user : RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointmentId = payload.appointmentId;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
				client : {
					email : user.email
				}
			},
			include: {
				payment: true,
				schedule : true
			},
		});

		if (!existingAppointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exists");
		}

		if (
			existingAppointment.status === "ONGOING" ||
			existingAppointment.status === "COMPLETED"
		) {
			throw new AppError(httpStatus.BAD_REQUEST, "Appointment Ongoing or Completed");
		}

		if (existingAppointment.status === "CANCELLED") {
			throw new AppError(httpStatus.BAD_REQUEST, "Appointment Already Cancelled");
		}

		const updatedAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		if (existingAppointment.status === AppointmentStatus.CONFIRMED) {
			await tx.schedule.update({
				where: { id: existingAppointment.schedule.id },
				data: { availableSlots: { increment: 1 } },
			});
		}

		// refund process
		const now = new Date();
		const startDateTime = existingAppointment.schedule.startDateTime; // 25 August : 3:00 PM

		// After 2:00 Pm => no refund
		// must cancel before  2:00 PM
		const refundCutOffTime = subHours(startDateTime, 1)

		// now >  refuncCutOff Time => no refund
		// now < refundCutOff Time => refund eligible
		const isEligibleForRefund = isBefore(now, refundCutOffTime)

		if(isEligibleForRefund){

			if (existingAppointment.payment?.paymentGateway === PaymentGateway.STRIPE) {

				if (!existingAppointment.payment?.stripePaymentIntentId) {
					throw new AppError(
						httpStatus.BAD_REQUEST,
						"Stripe Payment Intent Not Found For Refund",
					);
				}

				const refund = await stripe.refunds.create({
					payment_intent: existingAppointment.payment.stripePaymentIntentId,
				});

				await tx.payment.update({
					where: {
						appointmentId: existingAppointment.id,
					},
					data: {
						refundTrxId: refund.id,
						refundedAt: new Date(),
						refundAmount: existingAppointment.payment?.amount,
						refundReason: "Patient Cancelled The Appointment",
						status: PaymentStatus.REFUNDED,
						gatewayResponse: refund as any,
					},
				});

			} else {

				const bkashIdToken = await getBkashIdToken();

				if (!bkashIdToken) {
					throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
				}

				const bkashRefundPaymentResponse = await fetch(
					`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
							Authorization: bkashIdToken,
							"X-App-Key": config.bkash_app_key,
						},
						body: JSON.stringify({
							paymentID: existingAppointment.payment?.bkashPaymentId,
							trxID: existingAppointment.payment?.bkashTrxId,
							amount: existingAppointment.payment?.amount.toString(),
							sku: "Appointment Cancellation",
							reason: "Patient Cancelled The Appointment",
						}),
					},
				);

				const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

				await tx.payment.update({
					where: {
						appointmentId: existingAppointment.id,
					},
					data: {
						refundTrxId: bkashRefundPaymentResult.refundTrxID,
						refundedAt: bkashRefundPaymentResult.completedTime,
						refundAmount: bkashRefundPaymentResult.amount,
						refundReason: "Patient Cancelled The Appointment",
						status: PaymentStatus.REFUNDED,
						gatewayResponse: bkashRefundPaymentResult,
					},
				});
			}

		}

		const newPaymentInfo = await tx.payment.findUnique({
			where: {
				appointmentId: existingAppointment.id,
			},
		})

		return {
			appointment: updatedAppointment,
			payment: newPaymentInfo,
		};
	}, {
		isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
		maxWait: 10000,
		timeout: 30000,
	});

	return transactionResult;
};
const updateAppointmentStatus = async (
	appointmentId : string,
	payload : IUpdateAppointmentStatusPayload,
	user : RequestUser
) => {
	const lawyer = await prisma.lawyer.findUnique({
		where: { userId: user.userId },
	});

	if (!lawyer) {
		throw new AppError(httpStatus.NOT_FOUND, "lawyer Profile Not Found");
	}

	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId, lawyerId : lawyer.id },
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}

	if(appointment.status === AppointmentStatus.COMPLETED){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is already completed")
	}

	if(appointment.status === AppointmentStatus.CANCELLED){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is already cancelled")
	}
	if(appointment.status === AppointmentStatus.PENDING){
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Pending. You can change the status after appointment is confirmed")
	}

	if(appointment.status === AppointmentStatus.CONFIRMED){

		if(payload.status !== "ONGOING"){
			throw new AppError(httpStatus.BAD_REQUEST, "Confirmed Appointment Must Be Ongoing At First")
		}

		await prisma.appointment.update({
			where : {
				id : appointment.id
			},
			data : {
				status : AppointmentStatus.ONGOING
			}
		})


	}

	if(appointment.status === AppointmentStatus.ONGOING){

		if(payload.status !== "COMPLETED"){
			throw new AppError(httpStatus.BAD_REQUEST, "Ongoinf Appointment Must Be Complted.")
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id
			},
			data: {
				status: AppointmentStatus.COMPLETED
			}
		})
	}

	const updatedAppointment = await prisma.appointment.findUnique({
		where : {
			id : appointment.id
		}
	})

	return updatedAppointment
}

const joinAppointment = async (
	appointmentId: string,
	user: RequestUser,
) => {
	const client = await prisma.client.findUnique({
		where: { userId: user.userId },
	});

	if (!client) {
		throw new AppError(httpStatus.NOT_FOUND, "Client Profile Not Found");
	}

	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId, clientId: client.id },
		include: { schedule: true },
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}

	if (
		appointment.status !== AppointmentStatus.CONFIRMED &&
		appointment.status !== AppointmentStatus.ONGOING
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only Confirmed Or Ongoing Appointments Can Be Joined",
		);
	}

	const joiningTime = new Date();

	if (
		joiningTime < appointment.schedule.startDateTime ||
		joiningTime > appointment.schedule.endDateTime
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment Can Only Be Joined Between Its Start And End Time",
		);
	}

	return prisma.appointment.update({
		where: { id: appointment.id },
		data: {
			...(appointment.status === AppointmentStatus.CONFIRMED && {
				status: AppointmentStatus.ONGOING,
			}),
			...(appointment.joiningTime === null && { joiningTime }),
		},
		include: { schedule: true },
	});
};

const getMyAppointments = async (query : IQuery, user : RequestUser) => {


	const limit = query?.limit ? Number(query.limit) : 10;
	const page = query?.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query?.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query?.sortOrder ? query.sortOrder : "desc"

	const client = await prisma.client.findUnique({
		where: { userId: user.userId },
	});

	if (!client) {
		throw new AppError(httpStatus.NOT_FOUND, "client Profile Not Found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			clientId : client.id
		}
	];

	const appointmentStatus = getAppointmentStatus(query?.status);

	if (appointmentStatus) {
		andConditions.push({ status: appointmentStatus });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder},
		include: {
			lawyer: { select: { id: true, name: true } },
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};


}
const getLawyerAppointments = async (query: IQuery, user: RequestUser) => {

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc"

	const lawyer = await prisma.lawyer.findUnique({
		where: { userId: user.userId },
	});

	if (!lawyer) {
		throw new AppError(httpStatus.NOT_FOUND, "lawyer Profile Not Found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			lawyerId : lawyer.id
		}
	];

	const appointmentStatus = getAppointmentStatus(query.status);

	if (appointmentStatus) {
		andConditions.push({ status: appointmentStatus });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder},
		include: {
			client: {
				select: { id: true, name: true, email: true, contactNumber: true },
			},
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}
const getAllAppointments = async (query : IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc"

	const andConditions: AppointmentWhereInput[] = [];

	const appointmentStatus = getAppointmentStatus(query.status);

	if (appointmentStatus) {
		andConditions.push({ status: appointmentStatus });
	}

	if (query.lawyerId) {
		andConditions.push({ lawyerId: query.lawyerId });
	}

	if (query.clientId) {
		andConditions.push({ clientId: query.clientId });
	}

	if(query.lawyerEmail){
		andConditions.push({
			lawyer : {
				email : query.lawyerEmail
			}
		})
	}
	if(query.clientEmail){
		andConditions.push({
			client : {
				email : query.clientEmail
			}
		})
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
			client: { select: { id: true, name: true, email: true } },
			lawyer: { select: { id: true, name: true, specialization: true } },
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};


}

const getSingleAppointment = async (appointmentId : string, user : RequestUser) => {
	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId },
		include: {
			client: { select: { id: true, name: true, email: true, userId: true } },
			lawyer: {
				select: { id: true, name: true, specialization: true, userId: true },
			},
			schedule: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
	}

	if(user.role === Role.CLIENT){
		if(appointment.client.userId !== user.userId){
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}
	if(user.role === Role.LAWYER){
		if(appointment.lawyer.userId !== user.userId){
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}

	return appointment
}

export const AppointmentServices = {
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