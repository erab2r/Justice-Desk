
import { Router } from "express";
import express from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppointmentController } from "./appointment.controller";
import {
	BookAppointmentValidationZodSchema,
	PayAppointmentValidationZodSchema,
	UpdateAppointmentStatusValidationZodSchema,
} from "./appointment.validation";
import { Role } from "../../../../prisma/generated/prisma/enums";

const router = Router();

router.post(
	"/book-appointment",
	auth(Role.CLIENT),
	validateRequest(BookAppointmentValidationZodSchema),
	AppointmentController.bookAppointment,
);
router.post(
	"/pay-appointment",
	auth(Role.CLIENT),
	validateRequest(PayAppointmentValidationZodSchema),
	AppointmentController.payAppointment,
);
router.post(
	"/cancel-appointment",
	auth(Role.CLIENT, Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentController.cancelAppointment,
);

//book appointment  bkash callback url
router.get(
	"/book-appointment/payment/callback",
	AppointmentController.bookAppointmentCallback,
);

router.get(
	"/stripe/success",
	AppointmentController.stripeSuccessHandler,
);

router.get("/stripe/cancel", (_req, res) => {
	res.status(200).json({
		message: "Payment was cancelled",
	});
});

router.post(
	"/stripe/webhook",
	express.raw({ type: "application/json" }),
	AppointmentController.stripeWebhookHandler,
);

router.patch(
	"/update-status/:appointmentId",
	auth(Role.LAWYER),
	validateRequest(UpdateAppointmentStatusValidationZodSchema),
	AppointmentController.updateAppointmentStatus,
);

router.post(
	"/join/:appointmentId",
	auth(Role.CLIENT),
	AppointmentController.joinAppointment,
);

router.get(
	"/my-appointments",
	auth(Role.CLIENT),
	AppointmentController.getMyAppointments,
);

router.get(
	"/lawyer-appointments",
	auth(Role.LAWYER),
	AppointmentController.getLawyerAppointments,
);

router.get(
	"/all-appointments",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentController.getAllAppointments,
);

router.get(
	"/:appointmentId",
	auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentController.getSingleAppointment,
);


export const AppointementRoutes = router;