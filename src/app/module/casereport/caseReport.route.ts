import { Router } from "express";

import { Role } from "../../../../prisma/generated/prisma/enums";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";

import { CaseReportControllers } from "./caseReport.controller";
import {
  CreateCaseReportValidationZodSchema,
  UpdateCaseReportValidationZodSchema,
} from "./caseReport.validation";

const router = Router();

// Create Case Report
router.post(
  "/:caseId",
  auth(Role.LAWYER),
  validateRequest(CreateCaseReportValidationZodSchema),
  CaseReportControllers.createCaseReport,
);

// Get All Reports Of A Case
router.get(
  "/case/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseReportControllers.getCaseReports,
);

// Get My Reports
router.get(
  "/my-reports",
  auth(Role.LAWYER),
  CaseReportControllers.getMyReports,
);

// Get All Reports
router.get(
  "/all-reports",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  CaseReportControllers.getAllReports,
);


// Get Case Report By ID
router.get(
  "/:reportId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseReportControllers.getCaseReportById,
);


// Update Case Report
router.patch(
  "/:reportId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UpdateCaseReportValidationZodSchema),
  CaseReportControllers.updateCaseReport,
);

// Delete Case Report
router.delete(
  "/:reportId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseReportControllers.deleteCaseReport,
);

export const CaseReportRoutes = router;

