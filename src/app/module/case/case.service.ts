import httpStatus from "http-status";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import {
    CasePriority,
    CaseStatus,
    Role,
} from "../../../../prisma/generated/prisma/enums";

import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IQuery } from "../../interfaces";

import {
    IAssignLawyerPayload,
    IChangeCaseStatusPayload,
    ICreateCasePayload,
    IUpdateCasePayload,
} from "./case.interface";
import { RequestUser } from "../../middleware/checkAuth";

const generateCaseNumber = async () => {
    const year = new Date().getFullYear();

    const latestCase = await prisma.case.findFirst({
        where: {
            caseNumber: {
                startsWith: `CASE-${year}-`,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            caseNumber: true,
        },
    });

    let nextNumber = 1;

    if (latestCase) {
        const lastNumber = Number(
            latestCase.caseNumber.split("-").pop(),
        );

        if (!Number.isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    return `CASE-${year}-${String(nextNumber).padStart(4, "0")}`;
};

const createCase = async (
    payload: ICreateCasePayload,
    user: RequestUser,
) => {
    const client = await prisma.client.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!client) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Client Profile Not Found",
        );
    }

    const lawyer = await prisma.lawyer.findUnique({
        where: {
            id: payload.lawyerId,
        },
    });

    if (!lawyer) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Lawyer Not Found",
        );
    }

    if (lawyer.isDeleted) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This Lawyer Is No Longer Available",
        );
    }

    if (lawyer.verificationStatus !== "APPROVED") {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This Lawyer Is Not Approved",
        );
    }

    if (payload.appointmentId) {
        const appointment = await prisma.appointment.findUnique({
            where: {
                id: payload.appointmentId,
            },
        });

        if (!appointment) {
            throw new AppError(
                httpStatus.NOT_FOUND,
                "Appointment Not Found",
            );
        }

        if (appointment.clientId !== client.id) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "This Appointment Does Not Belong To You",
            );
        }

        if (appointment.lawyerId !== lawyer.id) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "Appointment Lawyer Does Not Match The Selected Lawyer",
            );
        }

        if (appointment.status !== "COMPLETED") {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "Case Can Only Be Created From A Completed Appointment",
            );
        }

        const existingCase = await prisma.case.findUnique({
            where: {
                appointmentId: payload.appointmentId,
            },
        });

        if (existingCase) {
            throw new AppError(
                httpStatus.CONFLICT,
                "A Case Already Exists For This Appointment",
            );
        }
    }

    const caseNumber = await generateCaseNumber();

    const result = await prisma.$transaction(async (tx) => {
        const newCase = await tx.case.create({
            data: {
                caseNumber,
                title: payload.title,
                description: payload.description,
                caseType: payload.caseType,
                priority: payload.priority ?? CasePriority.MEDIUM,
                courtName: payload.courtName,
                courtCaseNumber: payload.courtCaseNumber,
                filingDate: payload.filingDate
                    ? new Date(payload.filingDate)
                    : undefined,
                status: CaseStatus.OPEN,
                clientId: client.id,
                lawyerId: lawyer.id,
                appointmentId: payload.appointmentId,
            },
            include: {
                client: {
                    select: {
                        id: true,
						userId: true,
                        name: true,
                        email: true,
                        contactNumber: true,
                    },
                },
                lawyer: {
                    select: {
                        id: true,
                        userId: true,
                        name: true,
                        email: true,
                        licenseNumber: true,
                        verificationStatus: true,
                    },
                },
                appointment: true,
            },
        });

        await tx.caseActivity.create({
            data: {
                caseId: newCase.id,
                action: "CASE_CREATED",
                message: "Case Created Successfully",
                newStatus: CaseStatus.OPEN,
                createdById: user.userId,
            },
        });

        return newCase;
    });

    return result;
};

const getMyCases = async (
    query: IQuery,
    user: RequestUser,
) => {
    const limit = query.limit
        ? Number(query.limit)
        : 10;

    const page = query.page
        ? Number(query.page)
        : 1;

    const skip = (page - 1) * limit;

    const client = await prisma.client.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!client) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Client Profile Not Found",
        );
    }

    const andConditions: Prisma.CaseWhereInput[] = [
        {
            clientId: client.id,
        },
    ];

    if (query.status) {
        andConditions.push({
            status: query.status as CaseStatus,
        });
    }

    if (query.priority) {
        andConditions.push({
            priority: query.priority as CasePriority,
        });
    }

    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    title: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    caseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    caseType: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    courtName: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    const cases = await prisma.case.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            createdAt:
                query.sortOrder === "asc"
                    ? "asc"
                    : "desc",
        },
        include: {
            lawyer: {
    			select: {
        			id: true,
        			userId: true,
        			name: true,
        			email: true,
        			licenseNumber: true,
        			qualifications: true,
        			experienceYears: true,
        			bio: true,
        			verificationStatus: true,
    			},
			},
            appointment: {
                select: {
                    id: true,
                    status: true,
                    joiningTime: true,
                    serialNumber: true,
                    meetingLink: true,
                },
            },
        },
    });

    const total = await prisma.case.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: cases,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};


const getLawyerCases = async (
    query: IQuery,
    user: RequestUser,
) => {
    const limit = query.limit
        ? Number(query.limit)
        : 10;

    const page = query.page
        ? Number(query.page)
        : 1;

    const skip = (page - 1) * limit;

    const lawyer = await prisma.lawyer.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!lawyer) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Lawyer Profile Not Found",
        );
    }

    const andConditions: Prisma.CaseWhereInput[] = [
        {
            lawyerId: lawyer.id,
        },
    ];

    if (query.status) {
        andConditions.push({
            status: query.status as CaseStatus,
        });
    }

    if (query.priority) {
        andConditions.push({
            priority: query.priority as CasePriority,
        });
    }

    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    title: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    caseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    caseType: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    const cases = await prisma.case.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            createdAt:
                query.sortOrder === "asc"
                    ? "asc"
                    : "desc",
        },
        include: {
            client: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                    contactNumber: true,
                },
            },
            appointment: {
                select: {
                    id: true,
                    status: true,
                    joiningTime: true,
                    serialNumber: true,
                    meetingLink: true,
                },
            },
        },
    });

    const total = await prisma.case.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: cases,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const getAllCases = async (
    query: IQuery,
) => {
    const limit = query.limit
        ? Number(query.limit)
        : 10;

    const page = query.page
        ? Number(query.page)
        : 1;

    const skip = (page - 1) * limit;

    const andConditions: Prisma.CaseWhereInput[] = [];

    if (query.status) {
        andConditions.push({
            status: query.status as CaseStatus,
        });
    }

    if (query.priority) {
        andConditions.push({
            priority: query.priority as CasePriority,
        });
    }

    if (query.lawyerId) {
        andConditions.push({
            lawyerId: query.lawyerId,
        });
    }

    if (query.clientId) {
        andConditions.push({
            clientId: query.clientId,
        });
    }

    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    caseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    title: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    caseType: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    courtName: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    const cases = await prisma.case.findMany({
        where: {
            AND: andConditions,
        },
        take: limit,
        skip,
        orderBy: {
            createdAt:
                query.sortOrder === "asc"
                    ? "asc"
                    : "desc",
        },
        include: {
            client: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                    contactNumber: true,
                },
            },
            lawyer: {
     			select: {
        		id: true,
        		userId: true,
        		name: true,
        		email: true,
        		licenseNumber: true,
        		qualifications: true,
        		experienceYears: true,
        		bio: true,
        		verificationStatus: true,
    		},
		},
        },
    });

    const total = await prisma.case.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: cases,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};


const getCaseById = async (
    caseId: string,
    user: RequestUser,
) => {
    const caseData = await prisma.case.findUnique({
        where: {
            id: caseId,
        },
        include: {
            client: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                    contactNumber: true,
                    address: true,
                },
            },
            lawyer: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                    licenseNumber: true,
                    qualifications: true,
                    experienceYears: true,
                    bio: true,
                    verificationStatus: true,
                },
            },
            appointment: {
                include: {
                    payment: true,
                    schedule: true,
                },
            },
            documents: true,
            notes: true,
            invoices: true,
            reports: true,
            activities: {
                orderBy: {
                    createdAt: "desc",
                },
            },
            messages: {
                orderBy: {
                    createdAt: "asc",
                },
            },
        },
    });

    if (!caseData) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Case Not Found",
        );
    }

    if (user.role === Role.CLIENT) {
        if (caseData.client.userId !== user.userId) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You Are Not Allowed To View This Case",
            );
        }
    }
    if (user.role === Role.LAWYER) {
        if (caseData.lawyer.userId !== user.userId) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You Are Not Allowed To View This Case",
            );
        }
    }

    return caseData;
};
const updateCase = async (
    caseId: string,
    payload: IUpdateCasePayload,
    user: RequestUser,
) => {
    const existingCase = await prisma.case.findUnique({
        where: {
            id: caseId,
        },
    });

    if (!existingCase) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Case Not Found",
        );
    }

    if (
        user.role !== Role.ADMIN &&
        user.role !== Role.SUPER_ADMIN
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "You Are Not Allowed To Update This Case",
        );
    }

    const updatedCase = await prisma.case.update({
        where: {
            id: caseId,
        },
        data: {
            title: payload.title,
            description: payload.description,
            caseType: payload.caseType,
            priority: payload.priority,
            courtName: payload.courtName,
            courtCaseNumber: payload.courtCaseNumber,
            filingDate: payload.filingDate
                ? new Date(payload.filingDate)
                : undefined,
        },
        include: {
            client: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                },
            },
            lawyer: {
                select: {
                    id: true,
					userId: true,
                    name: true,
                    email: true,
                    licenseNumber: true,
                },
            },
        },
    });

    await prisma.caseActivity.create({
        data: {
            caseId: existingCase.id,
            action: "CASE_UPDATED",
            message: "Case Information Updated",
            createdById: user.userId,
        },
    });

    return updatedCase;
};

const isValidStatusTransition = (
    currentStatus: CaseStatus,
    nextStatus: CaseStatus,
) => {
    const allowedTransitions: Record<
        CaseStatus,
        CaseStatus[]
    > = {
        [CaseStatus.OPEN]: [
            CaseStatus.IN_PROGRESS,
        ],

        [CaseStatus.IN_PROGRESS]: [
            CaseStatus.WAITING_FOR_CLIENT,
        ],

        [CaseStatus.WAITING_FOR_CLIENT]: [
            CaseStatus.IN_PROGRESS,
            CaseStatus.RESOLVED,
        ],

        [CaseStatus.RESOLVED]: [
            CaseStatus.CLOSED,
        ],

        [CaseStatus.CLOSED]: [],
    };

    return allowedTransitions[currentStatus].includes(
        nextStatus,
    );
};

/*
|--------------------------------------------------------------------------
| Change Case Status
|--------------------------------------------------------------------------
*/

const changeCaseStatus = async (
    caseId: string,
    payload: IChangeCaseStatusPayload,
    user: RequestUser,
) => {
    const existingCase = await prisma.case.findUnique({
        where: {
            id: caseId,
        },
    });

    if (!existingCase) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Case Not Found",
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Ownership
    |--------------------------------------------------------------------------
    */

    if (user.role === Role.LAWYER) {
        const lawyer = await prisma.lawyer.findUnique({
            where: {
                userId: user.userId,
            },
        });

        if (!lawyer) {
            throw new AppError(
                httpStatus.NOT_FOUND,
                "Lawyer Profile Not Found",
            );
        }

        if (existingCase.lawyerId !== lawyer.id) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You Are Not Allowed To Update This Case",
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Only Lawyer/Admin/Super Admin
    |--------------------------------------------------------------------------
    */

    if (user.role === Role.CLIENT) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Client Cannot Change Case Status",
        );
    }

    const nextStatus = payload.status;

    if (
        existingCase.status === nextStatus
    ) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Case Is Already In This Status",
        );
    }

    if (
        !isValidStatusTransition(
            existingCase.status,
            nextStatus,
        )
    ) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid Case Status Transition From ${existingCase.status} To ${nextStatus}`,
        );
    }

    const now = new Date();

    const updatedCase = await prisma.$transaction(
        async (tx) => {
            const data: Prisma.CaseUpdateInput = {
                status: nextStatus,
            };

            if (
                nextStatus === CaseStatus.RESOLVED
            ) {
                data.resolvedAt = now;
            }

            if (
                nextStatus === CaseStatus.CLOSED
            ) {
                data.closedAt = now;
            }

            const updated = await tx.case.update({
                where: {
                    id: caseId,
                },
                data,
            });

            await tx.caseActivity.create({
                data: {
                    caseId,
                    action: "CASE_STATUS_CHANGED",
                    message: `Case Status Changed From ${existingCase.status} To ${nextStatus}`,
                    oldStatus: existingCase.status,
                    newStatus: nextStatus,
                    createdById: user.userId,
                },
            });

            return updated;
        },
    );

    return updatedCase;
};

/*
|--------------------------------------------------------------------------
| Assign Lawyer
|--------------------------------------------------------------------------
*/

const assignLawyer = async (
    caseId: string,
    payload: IAssignLawyerPayload,
    user: RequestUser,
) => {
    if (
        user.role !== Role.ADMIN &&
        user.role !== Role.SUPER_ADMIN
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Only Admin Can Assign Lawyer",
        );
    }

    const existingCase = await prisma.case.findUnique({
        where: {
            id: caseId,
        },
    });

    if (!existingCase) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Case Not Found",
        );
    }

    const lawyer = await prisma.lawyer.findUnique({
        where: {
            id: payload.lawyerId,
        },
    });

    if (!lawyer) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Lawyer Not Found",
        );
    }

    if (lawyer.isDeleted) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This Lawyer Is No Longer Available",
        );
    }

    if (lawyer.verificationStatus !== "APPROVED") {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This Lawyer Is Not Approved",
        );
    }

    if (existingCase.lawyerId === lawyer.id) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This Lawyer Is Already Assigned To The Case",
        );
    }

    const updatedCase = await prisma.$transaction(
        async (tx) => {
            const updated = await tx.case.update({
                where: {
                    id: caseId,
                },
                data: {
                    lawyerId: lawyer.id,
                },
                include: {
                    client: {
                        select: {
                            id: true,
							userId: true,
                            name: true,
                            email: true,
                        },
                    },
                    lawyer: {
                        select: {
                            id: true,
							userId: true,
                            name: true,
                            email: true,
                            licenseNumber: true,
                        },
                    },
                },
            });

            await tx.caseActivity.create({
                data: {
                    caseId,
                    action: "LAWYER_ASSIGNED",
                    message: `Lawyer Assigned: ${lawyer.name}`,
                    metadata: {
                        previousLawyerId:
                            existingCase.lawyerId,
                        newLawyerId: lawyer.id,
                    },
                    createdById: user.userId,
                },
            });

            return updated;
        },
    );

    return updatedCase;
};

/*
|--------------------------------------------------------------------------
| Close Case
|--------------------------------------------------------------------------
*/

const closeCase = async (
    caseId: string,
    user: RequestUser,
) => {
    return changeCaseStatus(
        caseId,
        {
            status: CaseStatus.CLOSED,
        },
        user,
    );
};

/*
|--------------------------------------------------------------------------
| Delete Case
|--------------------------------------------------------------------------
*/

const deleteCase = async (
    caseId: string,
    user: RequestUser,
) => {
    if (
        user.role !== Role.ADMIN &&
        user.role !== Role.SUPER_ADMIN
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Only Admin Can Delete Case",
        );
    }

    const existingCase = await prisma.case.findUnique({
        where: {
            id: caseId,
        },
    });

    if (!existingCase) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Case Not Found",
        );
    }

    await prisma.case.delete({
        where: {
            id: caseId,
        },
    });

    return null;
};



export const CaseServices = {
    createCase,
    getMyCases,
    getLawyerCases,
    getAllCases,
    getCaseById,
    updateCase,
    changeCaseStatus,
    assignLawyer,
    closeCase,
    deleteCase,
};