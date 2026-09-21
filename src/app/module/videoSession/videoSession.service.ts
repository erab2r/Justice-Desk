import crypto from "crypto";
import httpStatus from "http-status";
import { AppointmentStatus, Role } from "../../../../prisma/generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateVideoSessionPayload } from "./videoSession.interface";

const getAppointmentForSession = async (appointmentId: string) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true, lawyer: true, videoSession: true },
  });

  if (!appointment) {
    throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
  }

  return appointment;
};

const assertParticipant = (
  appointment: { client: { userId: string }; lawyer: { userId: string } },
  user: RequestUser,
) => {
  const isClientParticipant =
    user.role === Role.CLIENT && appointment.client.userId === user.userId;

  const isLawyerParticipant =
    user.role === Role.LAWYER && appointment.lawyer.userId === user.userId;

  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (!isClientParticipant && !isLawyerParticipant && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not A Participant Of This Appointment",
    );
  }
};

const createVideoSession = async (
  payload: ICreateVideoSessionPayload,
  user: RequestUser,
) => {
  const appointment = await getAppointmentForSession(payload.appointmentId);
  assertParticipant(appointment, user);

  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Video Session Can Only Be Created For A Confirmed Appointment",
    );
  }

  if (appointment.videoSession) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A Video Session Already Exists For This Appointment",
    );
  }

  const roomId = crypto.randomUUID();

  const session = await prisma.videoSession.create({
    data: {
      appointmentId: appointment.id,
      roomId,
      provider: payload.provider,
      roomUrl: payload.roomUrl,
    },
  });

  return session;
};

const startVideoSession = async (appointmentId: string, user: RequestUser) => {
  const appointment = await getAppointmentForSession(appointmentId);
  assertParticipant(appointment, user);

  if (!appointment.videoSession) {
    throw new AppError(httpStatus.NOT_FOUND, "Video Session Not Found");
  }

  if (appointment.videoSession.startedAt) {
    return appointment.videoSession;
  }

  return prisma.videoSession.update({
    where: { id: appointment.videoSession.id },
    data: { startedAt: new Date() },
  });
};

const endVideoSession = async (appointmentId: string, user: RequestUser) => {
  const appointment = await getAppointmentForSession(appointmentId);
  assertParticipant(appointment, user);

  if (!appointment.videoSession) {
    throw new AppError(httpStatus.NOT_FOUND, "Video Session Not Found");
  }

  if (appointment.videoSession.endedAt) {
    return appointment.videoSession;
  }

  return prisma.videoSession.update({
    where: { id: appointment.videoSession.id },
    data: { endedAt: new Date() },
  });
};

const getVideoSessionByAppointment = async (
  appointmentId: string,
  user: RequestUser,
) => {
  const appointment = await getAppointmentForSession(appointmentId);
  assertParticipant(appointment, user);

  if (!appointment.videoSession) {
    throw new AppError(httpStatus.NOT_FOUND, "Video Session Not Found");
  }

  return appointment.videoSession;
};

export const VideoSessionServices = {
  createVideoSession,
  startVideoSession,
  endVideoSession,
  getVideoSessionByAppointment,
};