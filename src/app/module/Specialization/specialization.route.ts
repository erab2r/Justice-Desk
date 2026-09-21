import { Router } from "express";

import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SpecializationControllers } from "./specialization.controller";
import {
  AssignSpecializationValidationZodSchema,
  CreateSpecializationValidationZodSchema,
  ReviewSpecializationRequestValidationZodSchema,
  UpdateSpecializationValidationZodSchema,
} from "./specialization.validation";

const router = Router();
const admins = auth(Role.ADMIN, Role.SUPER_ADMIN);

router.get("/", SpecializationControllers.getAllSpecializations);
router.post(
  "/",
  admins,
  validateRequest(CreateSpecializationValidationZodSchema),
  SpecializationControllers.createSpecialization,
);
router.patch(
  "/:specializationId",
  admins,
  validateRequest(UpdateSpecializationValidationZodSchema),
  SpecializationControllers.updateSpecialization,
);
router.delete(
  "/:specializationId",
  admins,
  SpecializationControllers.deleteSpecialization,
);

router.post(
  "/requests",
  auth(Role.LAWYER),
  validateRequest(AssignSpecializationValidationZodSchema),
  SpecializationControllers.assignSpecialization,
);
router.get(
  "/requests",
  admins,
  SpecializationControllers.getSpecializationRequests,
);
router.patch(
  "/requests/review",
  admins,
  validateRequest(ReviewSpecializationRequestValidationZodSchema),
  SpecializationControllers.reviewSpecializationRequest,
);
router.get(
  "/me",
  auth(Role.LAWYER),
  SpecializationControllers.getMySpecializations,
);
router.delete(
  "/me/:specializationId",
  auth(Role.LAWYER),
  SpecializationControllers.removeSpecialization,
);
router.get(
  "/lawyer/:lawyerId",
  SpecializationControllers.getLawyerSpecializations,
);
router.get(
  "/:specializationId",
  SpecializationControllers.getSpecializationById,
);

export const SpecializationRoutes = router;
