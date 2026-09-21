import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { CaseServices } from "./case.service";


const createCase = catchAsync(async (req: Request, res: Response) => {
    const result = await CaseServices.createCase(
        req.body,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Case Created Successfully",
        data: result,
    });
});

const getMyCases = catchAsync(async (req: Request, res: Response) => {
    const result = await CaseServices.getMyCases(
        req.query,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "My Cases Retrieved Successfully",
        data: result.data,
        meta: result.meta,
    });
});


const getLawyerCases = catchAsync(async (req: Request, res: Response) => {
    const result = await CaseServices.getLawyerCases(
        req.query,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Lawyer Cases Retrieved Successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getAllCases = catchAsync(async (req: Request, res: Response) => {
    const result = await CaseServices.getAllCases(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "All Cases Retrieved Successfully",
        data: result.data,
        meta: result.meta,
    });
});


const getCaseById = catchAsync(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    const result = await CaseServices.getCaseById(
        caseId as string,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Case Retrieved Successfully",
        data: result,
    });
});

const updateCase = catchAsync(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    const result = await CaseServices.updateCase(
        caseId as string,
        req.body,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Case Updated Successfully",
        data: result,
    });
});

const changeCaseStatus = catchAsync(
    async (req: Request, res: Response) => {
        const { caseId } = req.params;

        const result = await CaseServices.changeCaseStatus(
            caseId as string,
            req.body,
            req.user!,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Case Status Updated Successfully",
            data: result,
        });
    },
);

const assignLawyer = catchAsync(
    async (req: Request, res: Response) => {
        const { caseId } = req.params;

        const result = await CaseServices.assignLawyer(
            caseId as string,
            req.body,
            req.user!,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Lawyer Assigned Successfully",
            data: result,
        });
    },
);


const closeCase = catchAsync(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    const result = await CaseServices.closeCase(
        caseId as string,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Case Closed Successfully",
        data: result,
    });
});


const deleteCase = catchAsync(async (req: Request, res: Response) => {
    const { caseId } = req.params;

    await CaseServices.deleteCase(
        caseId as string,
        req.user!,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Case Deleted Successfully",
        data: null,
    });
});



export const CaseControllers = {
    createCase,
    getMyCases,
    getLawyerCases,
    getAllCases,
    getCaseById,
    updateCase,
    changeCaseStatus,
    assignLawyer,
    closeCase,
    deleteCase,
};