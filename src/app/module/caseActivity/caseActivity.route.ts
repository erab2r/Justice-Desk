import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CaseActivityControllers } from "./caseActivity.controller";
import { CreateCaseActivityValidationZodSchema } from "./caseActivity.validation";

const router = Router();

router.post(
  "/:caseId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(CreateCaseActivityValidationZodSchema),
  CaseActivityControllers.createCaseActivity,
);

router.get(
  "/case/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseActivityControllers.getCaseActivities,
);

router.get(
  "/:activityId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseActivityControllers.getActivityById,
);

export const CaseActivityRoutes = router;