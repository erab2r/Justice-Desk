
import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { LawyerNoteServices } from "./lawyernote.service";

export const createNote = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LawyerNoteServices.createNote(
      {
        ...req.body,
        caseId: req.params.caseId,
      },
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Lawyer Note Created Successfully",
      data: result,
    });
  },
);

export const getNotesByCase = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LawyerNoteServices.getNotesByCase(
      req.params.caseId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lawyer Notes Retrieved Successfully",
      data: result,
    });
  },
);

export const getNoteById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LawyerNoteServices.getNoteById(
      req.params.noteId as string,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lawyer Note Retrieved Successfully",
      data: result,
    });
  },
);

export const updateNote = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LawyerNoteServices.updateNote(
      req.params.noteId as string,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lawyer Note Updated Successfully",
      data: result,
    });
  },
);

export const deleteNote = catchAsync(
  async (req: Request, res: Response) => {
    const result = await LawyerNoteServices.deleteNote(
      req.params.noteId as string ,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lawyer Note Deleted Successfully",
      data: result,
    });
  },
);

export const LawyerNoteControllers = {
  createNote,
  getNotesByCase,
  getNoteById,
  updateNote,
  deleteNote,
};

