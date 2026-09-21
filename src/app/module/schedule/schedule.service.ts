import httpStatus from "http-status";
import { addDays, isAfter } from "date-fns";

import type {
  ICreateSchedulePayload,
  IUpdateSchedulePayload,
  IUpdateScheduleStatusPayload,
} from "./schedule.interface";

import { AppError } from "../../utils/AppError";
import type { RequestUser } from "../../middleware/checkAuth";

import {
  Role,
  ScheduleStatus,
} from "../../../../prisma/generated/prisma/enums";

import type {
  ScheduleWhereInput,
} from "../../../../prisma/generated/prisma/models";

import { prisma } from "../../lib/prisma";
import type { IQuery } from "../../interfaces";

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const validateScheduleDateTime = (
  startDateTime: Date,
  endDateTime: Date,
) => {
  if (startDateTime <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Schedule Start Time Must Be In The Future",
    );
  }

  if (
    startDateTime.getUTCFullYear() !== endDateTime.getUTCFullYear() ||
    startDateTime.getUTCMonth() !== endDateTime.getUTCMonth() ||
    startDateTime.getUTCDate() !== endDateTime.getUTCDate()
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Start Date Time And End Date Time Must Be On The Same Day",
    );
  }

  if (!isAfter(endDateTime, startDateTime)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "End Date Time Must Be After Start Date Time",
    );
  }
};

const getLawyerProfile = async (user: RequestUser) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyer Can Manage Schedule",
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

  if (lawyer.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Deleted Lawyer Cannot Manage Schedule",
    );
  }

  return lawyer;
};

const createSchedule = async (
  payload: ICreateSchedulePayload,
  user: RequestUser,
) => {
  const lawyer = await getLawyerProfile(user);

  validateScheduleDateTime(
    payload.startDateTime,
    payload.endDateTime,
  );

  const startOfTheDay = startOfUtcDay(payload.startDateTime);
  const startOfNextDay = addDays(startOfTheDay, 1);

  /*
   * Business rule:
   * A lawyer can have only one schedule on a particular day.
   */
  const existingScheduleOnThisDay =
    await prisma.schedule.findFirst({
      where: {
        lawyerId: lawyer.id,
        startDateTime: {
          gte: startOfTheDay,
          lt: startOfNextDay,
        },
        isDeleted: false,
      },
    });

  if (existingScheduleOnThisDay) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A Schedule Already Exists For This Day",
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      totalSlots: payload.totalSlots,
      availableSlots: payload.totalSlots,
      meetingLink: payload.meetingLink,
      lawyerId: lawyer.id,
      status: ScheduleStatus.DRAFT,
    },
    include: {
      lawyer: {
        select: {
          id: true,
          userId: true,
          bio: true,
          experienceYears: true,
          consultationFee: true,
          verificationStatus: true,
        },
      },
    },
  });

  return schedule;
};

const updateSchedule = async (
  scheduleId: string,
  payload: IUpdateSchedulePayload,
  user: RequestUser,
) => {
  const lawyer = await getLawyerProfile(user);

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      lawyerId: lawyer.id,
      isDeleted: false,
    },
  });

  if (!schedule) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Schedule Not Found",
    );
  }
  if (schedule.status !== ScheduleStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only Draft Schedule Can Be Updated",
    );
  }

  const startDateTime =
    payload.startDateTime ?? schedule.startDateTime;

  const endDateTime =
    payload.endDateTime ?? schedule.endDateTime;

  const meetingLink =
    payload.meetingLink ?? schedule.meetingLink;

  const totalSlots = payload.totalSlots ?? schedule.totalSlots;

  validateScheduleDateTime(
    startDateTime,
    endDateTime,
  );

  const startOfTheDay = startOfUtcDay(startDateTime);
  const startOfNextDay = addDays(startOfTheDay, 1);
  const duplicateSchedule =
    await prisma.schedule.findFirst({
      where: {
        id: {
          not: scheduleId,
        },
        lawyerId: lawyer.id,
        startDateTime: {
          gte: startOfTheDay,
          lt: startOfNextDay,
        },
        isDeleted: false,
      },
    });

  if (duplicateSchedule) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You Already Have A Schedule For This Day",
    );
  }

  const updatedSchedule =
    await prisma.schedule.update({
      where: {
        id: scheduleId,
      },
      data: {
        startDateTime,
        endDateTime,
        totalSlots,
        availableSlots: Math.max(
          totalSlots - (schedule.totalSlots - schedule.availableSlots),
          0,
        ),
        meetingLink,
      },
      include: {
        lawyer: {
          select: {
            id: true,
            userId: true,
            bio: true,
            experienceYears: true,
            consultationFee: true,
            verificationStatus: true,
          },
        },
      },
    });

  return updatedSchedule;
};

const updateScheduleStatus = async (
  scheduleId: string,
  payload: IUpdateScheduleStatusPayload,
  user: RequestUser,
) => {
  const lawyer = await getLawyerProfile(user);

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      lawyerId: lawyer.id,
      isDeleted: false,
    },
  });

  if (!schedule) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Schedule Not Found",
    );
  }

  if (schedule.status === ScheduleStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Published Schedule Status Cannot Be Changed",
    );
  }

  if (schedule.status !== ScheduleStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only Draft Schedule Can Be Published",
    );
  }

  if (payload.status !== ScheduleStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Draft Schedule Can Only Be Published",
    );
  }

  /*
   * Important:
   * A lawyer might create a draft today and try to publish it
   * after the schedule start time.
   *
   * Never allow such a schedule to become PUBLISHED.
   */
  if (schedule.startDateTime <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Past Schedule Cannot Be Published",
    );
  }

  const updatedSchedule =
    await prisma.schedule.update({
      where: {
        id: scheduleId,
      },
      data: {
        status: ScheduleStatus.PUBLISHED,
      },
      include: {
        lawyer: {
          select: {
            id: true,
            userId: true,
            bio: true,
            experienceYears: true,
            consultationFee: true,
            verificationStatus: true,
          },
        },
      },
    });

  return updatedSchedule;
};

const deleteSchedule = async (
  scheduleId: string,
  user: RequestUser,
) => {
  const lawyer = await getLawyerProfile(user);

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      lawyerId: lawyer.id,
      isDeleted: false,
    },
    include: {
      _count: {
        select: {
          appointments: true,
        },
      },
    },
  });

  if (!schedule) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Schedule Not Found",
    );
  }

  /*
   * Do not delete a schedule which already has
   * appointments or payment history.
   */
  if (schedule._count.appointments > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Schedule With Appointments Cannot Be Deleted",
    );
  }

  const deletedSchedule =
    await prisma.schedule.update({
      where: {
        id: scheduleId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

  return deletedSchedule;
};

const getMySchedules = async (
  query: IQuery,
  user: RequestUser,
) => {
  const lawyer = await getLawyerProfile(user);

  const page = query.page
    ? Number(query.page)
    : 1;

  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const skip = (page - 1) * limit;

  const where: ScheduleWhereInput = {
    lawyerId: lawyer.id,
    isDeleted: false,
  };

  if (query.status) {
    where.status = query.status as ScheduleStatus;
  }

  const [schedules, total] =
    await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          startDateTime: "asc",
        },
        include: {
          lawyer: {
            select: {
              id: true,
              userId: true,
              bio: true,
              experienceYears: true,
              consultationFee: true,
              verificationStatus: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      }),

      prisma.schedule.count({
        where,
      }),
    ]);

  return {
    data: schedules,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(
        total / limit,
      ),
    },
  };
};

const getAvailableSchedules = async (
  query: IQuery,
) => {
  const page = query.page
    ? Number(query.page)
    : 1;

  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const skip = (page - 1) * limit;

  const where: ScheduleWhereInput = {
    status: ScheduleStatus.PUBLISHED,
    isDeleted: false,

    /*
     * Client should only see future schedules.
     */
    startDateTime: {
      gt: new Date(),
    },
    availableSlots: {
      gt: 0,
    },
  };

  if (query.lawyerId) {
    where.lawyerId = query.lawyerId;
  }

  const [schedules, total] =
    await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          startDateTime: "asc",
        },
        include: {
          lawyer: {
            select: {
              id: true,
              userId: true,
              bio: true,
              experienceYears: true,
              consultationFee: true,
              verificationStatus: true,
            },
          },
        },
      }),

      prisma.schedule.count({
        where,
      }),
    ]);

  return {
    data: schedules,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(
        total / limit,
      ),
    },
  };
};

const getScheduleById = async (
  scheduleId: string,
  user: RequestUser,
) => {
  const schedule =
    await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        isDeleted: false,
      },
      include: {
        lawyer: {
          select: {
            id: true,
            userId: true,
            bio: true,
            experienceYears: true,
            consultationFee: true,
            verificationStatus: true,
          },
        },

        appointments: {
          orderBy: {
            joiningTime: "asc",
          },
          select: {
            id: true,
            status: true,
            joiningTime: true,
            serialNumber: true,
            meetingLink: true,
            clientId: true,
          },
        },
      },
    });

  if (!schedule) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Schedule Not Found",
    );
  }

  /*
   * Lawyer can only see their own schedule.
   */
  if (
    user.role === Role.LAWYER &&
    schedule.lawyer.userId !== user.userId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To View This Schedule",
    );
  }

  return schedule;
};

const getAllSchedules = async (
  query: IQuery,
) => {
  const page = query.page
    ? Number(query.page)
    : 1;

  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const skip = (page - 1) * limit;

  const where: ScheduleWhereInput = {
    isDeleted: false,
  };

  if (query.status) {
    where.status = query.status as ScheduleStatus;
  }

  if (query.lawyerId) {
    where.lawyerId = query.lawyerId;
  }

  /*
   * Search lawyer by name/email.
   *
   * The previous code used `doctor`, which does not
   * exist in this system.
   */
  if (query.searchTerm) {
    where.lawyer = {
      OR: [
        {
          name: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    };
  }

  const sortBy =
    query.sortBy === "startDateTime"
      ? "startDateTime"
      : "createdAt";

  const sortOrder =
    query.sortOrder === "asc"
      ? "asc"
      : "desc";

  const [schedules, total] =
    await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          lawyer: {
            select: {
              id: true,
              userId: true,
              bio: true,
              experienceYears: true,
              consultationFee: true,
              verificationStatus: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      }),

      prisma.schedule.count({
        where,
      }),
    ]);

  return {
    data: schedules,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(
        total / limit,
      ),
    },
  };
};

const getTodaysSchedules = async () => {
  const now = new Date();

  const startOfToday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
  const startOfTomorrow = addDays(
    startOfToday,
    1,
  );

  const schedules =
    await prisma.schedule.findMany({
      where: {
        isDeleted: false,
        status: ScheduleStatus.PUBLISHED,
        startDateTime: {
          gte: startOfToday,
          lt: startOfTomorrow,
          gt: now,
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
      include: {
        lawyer: {
          select: {
            id: true,
            userId: true,
            bio: true,
            experienceYears: true,
            consultationFee: true,
            verificationStatus: true,
          },
        },

        appointments: {
          orderBy: {
            joiningTime: "asc",
          },
          select: {
            id: true,
            status: true,
            joiningTime: true,
            serialNumber: true,
            clientId: true,
          },
        },
      },
    });

  return schedules;
};

export const ScheduleServices = {
  createSchedule,
  getMySchedules,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  updateScheduleStatus,
  deleteSchedule,
  getAvailableSchedules,
  getTodaysSchedules,
};

