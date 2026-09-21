import httpStatus from "http-status";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateCaseActivityPayload } from "./caseActivity.interface";

const getCaseForActivity = async (caseId: string) => {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: { client: true, lawyer: true },
  });

  if (!caseData) {
    throw new AppError(httpStatus.NOT_FOUND, "Case Not Found");
  }

  return caseData;
};

const assertCaseAccess = (
  caseData: { client: { userId: string }; lawyer: { userId: string } },
  user: RequestUser,
) => {
  if (user.role === Role.CLIENT && caseData.client.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Access Activities For This Case",
    );
  }

  if (user.role === Role.LAWYER && caseData.lawyer.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Access Activities For This Case",
    );
  }
};

const createCaseActivity = async (
  payload: ICreateCaseActivityPayload,
  user: RequestUser,
) => {
  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyers Or Admins Can Log Case Activities",
    );
  }

  const caseData = await getCaseForActivity(payload.caseId);
  assertCaseAccess(caseData, user);

  const activity = await prisma.caseActivity.create({
    data: {
      caseId: payload.caseId,
      action: payload.action,
      message: payload.message,
      metadata: payload.metadata
        ? (JSON.parse(JSON.stringify(payload.metadata)) as Prisma.InputJsonValue)
        : undefined,
      createdById: user.userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return activity;
};

const getCaseActivities = async (caseId: string, user: RequestUser) => {
  const caseData = await getCaseForActivity(caseId);
  assertCaseAccess(caseData, user);

  return prisma.caseActivity.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
};

const getActivityById = async (activityId: string, user: RequestUser) => {
  const activity = await prisma.caseActivity.findUnique({
    where: { id: activityId },
    include: {
      case: { include: { client: true, lawyer: true } },
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!activity) {
    throw new AppError(httpStatus.NOT_FOUND, "Case Activity Not Found");
  }

  assertCaseAccess(activity.case, user);

  return activity;
};

export const CaseActivityServices = {
  createCaseActivity,
  getCaseActivities,
  getActivityById,
};