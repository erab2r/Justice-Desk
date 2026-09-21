import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SpecializationServices } from "./specialization.service";

export const createSpecialization = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SpecializationServices.createSpecialization(
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Specialization Created Successfully",
      data: result,
    });
  },
);

export const getAllSpecializations = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.getAllSpecializations();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specializations Retrieved Successfully",
      data: result,
    });
  },
);

export const getSpecializationById = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.getSpecializationById(
        req.params.specializationId as string,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Retrieved Successfully",
      data: result,
    });
  },
);

export const updateSpecialization = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.updateSpecialization(
        req.params.specializationId as string,
        req.body,
        req.user!,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Updated Successfully",
      data: result,
    });
  },
);

export const deleteSpecialization = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.deleteSpecialization(
        req.params.specializationId as string,
        req.user!,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Deleted Successfully",
      data: result,
    });
  },
);

export const assignSpecialization = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.requestSpecialization(
        req.body,
        req.user!,
      );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Specialization Request Submitted Successfully",
      data: result,
    });
  },
);

export const removeSpecialization = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.removeSpecialization(
        req.params.specializationId as string,
        req.user!,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Removed Successfully",
      data: result,
    });
  },
);

export const getMySpecializations = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.getMySpecializations(
        req.user!,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My Specializations Retrieved Successfully",
      data: result,
    });
  },
);

export const getLawyerSpecializations = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SpecializationServices.getLawyerSpecializations(
        req.params.lawyerId as string,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Lawyer Specializations Retrieved Successfully",
      data: result,
    });
  },
);

export const getSpecializationRequests = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SpecializationServices.getSpecializationRequests();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Requests Retrieved Successfully",
      data: result,
    });
  },
);

export const reviewSpecializationRequest = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SpecializationServices.reviewSpecializationRequest(
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specialization Request Reviewed Successfully",
      data: result,
    });
  },
);

export const SpecializationControllers = {
  createSpecialization,
  getAllSpecializations,
  getSpecializationById,
  updateSpecialization,
  deleteSpecialization,
  assignSpecialization,
  removeSpecialization,
  getMySpecializations,
  getLawyerSpecializations,
  getSpecializationRequests,
  reviewSpecializationRequest,
};