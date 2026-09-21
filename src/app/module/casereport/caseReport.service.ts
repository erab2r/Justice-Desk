
import httpStatus from "http-status";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

import {
  Role,
} from "../../../../prisma/generated/prisma/enums";

import type {
  CaseReportWhereInput,
} from "../../../../prisma/generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { IQuery } from "../../interfaces";
import { ICreateCaseReportPayload, IUpdateCaseReportPayload } from "./caseReport.interface";

const generateReportPdf = async (
  title: string,
  summary: string | undefined,
  caseData: {
    caseNumber: string;
    caseTitle: string;
    caseType: string | null;
    status: string;
    priority: string;
    clientName: string;
    clientEmail: string;
    lawyerName: string;
    lawyerEmail: string;
    courtName: string | null;
    courtCaseNumber: string | null;
  },
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      margin: 50,
    });

    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    document.on("error", (error) => {
      reject(error);
    });

    document
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Legal Case Report", {
        align: "center",
      });

    document.moveDown();

    document
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(title, {
        align: "center",
      });

    document.moveDown(2);

    document
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Case Information");

    document.moveDown(0.5);

    document
      .fontSize(10)
      .font("Helvetica")
      .text(`Case Number: ${caseData.caseNumber}`)
      .text(`Case Title: ${caseData.caseTitle}`)
      .text(`Case Type: ${caseData.caseType ?? "N/A"}`)
      .text(`Status: ${caseData.status}`)
      .text(`Priority: ${caseData.priority}`)
      .text(`Court Name: ${caseData.courtName ?? "N/A"}`)
      .text(
        `Court Case Number: ${
          caseData.courtCaseNumber ?? "N/A"
        }`,
      );

    document.moveDown();

    document
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Client Information");

    document.moveDown(0.5);

    document
      .fontSize(10)
      .font("Helvetica")
      .text(`Name: ${caseData.clientName}`)
      .text(`Email: ${caseData.clientEmail}`);

    document.moveDown();

    document
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Lawyer Information");

    document.moveDown(0.5);

    document
      .fontSize(10)
      .font("Helvetica")
      .text(`Name: ${caseData.lawyerName}`)
      .text(`Email: ${caseData.lawyerEmail}`);

    document.moveDown();

    document
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Report Summary");

    document.moveDown(0.5);

    document
      .fontSize(10)
      .font("Helvetica")
      .text(summary ?? "No summary provided.");

    document.moveDown(2);

    document
      .fontSize(9)
      .font("Helvetica")
      .text(
        `Generated At: ${new Date().toLocaleString()}`,
      );

    document.end();
  });
};
const uploadReportToCloudinary = async (
  pdfBuffer: Buffer,
  caseNumber: string,
): Promise<{
  secure_url: string;
  public_id: string;
}> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "case-reports",
        public_id: `case-report-${caseNumber}-${Date.now()}`,
        resource_type: "raw",
        format: "pdf",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(
            new Error(
              "Cloudinary did not return upload result.",
            ),
          );
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    Readable.from(pdfBuffer).pipe(uploadStream);
  });
};
const deleteReportFromCloudinary = async (
  publicId: string,
) => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });
  } catch (error) {
    console.error(
      "Failed to delete case report from Cloudinary:",
      error,
    );
  }
};
const getCaseForReport = async (caseId: string) => {
  const caseData = await prisma.case.findUnique({
    where: {
      id: caseId,
    },

    include: {
      client: {
        select: {
          id: true,
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

  return caseData;
};

const createCaseReport = async (
  payload: ICreateCaseReportPayload,
  user: RequestUser,
) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyers Can Create Case Reports",
    );
  }

  const caseData = await getCaseForReport(
    payload.caseId,
  );

  if (caseData.lawyer.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Create A Report For This Case",
    );
  }
  const pdfBuffer = await generateReportPdf(
    payload.title,
    payload.summary,
    {
      caseNumber: caseData.caseNumber,
      caseTitle: caseData.title,
      caseType: caseData.caseType,
      status: caseData.status,
      priority: caseData.priority,
      clientName: caseData.client.name,
      clientEmail: caseData.client.email,
      lawyerName: caseData.lawyer.name,
      lawyerEmail: caseData.lawyer.email,
      courtName: caseData.courtName,
      courtCaseNumber: caseData.courtCaseNumber,
    },
  );

  const uploadedReport =
    await uploadReportToCloudinary(
      pdfBuffer,
      caseData.caseNumber,
    );

  try {

    const report = await prisma.caseReport.create({
      data: {
        title: payload.title,
        summary: payload.summary,

        reportUrl:
          payload.reportUrl ??
          uploadedReport.secure_url,

        reportPublicId:
          payload.reportPublicId ??
          uploadedReport.public_id,

        generatedById:
          payload.generatedById ??
          user.userId,

        caseId: payload.caseId,
      },

      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
            status: true,
            priority: true,
          },
        },

        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return report;
  } catch (error) {

    await deleteReportFromCloudinary(
      uploadedReport.public_id,
    );

    throw error;
  }
};

const getCaseReportById = async (
  reportId: string,
  user: RequestUser,
) => {
  const report = await prisma.caseReport.findUnique({
    where: {
      id: reportId,
    },

    include: {
      case: {
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
            },
          },
        },
      },

      generatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!report) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case Report Not Found",
    );
  }

  if (user.role === Role.CLIENT) {
    if (
      report.case.client.userId !== user.userId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Case Report",
      );
    }
  }


  if (user.role === Role.LAWYER) {
    if (
      report.case.lawyer.userId !== user.userId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Case Report",
      );
    }
  }

  return report;
};
const getCaseReports = async (
  caseId: string,
  user: RequestUser,
) => {
  const caseData = await getCaseForReport(caseId);

  if (user.role === Role.CLIENT) {
    const client = await prisma.client.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (
      !client ||
      client.id !== caseData.client.id
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View Reports For This Case",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (
      caseData.lawyer.userId !== user.userId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View Reports For This Case",
      );
    }
  }

  return await prisma.caseReport.findMany({
    where: {
      caseId,
    },

    orderBy: {
      createdAt: "desc",
    },

    include: {
      generatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
};

const getMyReports = async (
  query: IQuery,
  user: RequestUser,
) => {
  if (user.role !== Role.LAWYER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Lawyers Can View Their Reports",
    );
  }

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

  const andConditions: CaseReportWhereInput[] = [
    {
      case: {
        lawyerId: lawyer.id,
      },
    },
  ];

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
          summary: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          case: {
            caseNumber: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          case: {
            title: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder =
    query.sortOrder === "asc" ? "asc" : "desc";

  const reports = await prisma.caseReport.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
          priority: true,
        },
      },

      generatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const total = await prisma.caseReport.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: reports,

    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
const getAllReports = async (
  query: IQuery,
) => {
  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const page = query.page
    ? Number(query.page)
    : 1;

  const skip = (page - 1) * limit;

  const andConditions: CaseReportWhereInput[] = [];

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
          summary: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          case: {
            caseNumber: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          case: {
            title: {
              contains: query.searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (query.lawyerId) {
    andConditions.push({
      case: {
        lawyerId: query.lawyerId,
      },
    });
  }

  if (query.clientId) {
    andConditions.push({
      case: {
        clientId: query.clientId,
      },
    });
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder =
    query.sortOrder === "asc" ? "asc" : "desc";

  const reports = await prisma.caseReport.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
          priority: true,

          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          lawyer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },

      generatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const total = await prisma.caseReport.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: reports,

    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateCaseReport = async (
  reportId: string,
  payload: IUpdateCaseReportPayload,
  user: RequestUser,
) => {
  const report = await prisma.caseReport.findUnique({
    where: {
      id: reportId,
    },

    include: {
      case: {
        include: {
          lawyer: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case Report Not Found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (
      report.case.lawyer.userId !== user.userId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Update This Case Report",
      );
    }
  } else if (
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Update This Case Report",
    );
  }

  const updatedReport =
    await prisma.caseReport.update({
      where: {
        id: reportId,
      },

      data: {
        title: payload.title,
        summary: payload.summary,
        reportUrl: payload.reportUrl,
        reportPublicId: payload.reportPublicId,
      },

      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
            status: true,
            priority: true,
          },
        },

        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

  return updatedReport;
};

const deleteCaseReport = async (
  reportId: string,
  user: RequestUser,
) => {
  const report = await prisma.caseReport.findUnique({
    where: {
      id: reportId,
    },

    include: {
      case: {
        include: {
          lawyer: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case Report Not Found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (
      report.case.lawyer.userId !== user.userId
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Delete This Case Report",
      );
    }
  } else if (
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Delete This Case Report",
    );
  }

  const deletedReport =
    await prisma.caseReport.delete({
      where: {
        id: reportId,
      },
    });

  if (report.reportPublicId) {
    await deleteReportFromCloudinary(
      report.reportPublicId,
    );
  }

  return deletedReport;
};


export const CaseReportServices = {
  createCaseReport,
  getCaseReportById,
  getCaseReports,
  getMyReports,
  getAllReports,
  updateCaseReport,
  deleteCaseReport,
};


