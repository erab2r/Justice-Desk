import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";

import {
  LawyerVerificationStatus,
  Role,
  ScheduleStatus,
  SpecializationRequestStatus,
} from "../../../../prisma/generated/prisma/enums";
import type { LawyerWhereInput } from "../../../../prisma/generated/prisma/models";

import config from "../../config";
import { IQuery } from "../../interfaces";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

import {
  IApplyAsLawyerPayload,
  IApproveLawyerPayload,
  IUpdateLawyerProfilePayload,
  IVerifyLawyerEmailPayload,
} from "./lawyer.interface";
import { addDays } from "date-fns";


const applyAsLawyer = async (
  payload: IApplyAsLawyerPayload,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  const specializationIds = payload.lawyer.specializationIds ?? [];
  const specializations = await prisma.specialization.findMany({
    where: { id: { in: specializationIds } },
    select: { id: true },
  });

  if (specializations.length !== new Set(specializationIds).size) {
    throw new AppError(httpStatus.BAD_REQUEST, "One Or More Specializations Are Invalid");
  }

  const isUserExists = await prisma.user.findUnique({
    where: { email: payload.user.email },
  });

  if (isUserExists) {
    throw new AppError(httpStatus.CONFLICT, "User Already Exists With This Email");
  }

  const isLicenseUsed = await prisma.lawyer.findUnique({
    where: { licenseNumber: payload.lawyer.licenseNumber },
  });

  if (isLicenseUsed) {
    throw new AppError(httpStatus.CONFLICT, "This License Number Is Already Registered");
  }

  const resumeUploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "auto" }, async (error, result) => {
        if (error) return reject(error);

        if (!result) {
          return reject(
            new AppError(
              httpStatus.INTERNAL_SERVER_ERROR,
              "No Result Returned From Cloudinary",
            ),
          );
        }

        resolve(result);
      })
      .end(resume?.buffer);
  });

  const additionalFilesUploadResults = await Promise.all(
    additionalFiles.map((file) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "auto" }, async (error, result) => {
            if (error) return reject(error);

            if (!result) {
              return reject(new Error("No Result Returned From Cloudinary"));
            }

            resolve(result);
          })
          .end(file.buffer);
      });
    }),
  );

  // const randomLawyerPassword = crypto.randomBytes(9).toString("base64url");
  // const randomLawyerPassword = Math.random().toString(36).slice(-8);
  const randomLawyerPassword = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}@${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;


  const hashedPassword = await bcrypt.hash(
    randomLawyerPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const lawyerApplication = await prisma.$transaction(async (tx) => {
    const { specializationIds: _specializationIds, ...lawyerData } = payload.lawyer;

    return tx.user.create({
      data: {
        name: payload.user.name,
        email: payload.user.email,
        password: hashedPassword,
        role: Role.LAWYER,
        needPasswordChange: true,
        lawyer: {
          create: {
            name: payload.user.name,
            email: payload.user.email,
            ...lawyerData,
            resume: resumeUploadResult.secure_url,
            resumePublicId: resumeUploadResult.public_id,
            additionalFiles: additionalFilesUploadResults.map((file) => ({
              url: file.secure_url,
              publicId: file.public_id,
            })),
            specializationRequests: {
              create: specializationIds.map((specializationId) => ({
                specializationId,
              })),
            },
          },
        },
      },
      include: { lawyer: true },
    });
  });

  const expirationSeconds = 60 * 60;

  const otpKey = `lawyer-application-otp:${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: { type: "EX", value: expirationSeconds },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );

  const templateData = {
    name: payload.user.name,
    email: payload.user.email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: payload.user.email,
    subject: "Lawyer Application - Email Verification",
    html,
  });

  return lawyerApplication;
};

const verifyLawyerEmail = async (payload: IVerifyLawyerEmailPayload) => {
  const otp = payload.otp;
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email, role: Role.LAWYER },
  });

  if (!existingUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Lawyer Application Not Found. Please Apply Again.",
    );
  }

  if (existingUser.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email Already Verified");
  }

  const otpKey = `lawyer-application-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP Expired. Your Application Window Has Closed, Please Apply Again.",
    );
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
  }

  await redisClient.del(otpKey);

  const verifiedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { lawyer: true },
  });

  return verifiedUser;
};

const approveLawyer = async (payload: IApproveLawyerPayload, reviewer: RequestUser) => {
  const { lawyerId, verificationStatus, rejectionReason } = payload;

  const existingLawyer = await prisma.lawyer.findUnique({
    where: { id: lawyerId },
    include: { user: true },
  });

  if (!existingLawyer) {
    throw new AppError(httpStatus.NOT_FOUND, "Lawyer Application Not Found");
  }

  if (existingLawyer.isDeleted) {
    throw new AppError(httpStatus.GONE, "Lawyer Application Has Been Deleted");
  }

  if (!existingLawyer.user.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Lawyer Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  if (existingLawyer.verificationStatus !== LawyerVerificationStatus.PENDING) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Lawyer Application Has Already Been ${existingLawyer.verificationStatus.toLowerCase()}`,
    );
  }

  if (verificationStatus === LawyerVerificationStatus.REJECTED && !rejectionReason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rejection Reason Is Required When Rejecting A Lawyer Application",
    );
  }

  const isApproved = verificationStatus === LawyerVerificationStatus.APPROVED;
  const temporaryPassword = isApproved
    ? `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}@${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`
    : undefined;
  const hashedTemporaryPassword = temporaryPassword
    ? await bcrypt.hash(temporaryPassword, Number(config.bcrypt_salt_rounds))
    : undefined;

  const updatedLawyer = await prisma.$transaction(async (tx) => {
    if (hashedTemporaryPassword) {
      await tx.user.update({
        where: { id: existingLawyer.userId },
        data: {
          password: hashedTemporaryPassword,
          needPasswordChange: true,
        },
      });
    }

    return tx.lawyer.update({
      where: { id: lawyerId },
      data: {
        verificationStatus,
        rejectionReason: isApproved ? null : rejectionReason,
        reviewedBy: reviewer.userId,
        reviewedAt: new Date(),
      },
    });
  });

  const templatePath = path.join(
    process.cwd(),
    `src/app/templates/${
      isApproved ? "lawyer-application-approved.ejs" : "lawyer-application-rejected.ejs"
    }`,
  );

  const templateData = {
    name: updatedLawyer.name,
    reason: updatedLawyer.rejectionReason,
    ...(isApproved && {
      email: updatedLawyer.email,
      temporaryPassword,
    }),
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: updatedLawyer.email,
    subject: isApproved
      ? "Your Lawyer Application Has Been Approved"
      : "Your Lawyer Application Has Been Rejected",
    html,
  });

  return updatedLawyer;
};


const getAllLawyers = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: LawyerWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { licenseNumber: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.email) {
    andConditions.push({ email: { contains: query.email, mode: "insensitive" } });
  }

  if (query.licenseNumber) {
    andConditions.push({
      licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
    });
  }

  if (query.verificationStatus) {
    andConditions.push({
      verificationStatus: query.verificationStatus as LawyerVerificationStatus,
    });
  }

  andConditions.push({ isDeleted: false });

  const [allLawyers, totalLawyerCount] = await Promise.all([
    prisma.lawyer.findMany({
      where: { AND: andConditions },
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: { omit: { password: true } },
        specializations: { include: { specialization: true } },
      },
    }),

    prisma.lawyer.count({ where: { AND: andConditions } }),
  ]);

  return {
    data: allLawyers,
    meta: {
      page,
      limit,
      total: totalLawyerCount,
      totalPages: Math.ceil(totalLawyerCount / limit),
    },
  };
};


const updateLawyerProfile = async (
  payload: IUpdateLawyerProfilePayload,
  user: RequestUser,
) => {
  const existingLawyer = await prisma.lawyer.findUnique({
    where: { userId: user.userId },
  });

  if (!existingLawyer) {
    throw new AppError(httpStatus.NOT_FOUND, "Lawyer Profile Not Found");
  }

  if (existingLawyer.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "Deleted Lawyer Cannot Update Profile");
  }

  const { specializationIds, ...lawyerData } = payload;
  if (specializationIds) {
    const specializations = await prisma.specialization.findMany({
      where: { id: { in: specializationIds } },
      select: { id: true },
    });

    if (specializations.length !== new Set(specializationIds).size) {
      throw new AppError(httpStatus.BAD_REQUEST, "One Or More Specializations Are Invalid");
    }
  }

  const updatedLawyer = await prisma.$transaction(async (tx) => {
    const updated = await tx.lawyer.update({
      where: { id: existingLawyer.id },
      data: lawyerData,
    });

    if (specializationIds) {
      const existingRequests = await tx.lawyerSpecializationRequest.findMany({
        where: {
          lawyerId: existingLawyer.id,
          specializationId: { in: specializationIds },
          status: {
            in: [
              SpecializationRequestStatus.PENDING,
              SpecializationRequestStatus.APPROVED,
            ],
          },
        },
        select: { specializationId: true },
      });
      const existingSpecializationIds = new Set(
        existingRequests.map((request) => request.specializationId),
      );

      await tx.lawyerSpecializationRequest.createMany({
        data: specializationIds
          .filter((specializationId) => !existingSpecializationIds.has(specializationId))
          .map((specializationId) => ({
            lawyerId: existingLawyer.id,
            specializationId,
          })),
      });
    }

    return updated;
  });

  return updatedLawyer;
};

const getAvailableLawyerByTodaysSchedule = async (query: IQuery) => {

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc"

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
  const startOfTomorrow = addDays(startOfToday, 1);

  const andConditions: LawyerWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: LawyerVerificationStatus.APPROVED },
    {
      schedules: {
        some: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        }
      }
    },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        {
          specializations: {
            some: {
              specialization: {
                name: {
                  contains: query.searchTerm,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specializations: {
        some: {
          specialization: {
            name: {
              equals: query.specialization,
              mode: "insensitive",
            },
          },
        },
      },
    });
  }

  const availableLawyers = await prisma.lawyer.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specializations: {
        include: {
          specialization: true,
        },
      },
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
      schedules: {
        where: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
        orderBy: { startDateTime: "asc" },
        select: {
          id: true,
          startDateTime: true,
          endDateTime: true,
        },
      },
    },
  });

  const totalAvailableLawyerCount = await prisma.lawyer.count({
    where: { AND: andConditions },
  });

  return {
    data: availableLawyers,
    meta: {
      page,
      limit,
      total: totalAvailableLawyerCount,
      totalPages: Math.ceil(totalAvailableLawyerCount / limit),
    },
  };
}

const getAllLawyersListPublic = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: LawyerWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: LawyerVerificationStatus.APPROVED },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { qualifications: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const [allLawyers, totalLawyerCount] = await Promise.all([
    prisma.lawyer.findMany({
      where: { AND: andConditions },
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        qualifications: true,
        experienceYears: true,
        bio: true,
        consultationFee: true,
        createdAt: true,
        specializations: { include: { specialization: true } },
      },
    }),

    prisma.lawyer.count({ where: { AND: andConditions } }),
  ]);

  return {
    data: allLawyers,
    meta: {
      page,
      limit,
      total: totalLawyerCount,
      totalPages: Math.ceil(totalLawyerCount / limit),
    },
  };
};

const getSingleLawyerPublicProfile = async (lawyerId: string) => {
  const lawyer = await prisma.lawyer.findUnique({
    where: {
      id: lawyerId,
      isDeleted: false,
      verificationStatus: LawyerVerificationStatus.APPROVED,
    },
    select: {
      id: true,
      name: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
      specializations: { include: { specialization: true } },
    },
  });

  if (!lawyer) {
    throw new AppError(httpStatus.NOT_FOUND, "Lawyer Not Found");
  }

  return lawyer;
};

export const LawyerServices = {
  applyAsLawyer,
  verifyLawyerEmail,
  approveLawyer,
  getAllLawyers,
  updateLawyerProfile,
  getAvailableLawyerByTodaysSchedule,
  getAllLawyersListPublic,
  getSingleLawyerPublicProfile,
};



















