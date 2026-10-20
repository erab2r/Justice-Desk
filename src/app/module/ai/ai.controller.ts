import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AiServices } from "./ai.service";

const analyzeIntake = catchAsync(async (req: Request, res: Response) => {
	const result = await AiServices.analyzeIntake(req.body.prompt);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Legal intake analyzed successfully.",
		data: result,
	});
});

const analyzeDocument = catchAsync(async (req: Request, res: Response) => {
	const { documentName, documentType, documentText } = req.body;
	const result = await AiServices.analyzeDocument(
		{ documentName, documentType },
		documentText,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Document analyzed successfully.",
		data: {
			documentName: documentName || "Legal document",
			...result,
		},
	});
});

export const AiControllers = {
	analyzeIntake,
	analyzeDocument,
};
