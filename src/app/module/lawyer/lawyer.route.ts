import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";

import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";


import { LawyerControllers } from "./lawyer.controller";

import { upload } from "../../lib/multer";
import { AppError } from "../../utils/AppError";
import { ApplyAsLawyerValidationZodSchema, ApproveLawyerValidationZodSchema, UpdateLawyerProfileValidationZodSchema, VerifyLawyerEmailValidationZodSchema } from "./lawyer.validation";

const router = Router();

const parseLawyerApplicationFields = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    for (const field of ["user", "lawyer"] as const) {
      if (typeof req.body[field] === "string") {
        req.body[field] = JSON.parse(req.body[field]);
      }
    }

    next();
  } catch {
    next(
      new AppError(
        httpStatus.BAD_REQUEST,
        "The user and lawyer fields must contain valid JSON objects",
      ),
    );
  }
};


router.post(
  "/apply-lw",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 5 },
  ]),
  parseLawyerApplicationFields,
  validateRequest(ApplyAsLawyerValidationZodSchema),
  LawyerControllers.applyAsLawyer,
);

router.post(
  "/verify-email",
  validateRequest(VerifyLawyerEmailValidationZodSchema),
  LawyerControllers.verifyLawyerEmail,
);


router.patch(
  "/approve-lw",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ApproveLawyerValidationZodSchema),
  LawyerControllers.approveLawyer,
);


router.get(
  "/all-lawyers",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  LawyerControllers.getAllLawyers,
);


router.patch(
  "/profile",
  auth(Role.LAWYER),
  validateRequest(UpdateLawyerProfileValidationZodSchema),
  LawyerControllers.updateLawyerProfile,
);

router.get(
	"/public/available-today",
	LawyerControllers.getAvailableLawyerByTodaysSchedule,
);

router.get("/all-lw", LawyerControllers.getAllLawyersListPublic);

router.get("/:lawyerId", LawyerControllers.getSingleLawyerPublicProfile);

export const LawyerRoutes = router;