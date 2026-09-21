import {
    PaymentGateway,
} from "../../../../prisma/generated/prisma/enums";

export interface IBookAppointmentPayload {
    scheduleId: string;
    paymentGateway: PaymentGateway;
}

export interface IPayAppointmentPayload {
    appointmentId: string;
    paymentGateway: PaymentGateway;
}

export interface ICancelAppointmentPayload {
    appointmentId: string;
}

export interface IUpdateAppointmentStatusPayload {
    status: "ONGOING" | "COMPLETED";
}