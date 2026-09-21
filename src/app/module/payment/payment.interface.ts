// import {
//     PaymentGateway,
// } from "../../../../prisma/generated/prisma/enums";


// export interface ICreatePaymentPayload {

//     appointmentId: string;

//     paymentGateway: PaymentGateway;

// }


// export interface IVerifyPaymentPayload {

//     paymentId: string;

// }


// export interface IRefundPaymentPayload {

//     paymentId: string;

//     reason?: string;

// }


// export interface IPaymentGatewayResponse {

//     success: boolean;

//     paymentId?: string;

//     transactionId?: string;

//     message?: string;

//     data?: unknown;

// }


// export interface IStripePaymentResponse {

//     sessionId: string;

//     sessionUrl: string;

// }


// export interface IBkashPaymentResponse {

//     paymentId: string;

//     bkashURL: string;

// }


// export interface IPaymentFilterRequest {

//     status?: string;

//     paymentGateway?: PaymentGateway;

//     appointmentId?: string;

// }


import {
    PaymentGateway,
} from "../../../../prisma/generated/prisma/enums";


export interface ICreatePaymentPayload {

    appointmentId: string;

    paymentGateway: PaymentGateway;

}
export interface IVerifyPaymentPayload {

    paymentId: string;

}
export interface IRefundPaymentPayload {

    paymentId: string;

    reason?: string;

}
export interface IPaymentGatewayResponse {

    success: boolean;

    paymentId?: string;

    transactionId?: string;

    message?: string;

    data?: unknown;

}
export interface IStripePaymentResponse {

    sessionId: string;

    sessionUrl: string;

}
export interface IBkashPaymentResponse {

    paymentId: string;

    bkashURL: string;

}
export interface IPaymentFilterRequest {

    status?: string;

    paymentGateway?: PaymentGateway;

    appointmentId?: string;

    clientEmail?: string;

}