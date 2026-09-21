import httpStatus from "http-status";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreateCaseMessagePayload } from "./caseMessage.interface";


const getCaseForMessage = async (caseId: string) => {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: { client: true, lawyer: true },
  });

  if (!caseData) {
    throw new AppError(httpStatus.NOT_FOUND, "Case Not Found");
  }

  return caseData;
};

const assertParticipant = (
  caseData: { client: { userId: string }; lawyer: { userId: string } },
  user: RequestUser,
) => {
  const isClientParticipant =
    user.role === Role.CLIENT && caseData.client.userId === user.userId;

  const isLawyerParticipant =
    user.role === Role.LAWYER && caseData.lawyer.userId === user.userId;

  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (!isClientParticipant && !isLawyerParticipant && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not A Participant Of This Case",
    );
  }
};

const createCaseMessage = async (
  payload: ICreateCaseMessagePayload,
  user: RequestUser,
) => {
  const caseData = await getCaseForMessage(payload.caseId);

  if (user.role !== Role.CLIENT && user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only The Case Client Or Lawyer Can Send Messages",
    );
  }

  assertParticipant(caseData, user);

  const message = await prisma.caseMessage.create({
    data: {
      caseId: payload.caseId,
      senderId: user.userId,
      content: payload.content,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return message;
};

const getCaseMessages = async (caseId: string, user: RequestUser) => {
  const caseData = await getCaseForMessage(caseId);
  assertParticipant(caseData, user);

  const messages = await prisma.caseMessage.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await prisma.caseMessage.updateMany({
    where: {
      caseId,
      senderId: { not: user.userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return messages;
};

const deleteCaseMessage = async (messageId: string, user: RequestUser) => {
  const message = await prisma.caseMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message Not Found");
  }

  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (message.senderId !== user.userId && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Can Only Delete Your Own Messages",
    );
  }

  await prisma.caseMessage.delete({ where: { id: messageId } });

  return null;
};

export const CaseMessageServices = {
  createCaseMessage,
  getCaseMessages,
  deleteCaseMessage,
};