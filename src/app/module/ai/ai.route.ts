import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AiControllers } from "./ai.controller";
import {
	AnalyzeDocumentValidationSchema,
	AnalyzeIntakeValidationSchema,
} from "./ai.validation";

const router = Router();

router.post(
	"/intake",
	validateRequest(AnalyzeIntakeValidationSchema),
	AiControllers.analyzeIntake,
);

router.post(
	"/analyze-document",
	validateRequest(AnalyzeDocumentValidationSchema),
	AiControllers.analyzeDocument,
);

export const AiRoutes = router;
