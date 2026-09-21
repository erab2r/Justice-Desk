
import { z } from "zod";

export const PaymentValidation = {
  CreatePaymentZodSchema: z.object({
    appointmentId: z.string("Appointment ID is required").min(1, "Appointment ID is required"),
    paymentGateway: z.enum(["STRIPE", "BKASH"], "Payment gateway must be STRIPE or BKASH"),
  }),

  VerifyPaymentZodSchema: z.object({
    paymentId: z.string("Payment ID is required").min(1, "Payment ID is required"),
  }),

  RefundPaymentZodSchema: z.object({
    paymentId: z.string("Payment ID is required").min(1, "Payment ID is required"),
    reason: z
      .string("Refund reason must be a string")
      .min(3, "Refund reason must be at least 3 characters")
      .max(500, "Refund reason cannot exceed 500 characters")
      .optional(),
  }),
};

