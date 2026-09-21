import httpStatus from "http-status";

import {
  Role,
  SpecializationRequestStatus,
} from "../../../../prisma/generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
  
    IAssignSpecializationPayload,
  ICreateSpecializationPayload,
    IReviewSpecializationRequestPayload,
  IUpdateSpecializationPayload,
} from "./specialization.interface";

  const ensureAdmin = (user: RequestUser) => {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new AppError(httpStatus.FORBIDDEN, "Only Admin Can Manage Specializations");
    }
  };

const createSpecialization = async (
  payload: ICreateSpecializationPayload,
  user: RequestUser,
) => {
  ensureAdmin(user);
  const existingSpecialization = await prisma.specialization.findUnique({
    where: {
      name: payload.name,
    },
  });

  if (existingSpecialization) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Specialization With This Name Already Exists",
    );
  }

  const specialization = await prisma.specialization.create({
    data: {
      name: payload.name,
      description: payload.description,
    },
  });

  return specialization;
};

const getAllSpecializations = async () => {
  const specializations = await prisma.specialization.findMany({
    include: {
      _count: {
        select: {
          lawyers: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return specializations;
};

const getSpecializationById = async (specializationId: string) => {
  const specialization = await prisma.specialization.findUnique({
    where: {
      id: specializationId,
    },
    include: {
      lawyers: {
        include: {
          lawyer: true,
        },
      },
    },
  });

  if (!specialization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Specialization Not Found",
    );
  }

  return specialization;
};

const updateSpecialization = async (
  specializationId: string,
  payload: IUpdateSpecializationPayload,
  user: RequestUser,
) => {
  ensureAdmin(user);
  const specialization = await prisma.specialization.findUnique({
    where: {
      id: specializationId,
    },
  });

  if (!specialization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Specialization Not Found",
    );
  }

  if (payload.name && payload.name !== specialization.name) {
    const existingSpecialization =
      await prisma.specialization.findUnique({
        where: {
          name: payload.name,
        },
      });

    if (existingSpecialization) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Specialization With This Name Already Exists",
      );
    }
  }

  const updatedSpecialization = await prisma.specialization.update({
    where: {
      id: specializationId,
    },
    data: payload,
  });

  return updatedSpecialization;
};

const deleteSpecialization = async (
  specializationId: string,
  user: RequestUser,
) => {
  ensureAdmin(user);
  const specialization = await prisma.specialization.findUnique({
    where: {
      id: specializationId,
    },
  });

  if (!specialization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Specialization Not Found",
    );
  }

  await prisma.specialization.delete({
    where: {
      id: specializationId,
    },
  });

  return null;
};

const requestSpecialization = async (
  payload: IAssignSpecializationPayload,
  user: RequestUser,
) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyer Can Request Specialization",
    );
  }

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

  const specialization = await prisma.specialization.findUnique({
    where: {
      id: payload.specializationId,
    },
  });

  if (!specialization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Specialization Not Found",
    );
  }

  const existingAssignment =
    await prisma.lawyerSpecialization.findUnique({
      where: {
        lawyerId_specializationId: {
          lawyerId: lawyer.id,
          specializationId: payload.specializationId,
        },
      },
    });

  if (existingAssignment) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Specialization Already Approved For This Lawyer",
    );
  }

  const existingRequest = await prisma.lawyerSpecializationRequest.findUnique({
    where: {
      lawyerId_specializationId_status: {
        lawyerId: lawyer.id,
        specializationId: payload.specializationId,
        status: SpecializationRequestStatus.PENDING,
      },
    },
  });

  if (existingRequest) {
    throw new AppError(httpStatus.CONFLICT, "Specialization Request Is Already Pending");
  }

  return prisma.lawyerSpecializationRequest.create({
      data: {
        lawyerId: lawyer.id,
        specializationId: payload.specializationId,
      },
      include: {
        specialization: true,
        lawyer: true,
      },
    });
};

const getSpecializationRequests = async (status?: SpecializationRequestStatus) =>
  prisma.lawyerSpecializationRequest.findMany({
    where: status ? { status } : undefined,
    include: { lawyer: true, specialization: true },
    orderBy: { createdAt: "desc" },
  });

const reviewSpecializationRequest = async (
  payload: IReviewSpecializationRequestPayload,
  reviewer: RequestUser,
) => {
  ensureAdmin(reviewer);

  const request = await prisma.lawyerSpecializationRequest.findUnique({
    where: { id: payload.requestId },
  });

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Specialization Request Not Found");
  }

  if (request.status !== SpecializationRequestStatus.PENDING) {
    throw new AppError(httpStatus.CONFLICT, "Specialization Request Has Already Been Reviewed");
  }

  return prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.lawyerSpecializationRequest.update({
      where: { id: request.id },
      data: {
        status: payload.status,
        rejectionReason: payload.status === "APPROVED" ? null : payload.rejectionReason,
        reviewedBy: reviewer.userId,
        reviewedAt: new Date(),
      },
      include: { lawyer: true, specialization: true },
    });

    if (payload.status === "APPROVED") {
      await tx.lawyerSpecialization.upsert({
        where: {
          lawyerId_specializationId: {
            lawyerId: request.lawyerId,
            specializationId: request.specializationId,
          },
        },
        update: {},
        create: {
          lawyerId: request.lawyerId,
          specializationId: request.specializationId,
        },
      });
    }

    return updatedRequest;
  });
};

const removeSpecialization = async (
  specializationId: string,
  user: RequestUser,
) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyer Can Remove Specialization",
    );
  }

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

  const lawyerSpecialization =
    await prisma.lawyerSpecialization.findUnique({
      where: {
        lawyerId_specializationId: {
          lawyerId: lawyer.id,
          specializationId,
        },
      },
    });

  if (!lawyerSpecialization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Specialization Is Not Assigned To This Lawyer",
    );
  }

  await prisma.lawyerSpecialization.delete({
    where: {
      lawyerId_specializationId: {
        lawyerId: lawyer.id,
        specializationId,
      },
    },
  });

  return null;
};

const getMySpecializations = async (user: RequestUser) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyer Can View Own Specializations",
    );
  }

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

  const specializations =
    await prisma.lawyerSpecialization.findMany({
      where: {
        lawyerId: lawyer.id,
      },
      include: {
        specialization: true,
      },
      orderBy: {
        specialization: {
          name: "asc",
        },
      },
    });

  return specializations;
};

const getLawyerSpecializations = async (
  lawyerId: string,
) => {
  const lawyer = await prisma.lawyer.findUnique({
    where: {
      id: lawyerId,
    },
  });

  if (!lawyer) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Lawyer Not Found",
    );
  }

  const specializations =
    await prisma.lawyerSpecialization.findMany({
      where: {
        lawyerId,
      },
      include: {
        specialization: true,
      },
      orderBy: {
        specialization: {
          name: "asc",
        },
      },
    });

  return specializations;
};

export const SpecializationServices = {
  createSpecialization,
  getAllSpecializations,
  getSpecializationById,
  updateSpecialization,
  deleteSpecialization,
  requestSpecialization,
  removeSpecialization,
  getMySpecializations,
  getLawyerSpecializations,
  getSpecializationRequests,
  reviewSpecializationRequest,
};