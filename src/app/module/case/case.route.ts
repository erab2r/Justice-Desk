import { Router } from "express";

import { Role } from "../../../../prisma/generated/prisma/enums";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";

import { CaseControllers } from "./case.controller";
import {
    AssignLawyerValidationZodSchema,
    ChangeCaseStatusValidationZodSchema,
    CreateCaseValidationZodSchema,
    UpdateCaseValidationZodSchema,
} from "./case.validation";

const router = Router();

router.post(
    "/create-case",
    auth(Role.CLIENT),
    validateRequest(CreateCaseValidationZodSchema),
    CaseControllers.createCase,
);

router.get(
    "/my-cases",
    auth(Role.CLIENT),
    CaseControllers.getMyCases,
);

router.get(
    "/lawyer-cases",
    auth(Role.LAWYER),
    CaseControllers.getLawyerCases,
);

router.patch(
    "/update-status/:caseId",
    auth(Role.LAWYER),
    validateRequest(ChangeCaseStatusValidationZodSchema),
    CaseControllers.changeCaseStatus,
);

router.get(
    "/all-cases",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    CaseControllers.getAllCases,
);


router.patch(
    "/:caseId",
    auth(Role.ADMIN, Role.SUPER_ADMIN, Role.CLIENT, Role.LAWYER),
    validateRequest(UpdateCaseValidationZodSchema),
    CaseControllers.updateCase,
);


router.patch(
    "/assign-lawyer/:caseId",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(AssignLawyerValidationZodSchema),
    CaseControllers.assignLawyer,
);


router.delete(
    "/:caseId",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    CaseControllers.deleteCase,
);


router.get(
    "/:caseId",
    auth(
        Role.CLIENT,
        Role.LAWYER,
        Role.ADMIN,
        Role.SUPER_ADMIN,
    ),
    CaseControllers.getCaseById,
);

router.patch(
    "/close/:caseId",
    auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
    CaseControllers.closeCase,
);

export const CaseRoutes = router;