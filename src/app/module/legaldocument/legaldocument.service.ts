import httpStatus from "http-status";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { ICreateLegalDocumentPayload, IUpdateLegalDocumentPayload } from "./legaldocument.interface";


const createLegalDocument = async (
  payload: ICreateLegalDocumentPayload,
  user: RequestUser,
) => {
  const caseData = await prisma.case.findUnique({
    where: {
      id: payload.caseId,
    },
    include: {
      client: true,
      lawyer: true,
    },
  });

  if (!caseData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case Not Found",
    );
  }

  let clientId: string | null = null;

  if (user.role === Role.CLIENT) {
    if (caseData.client.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Upload Documents To This Case",
      );
    }

    clientId = caseData.clientId;
  } else if (user.role === Role.LAWYER) {
    if (caseData.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not The Assigned Lawyer Of This Case",
      );
    }

  } else if (
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Upload Legal Documents",
    );
  }

  const document = await prisma.legalDocument.create({
    data: {
      title: payload.title,
      description: payload.description,
      fileUrl: payload.fileUrl,
      filePublicId: payload.filePublicId,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      documentType: payload.documentType,
      uploadedById: user.userId,
      caseId: payload.caseId,
      clientId,
      lawyerId: caseData.lawyerId,
    },
    include: {
      uploadedBy: true,
      case: true,
      client: true,
      lawyer: true,
    },
  });

  return document;
};

const getLegalDocumentById = async (
  documentId: string,
  user: RequestUser,
) => {
  const document = await prisma.legalDocument.findUnique({
    where: {
      id: documentId,
    },
    include: {
      uploadedBy: true,
      case: {
        include: {
          client: true,
          lawyer: true,
        },
      },
      client: true,
      lawyer: true,
    },
  });

  if (!document) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Legal Document Not Found",
    );
  }

  if (user.role === Role.CLIENT) {
    if (document.case.client.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Document",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (document.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To View This Document",
      );
    }
  }

  return document;
};

const getDocumentsByCase = async (
  caseId: string,
  user: RequestUser,
) => {
  const caseData = await prisma.case.findUnique({
    where: {
      id: caseId,
    },
    include: {
      client: true,
      lawyer: true,
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
        "You Are Not Allowed To View Documents Of This Case",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (caseData.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not The Assigned Lawyer Of This Case",
      );
    }
  }

  const documents = await prisma.legalDocument.findMany({
    where: {
      caseId,
    },
    include: {
      uploadedBy: true,
      client: true,
      lawyer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return documents;
};

const getMyDocuments = async (user: RequestUser) => {
  if (
    user.role !== Role.CLIENT &&
    user.role !== Role.LAWYER
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only Client And Lawyer Can View Their Documents",
    );
  }

  if (user.role === Role.CLIENT) {
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

    return prisma.legalDocument.findMany({
      where: {
        clientId: client.id,
      },
      include: {
        uploadedBy: true,
        case: true,
        lawyer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
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

  return prisma.legalDocument.findMany({
    where: {
      lawyerId: lawyer.id,
    },
    include: {
      uploadedBy: true,
      case: true,
      client: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

const updateLegalDocument = async (
  documentId: string,
  payload: IUpdateLegalDocumentPayload,
  user: RequestUser,
) => {
  const document = await prisma.legalDocument.findUnique({
    where: {
      id: documentId,
    },
    include: {
      case: {
        include: {
          lawyer: true,
          client: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Legal Document Not Found",
    );
  }

  if (user.role === Role.CLIENT) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Client Cannot Update Legal Documents",
    );
  }

  if (user.role === Role.LAWYER) {
    if (document.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Update This Document",
      );
    }
  }

  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Update Legal Documents",
    );
  }

  const updatedDocument = await prisma.legalDocument.update({
    where: {
      id: documentId,
    },
    data: {
      title: payload.title,
      description: payload.description,
      documentType: payload.documentType,
    },
    include: {
      uploadedBy: true,
      case: true,
      client: true,
      lawyer: true,
    },
  });

  return updatedDocument;
};

const deleteLegalDocument = async (
  documentId: string,
  user: RequestUser,
) => {
  const document = await prisma.legalDocument.findUnique({
    where: {
      id: documentId,
    },
    include: {
      case: {
        include: {
          lawyer: true,
          client: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Legal Document Not Found",
    );
  }

  if (user.role === Role.CLIENT) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Client Cannot Delete Legal Documents",
    );
  }

  if (user.role === Role.LAWYER) {
    if (document.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You Are Not Allowed To Delete This Document",
      );
    }
  }

  if (
    user.role !== Role.LAWYER &&
    user.role !== Role.ADMIN &&
    user.role !== Role.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You Are Not Allowed To Delete Legal Documents",
    );
  }

  await prisma.legalDocument.delete({
    where: {
      id: documentId,
    },
  });

  return null;
};

export const LegalDocumentServices = {
  createLegalDocument,
  getLegalDocumentById,
  getDocumentsByCase,
  getMyDocuments,
  updateLegalDocument,
  deleteLegalDocument,
};