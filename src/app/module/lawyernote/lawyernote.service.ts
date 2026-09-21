
import httpStatus from "http-status";

import { Role } from "../../../../prisma/generated/prisma/enums";

import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
  ICreateLawyerNotePayload,
  IUpdateLawyerNotePayload,
} from "./lawyernote.interface";

const createNote = async (
  payload: ICreateLawyerNotePayload,
  user: RequestUser,
) => {
  if (user.role !== Role.LAWYER && user.role !== Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only lawyers and admins can create notes",
    );
  }

  const caseData = await prisma.case.findUnique({
    where: {
      id: payload.caseId,
    },
  });

  if (!caseData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case not found",
    );
  }

  let lawyerId = caseData.lawyerId;

  if (user.role === Role.LAWYER) {
    const lawyer = await prisma.lawyer.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (!lawyer) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Lawyer profile not found",
      );
    }

    if (caseData.lawyerId !== lawyer.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only create notes for your assigned cases",
      );
    }

    lawyerId = lawyer.id;
  }

  const note = await prisma.lawyerNote.create({
    data: {
      title: payload.title,
      content: payload.content,
      isPrivate: payload.isPrivate ?? true,
      caseId: payload.caseId,
      lawyerId,
    },
    include: {
      case: true,
      lawyer: true,
    },
  });

  return note;
};

const getNotesByCase = async (
  caseId: string,
  user: RequestUser,
) => {
  const caseData = await prisma.case.findUnique({
    where: {
      id: caseId,
    },
    include: {
      lawyer: true,
      client: true,
    },
  });

  if (!caseData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Case not found",
    );
  }

  if (user.role === Role.CLIENT) {
    if (caseData.client.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only access notes from your own cases",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (caseData.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only access notes from your assigned cases",
      );
    }
  }

  const whereCondition =
    user.role === Role.CLIENT
      ? {
          caseId,
          isPrivate: false,
        }
      : {
          caseId,
        };

  const notes = await prisma.lawyerNote.findMany({
    where: whereCondition,
    include: {
      case: true,
      lawyer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return notes;
};

const getNoteById = async (
  noteId: string,
  user: RequestUser,
) => {
  const note = await prisma.lawyerNote.findUnique({
    where: {
      id: noteId,
    },
    include: {
      case: {
        include: {
          client: true,
          lawyer: true,
        },
      },
      lawyer: true,
    },
  });

  if (!note) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Note not found",
    );
  }

  if (user.role === Role.CLIENT) {
    if (note.case.client.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only access notes from your own cases",
      );
    }

    if (note.isPrivate) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "This note is private",
      );
    }
  }

  if (user.role === Role.LAWYER) {
    if (note.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only access notes from your assigned cases",
      );
    }
  }

  return note;
};

const updateNote = async (
  noteId: string,
  payload: IUpdateLawyerNotePayload,
  user: RequestUser,
) => {
  const note = await prisma.lawyerNote.findUnique({
    where: {
      id: noteId,
    },
    include: {
      case: {
        include: {
          lawyer: true,
        },
      },
    },
  });

  if (!note) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Note not found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (note.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only update notes from your assigned cases",
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
      "You are not allowed to update this note",
    );
  }

  const updatedNote = await prisma.lawyerNote.update({
    where: {
      id: noteId,
    },
    data: payload,
    include: {
      case: true,
      lawyer: true,
    },
  });

  return updatedNote;
};

const deleteNote = async (
  noteId: string,
  user: RequestUser,
) => {
  const note = await prisma.lawyerNote.findUnique({
    where: {
      id: noteId,
    },
    include: {
      case: {
        include: {
          lawyer: true,
        },
      },
    },
  });

  if (!note) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Note not found",
    );
  }

  if (user.role === Role.LAWYER) {
    if (note.case.lawyer.userId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only delete notes from your assigned cases",
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
      "You are not allowed to delete this note",
    );
  }

  const deletedNote = await prisma.lawyerNote.delete({
    where: {
      id: noteId,
    },
  });

  return deletedNote;
};

export const LawyerNoteServices = {
  createNote,
  getNotesByCase,
  getNoteById,
  updateNote,
  deleteNote,
};


