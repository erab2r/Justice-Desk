import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CreateCaseMessageValidationZodSchema } from "./caseMessage.validation";
import { CaseMessageControllers } from "./caseMessage.controller";

const router = Router();

router.post(
  "/:caseId",
  auth(Role.CLIENT, Role.LAWYER),
  validateRequest(CreateCaseMessageValidationZodSchema),
  CaseMessageControllers.createCaseMessage,
);

router.get(
  "/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseMessageControllers.getCaseMessages,
);

router.delete(
  "/:messageId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  CaseMessageControllers.deleteCaseMessage,
);

export const CaseMessageRoutes = router;