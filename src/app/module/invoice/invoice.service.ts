
import httpStatus from "http-status";
import PDFDocument from "pdfkit";
import type {
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";
import {
  InvoiceStatus,
  Role,
} from "../../../../prisma/generated/prisma/enums";

import type {
  InvoiceWhereInput,
} from "../../../../prisma/generated/prisma/models";

import type {
  ICreateInvoicePayload,
  IUpdateInvoicePayload,
  IUpdateInvoiceStatusPayload,
} from "./invoice.interface";

import type { RequestUser } from "../../middleware/checkAuth";


import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";
import type { IQuery } from "../../interfaces";
import { Readable } from "stream";



const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `INV-${timestamp}-${randomNumber}`;
};


const generateInvoicePdf = async (
  invoice: {
    invoiceNumber: string;
    amount: unknown;
    tax: unknown;
    totalAmount: unknown;
    currency: string;
    status: InvoiceStatus;
    invoiceDate: Date;
    dueDate: Date | null;
    description: string | null;
    case: {
      caseNumber: string;
      title: string;
    };
    client: {
      name: string;
      user: {
        email: string;
      };
    };
    lawyer: {
      name: string;
      user: {
        email: string;
      };
    };
  },
): Promise<{
  url: string;
  publicId: string;
}> => {
  const document = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  const chunks: Buffer[] = [];

  document.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const uploadPromise = new Promise<{
    url: string;
    publicId: string;
  }>((resolve, reject) => {
    document.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "invoices",
          public_id: invoice.invoiceNumber,
          format: "pdf",
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error || !result) {
            reject(
              new AppError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Invoice PDF Upload Failed",
              ),
            );

            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      const readable = Readable.from(pdfBuffer);
      readable.pipe(uploadStream);
    });
  });

  document
    .fontSize(24)
    .text("LEGAL CONSULTATION INVOICE", {
      align: "center",
    });

  document.moveDown(1);

  document
    .fontSize(12)
    .text(`Invoice Number: ${invoice.invoiceNumber}`);

  document.text(
    `Invoice Date: ${invoice.invoiceDate.toLocaleDateString()}`,
  );

  if (invoice.dueDate) {
    document.text(
      `Due Date: ${invoice.dueDate.toLocaleDateString()}`,
    );
  }

  document.moveDown(1);

  document
    .fontSize(14)
    .text("Case Information", {
      underline: true,
    });

  document.moveDown(0.5);

  document
    .fontSize(11)
    .text(`Case Number: ${invoice.case.caseNumber}`);

  document.text(`Case Title: ${invoice.case.title}`);

  document.moveDown(1);

  document
    .fontSize(14)
    .text("Client Information", {
      underline: true,
    });

  document.moveDown(0.5);

  document.fontSize(11).text(`Name: ${invoice.client.name}`);

  document.text(`Email: ${invoice.client.user.email}`);

  document.moveDown(1);

  document
    .fontSize(14)
    .text("Lawyer Information", {
      underline: true,
    });

  document.moveDown(0.5);

  document.fontSize(11).text(`Name: ${invoice.lawyer.name}`);

  document.text(`Email: ${invoice.lawyer.user.email}`);

  document.moveDown(1);

  document
    .fontSize(14)
    .text("Payment Information", {
      underline: true,
    });

  document.moveDown(0.5);

  document
    .fontSize(11)
    .text(`Amount: ${invoice.amount} ${invoice.currency}`);

  document.text(`Tax: ${invoice.tax} ${invoice.currency}`);

  document
    .fontSize(13)
    .text(`Total Amount: ${invoice.totalAmount} ${invoice.currency}`);

  document.text(`Status: ${invoice.status}`);

  if (invoice.description) {
    document.moveDown(1);

    document
      .fontSize(14)
      .text("Description", {
        underline: true,
      });

    document.moveDown(0.5);

    document
      .fontSize(11)
      .text(invoice.description);
  }

  document.moveDown(2);

  document
    .fontSize(10)
    .text(
      "Thank you for using our legal consultation service.",
      {
        align: "center",
      },
    );

  document.end();

  return uploadPromise;
};


const createInvoice = async (
  payload: ICreateInvoicePayload,
  user: RequestUser,
) => {
  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Create An Invoice",
    );
  }

  const caseData = await prisma.case.findUnique({
    where: {
      id: payload.caseId,
    },
    include: {
      client: {
        include: {
          user: true,
        },
      },
      lawyer: {
        include: {
          user: true,
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

  if (user.role === Role.LAWYER) {
    if (caseData.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Assigned To This Case",
      );
    }
  }

  if (payload.clientId !== caseData.clientId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Client Does Not Belong To This Case",
    );
  }

  if (payload.lawyerId !== caseData.lawyerId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Lawyer Does Not Belong To This Case",
    );
  }

  const amount = Number(payload.amount);
  const tax = Number(payload.tax ?? 0);
  const totalAmount = amount + tax;

  const invoiceNumber = generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      amount,
      tax,
      totalAmount,
      currency: payload.currency ?? "BDT",
      dueDate: payload.dueDate
        ? new Date(payload.dueDate)
        : undefined,
      description: payload.description,
      caseId: payload.caseId,
      clientId: payload.clientId,
      lawyerId: payload.lawyerId,
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
        },
      },
      client: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      lawyer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  let pdf: {
    url: string;
    publicId: string;
  };

  try {
    pdf = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      description: invoice.description,
      case: {
        caseNumber: invoice.case.caseNumber,
        title: invoice.case.title,
      },
      client: {
        name: invoice.client.name,
        user: {
          email: invoice.client.user.email,
        },
      },
      lawyer: {
        name: invoice.lawyer.name,
        user: {
          email: invoice.lawyer.user.email,
        },
      },
    });
  } catch (error) {
    await prisma.invoice.delete({
      where: {
        id: invoice.id,
      },
    });

    throw error;
  }

  const updatedInvoice = await prisma.invoice.update({
    where: {
      id: invoice.id,
    },
    data: {
      pdfUrl: pdf.url,
      pdfPublicId: pdf.publicId,
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
        },
      },
      client: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      lawyer: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return updatedInvoice;
};


const getInvoiceById = async (
  invoiceId: string,
  user: RequestUser,
) => {
  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
        },
      },
      client: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      lawyer: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invoice Not Found",
    );
  }

  if (user.role === Role.CLIENT) {
    if (invoice.client.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Invoice",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (invoice.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Invoice",
      );
    }
  }

  return invoice;
};


const getInvoicesByCase = async (
  caseId: string,
  user: RequestUser,
) => {
  const caseData = await prisma.case.findUnique({
    where: {
      id: caseId,
    },
    select: {
      id: true,
      client: {
        select: {
          userId: true,
        },
      },
      lawyer: {
        select: {
          userId: true,
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
        "You Are Not Allowed To View These Invoices",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (caseData.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View These Invoices",
      );
    }
  }

  return prisma.invoice.findMany({
    where: {
      caseId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      lawyer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      invoiceDate: "desc",
    },
  });
};


const getMyInvoices = async (
  query: IQuery,
  user: RequestUser,
) => {
  if (
    user.role !== Role.CLIENT &&
    user.role !== Role.LAWYER
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This Endpoint Is Only Available For Clients And Lawyers",
    );
  }

  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const page = query.page
    ? Number(query.page)
    : 1;

  const skip = (page - 1) * limit;

  const where: InvoiceWhereInput =
    user.role === Role.CLIENT
      ? {
          client: {
            userId: user.userId,
          },
        }
      : {
          lawyer: {
            userId: user.userId,
          },
        };

  if (query.status) {
    where.status = query.status as InvoiceStatus;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        invoiceDate: "desc",
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        lawyer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.invoice.count({
      where,
    }),
  ]);

  return {
    data: invoices,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const getAllInvoices = async (
  query: IQuery,
) => {
  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const page = query.page
    ? Number(query.page)
    : 1;

  const skip = (page - 1) * limit;

  const where: InvoiceWhereInput = {};

  if (query.status) {
    where.status = query.status as InvoiceStatus;
  }

  if (query.searchTerm) {
    where.OR = [
      {
        invoiceNumber: {
          contains: query.searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
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
    ];
  }

  const sortBy =
    query.sortBy === "amount"
      ? "amount"
      : query.sortBy === "totalAmount"
        ? "totalAmount"
        : "invoiceDate";

  const sortOrder =
    query.sortOrder === "asc"
      ? "asc"
      : "desc";

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            title: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        lawyer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.invoice.count({
      where,
    }),
  ]);

  return {
    data: invoices,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const updateInvoice = async (
  invoiceId: string,
  payload: IUpdateInvoicePayload,
  user: RequestUser,
) => {
  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Update An Invoice",
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      case: {
        include: {
          lawyer: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invoice Not Found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (invoice.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Update This Invoice",
      );
    }
  }

  const amount =
    payload.amount !== undefined
      ? payload.amount
      : Number(invoice.amount);

  const tax =
    payload.tax !== undefined
      ? payload.tax
      : Number(invoice.tax);

  const totalAmount = amount + tax;

  const updatedInvoice = await prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      ...(payload.amount !== undefined && {
        amount: payload.amount,
      }),
      ...(payload.tax !== undefined && {
        tax: payload.tax,
      }),
      ...(payload.currency !== undefined && {
        currency: payload.currency,
      }),
      ...(payload.dueDate !== undefined && {
        dueDate: new Date(payload.dueDate),
      }),
      ...(payload.description !== undefined && {
        description: payload.description,
      }),
      totalAmount,
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      lawyer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updatedInvoice;
};


const updateInvoiceStatus = async (
  invoiceId: string,
  payload: IUpdateInvoiceStatusPayload,
  user: RequestUser,
) => {
  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Update Invoice Status",
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      lawyer: true,
    },
  });

  if (!invoice) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invoice Not Found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (invoice.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Update This Invoice",
      );
    }
  }

  const updatedInvoice = await prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      status: payload.status,
    },
  });

  return updatedInvoice;
};


const regenerateInvoicePdf = async (
  invoiceId: string,
  user: RequestUser,
) => {
  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Generate Invoice PDF",
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      case: {
        select: {
          caseNumber: true,
          title: true,
        },
      },
      client: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      lawyer: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invoice Not Found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (invoice.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Generate This Invoice PDF",
      );
    }
  }

  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    tax: invoice.tax,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    description: invoice.description,
    case: invoice.case,
    client: {
      name: invoice.client.name,
      user: invoice.client.user,
    },
    lawyer: {
      name: invoice.lawyer.name,
      user: invoice.lawyer.user,
    },
  });

  if (invoice.pdfPublicId) {
    await cloudinary.uploader.destroy(
      invoice.pdfPublicId,
      {
        resource_type: "raw",
      },
    );
  }

  return prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      pdfUrl: pdf.url,
      pdfPublicId: pdf.publicId,
    },
  });
};


const deleteInvoice = async (
  invoiceId: string,
  user: RequestUser,
) => {
  if (
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Admin Can Delete An Invoice",
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
  });

  if (!invoice) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invoice Not Found",
    );
  }

  if (invoice.pdfPublicId) {
    await cloudinary.uploader.destroy(
      invoice.pdfPublicId,
      {
        resource_type: "raw",
      },
    );
  }

  await prisma.invoice.delete({
    where: {
      id: invoiceId,
    },
  });

  return null;
};


export const InvoiceServices = {
  createInvoice,
  getInvoiceById,
  getInvoicesByCase,
  getMyInvoices,
  getAllInvoices,
  updateInvoice,
  updateInvoiceStatus,
  regenerateInvoicePdf,
  deleteInvoice,
};

