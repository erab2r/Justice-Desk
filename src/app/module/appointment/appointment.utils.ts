import httpStatus from "http-status";
import PDFDocument from "pdfkit";
import type Stripe from "stripe";

import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import { AppointmentStatus, PaymentStatus } from "../../../../prisma/generated/prisma/enums";
import { Prisma } from "../../../../prisma/generated/prisma/client";

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
	JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const toPaymentDate = (value: Date | string): Date => {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? new Date() : value;
	}

	const normalizedValue = value.replace(
		/:(\d{3})(?=\sGMT[+-]\d{4}$)/,
		".$1",
	);
	const parsedDate = new Date(normalizedValue);

	return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
};

/**
 * Creates a Stripe Checkout Session for a given appointment.
 *
 * NOTE: The Stripe Price/product for the consultation fee was created
 * directly in BDT on the Stripe dashboard/API — so NO currency
 * conversion happens here. The lawyer's consultationFee (stored in BDT)
 * is passed straight through, only converted to the smallest currency
 * unit (poisha) that Stripe expects, i.e. amount * 100.
 */
export const createStripeCheckoutSession = async (
	appointmentId: string,
	consultationFeeBDT: number | string,
	payerEmail: string,
): Promise<Stripe.Checkout.Session> => {
	const amountInBDT = Number(consultationFeeBDT);

	if (!amountInBDT || amountInBDT <= 0) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Consultation Fee Amount");
	}

	const unitAmountInPoisha = Math.round(amountInBDT * 100);

	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		payment_method_types: ["card"],
		customer_email: payerEmail,
		payment_intent_data: {
			metadata: {
				appointmentId,
			},
		},
		line_items: [
			{
				price_data: {
					currency: "bdt",
					unit_amount: unitAmountInPoisha,
					product_data: {
						name: "Lawyer Consultation Fee",
					},
				},
				quantity: 1,
			},
		],
		metadata: {
			appointmentId,
		},
		success_url: `${config.backend_url}/api/v1/appointment/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${config.backend_url}/api/v1/appointment/stripe/cancel`,
	});

	console.log("[Stripe checkout] Session created", {
		sessionId: session.id,
		livemode: session.livemode,
		paymentStatus: session.payment_status,
		hasUrl: Boolean(session.url),
	});

	return session;
};

/**
 * Shared "appointment confirmed & paid" flow.
 * Used by both the bKash callback (success) and the Stripe webhook
 * (checkout.session.completed) so the booking/confirmation behaviour
 * stays identical no matter which gateway was used.
 */
export const finalizeConfirmedAppointment = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	appointmentId: string,
	paymentUpdate: {
		bkashTrxId?: string;
		stripePaymentIntentId?: string;
		paidAt: Date | string;
		gatewayResponse: unknown;
	},
) => {
	const appointment = await tx.appointment.findUnique({
		where: { id: appointmentId },
		include: {
			schedule: true,
			client: true,
			lawyer: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found!");
	}

	if (
		appointment.status === AppointmentStatus.CONFIRMED &&
		appointment.payment?.status === PaymentStatus.PAID
	) {
		return {
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
		};
	}

	if (appointment.status !== AppointmentStatus.PENDING) {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Is Not Pending");
	}

	if (!appointment.payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Payment Not Found");
	}

	const confirmedAppointments = await tx.appointment.count({
		where: {
			scheduleId: appointment.schedule.id,
			status: AppointmentStatus.CONFIRMED,
		},
	});

	if (confirmedAppointments >= appointment.schedule.totalSlots) {
		throw new AppError(httpStatus.BAD_REQUEST, "This Schedule Is Fully Booked");
	}

	const highestSerial = await tx.appointment.aggregate({
		where: {
			scheduleId: appointment.schedule.id,
			serialNumber: { not: null },
		},
		_max: { serialNumber: true },
	});

	const serialNumber = (highestSerial._max.serialNumber ?? 0) + 1;

	await tx.appointment.update({
		where: {
			id: appointmentId,
		},
		data: {
			status: AppointmentStatus.CONFIRMED,
			serialNumber,
		},
	});

	await tx.payment.update({
		where: {
			appointmentId,
		},
		data: {
			status: PaymentStatus.PAID,
			bkashTrxId: paymentUpdate.bkashTrxId,
			stripePaymentIntentId: paymentUpdate.stripePaymentIntentId,
			paidAt: toPaymentDate(paymentUpdate.paidAt),
			gatewayResponse: toJsonValue(paymentUpdate.gatewayResponse),
		},
	});

	await tx.schedule.update({
		where: { id: appointment.schedule.id },
		data: { availableSlots: { decrement: 1 } },
	});

	const pdfDocument = new PDFDocument({ margin: 50 });

	const pdfChunks: Buffer[] = [];

	pdfDocument.on("data", (chunk: Buffer) => {
		pdfChunks.push(chunk);
	});

	const pdfReadyPromise = new Promise<Buffer>((resolve) => {
		pdfDocument.on("end", () => {
			resolve(Buffer.concat(pdfChunks));
		});
	});

	pdfDocument.fontSize(20).text("Lawyer management System", { align: "center" });
	pdfDocument.fontSize(14).text("Appointment Invoice", { align: "center" });
	pdfDocument.moveDown(2);

	pdfDocument.fontSize(12).text(`Client Name: ${appointment.client?.name}`);
	pdfDocument.text(`Client Email: ${appointment.client?.email}`);
	pdfDocument.moveDown();

	pdfDocument.text(`Lawyer Name: ${appointment.lawyer?.name}`);
	pdfDocument.text(`Qualifications: ${appointment.lawyer?.qualifications ?? ""}`);
	pdfDocument.moveDown();

	pdfDocument.text(
		`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`,
	);
	pdfDocument.text(`Your Serial Number: ${serialNumber}`);
	pdfDocument.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
	pdfDocument.moveDown();

	pdfDocument.end();

	const pdfBuffer = await pdfReadyPromise;

	try {
		await transporter.sendMail({
			from: config.email_sender,
			to: appointment.client.email,
			subject: "Your Appointment Invoice - Lawyer management System",
			text: "Thank you for booking an appointment. Please find your invoice attached.",
			attachments: [
				{
					filename: "invoice.pdf",
					content: pdfBuffer,
				},
			],
		});
	} catch (error) {
		console.error("Failed to send appointment invoice email:", error);
	}

	return {
		redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
	};
};