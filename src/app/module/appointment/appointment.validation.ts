import { z } from "zod";

export const BookAppointmentValidationZodSchema = z.object({
    scheduleId: z.string().min(1, "Schedule Id Is Required"),

    paymentGateway: z.enum(
        ["STRIPE", "BKASH"],
        "Payment Gateway Must Be Either STRIPE Or BKASH",
    ),
});

export const PayAppointmentValidationZodSchema = z.object({
    appointmentId: z.string().min(1, "Appointment Id Is Required"),

    paymentGateway: z.enum(
        ["STRIPE", "BKASH"],
        "Payment Gateway Must Be Either STRIPE Or BKASH",
    ),
});

export const UpdateAppointmentStatusValidationZodSchema = z.object({
    status: z.enum(
        ["ONGOING", "COMPLETED"],
        "Status Must Be Either ONGOING Or COMPLETED",
    ),
});