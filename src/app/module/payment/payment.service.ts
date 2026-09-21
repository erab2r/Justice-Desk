import httpStatus from "http-status";
import type { PaymentWhereInput } from "../../../../prisma/generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import {
    PaymentGateway,
    PaymentStatus,
    Role,
} from "../../../../prisma/generated/prisma/enums";


const getMyPayments = async (query : IQuery, user : RequestUser) => {

    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const client = await prisma.client.findUnique({
        where: { userId: user.userId },
    });

    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, "client Profile Not Found");
    }

    const andConditions : PaymentWhereInput[] = [
        {
            appointment: { clientId: client.id }
        }
    ]

    const payments = await prisma.payment.findMany({
        where: { AND : andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy] : sortOrder },
        include: {
            appointment: {
                include: {
                    lawyer: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });

    const total = await prisma.payment.count({
        where: { AND : andConditions },
    });

    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };


}

const getAllPayments = async (query: IQuery) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const andConditions: PaymentWhereInput[] = []

    if(query.clientEmail) {
        andConditions.push({
            appointment : {
                client : {
                    email : query.clientEmail
                }
            }
        })
    }

    if (
        query.paymentGateway === PaymentGateway.STRIPE ||
        query.paymentGateway === PaymentGateway.BKASH
    ) {
        andConditions.push({
            paymentGateway: query.paymentGateway,
        })
    }

    if (
        query.status === PaymentStatus.UNPAID ||
        query.status === PaymentStatus.PAID ||
        query.status === PaymentStatus.FAILED ||
        query.status === PaymentStatus.CANCELLED ||
        query.status === PaymentStatus.REFUNDED
    ) {
        andConditions.push({
            status: query.status,
        })
    }

    const payments = await prisma.payment.findMany({
        where: { AND: andConditions },
        take: limit,
        skip,
        orderBy: { [sortBy]: sortOrder },
        include: {
            appointment: {
                include: {
                    lawyer: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });

    const total = await prisma.payment.count({
        where: { AND: andConditions },
    });

    return {
        data: payments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };

}

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            appointment: {
                include: {
                    client: {
                        select: { id: true, name: true, email: true, userId: true },
                    },
                    lawyer: { select: { id: true, name: true, specialization: true } },
                    schedule: true,
                },
            },
        },
    });

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment Not Found");
    }

    if (user.role === Role.CLIENT) {
        if (payment.appointment.client.userId !== user.userId) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You Are Not Allowed To View This Payment",
            );
        }
    }

    return payment
}

export const PaymentServices = {
    getAllPayments,
    getMyPayments,
    getSinglePayment
}