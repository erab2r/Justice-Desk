import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { VideoSessionControllers } from "./videoSession.controller";
import { CreateVideoSessionValidationZodSchema } from "./videoSession.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CLIENT, Role.LAWYER),
  validateRequest(CreateVideoSessionValidationZodSchema),
  VideoSessionControllers.createVideoSession,
);

router.patch(
  "/:appointmentId/start",
  auth(Role.CLIENT, Role.LAWYER),
  VideoSessionControllers.startVideoSession,
);

router.patch(
  "/:appointmentId/end",
  auth(Role.CLIENT, Role.LAWYER),
  VideoSessionControllers.endVideoSession,
);

router.get(
  "/:appointmentId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  VideoSessionControllers.getVideoSessionByAppointment,
);

export const VideoSessionRoutes = router;