
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";

import { ScheduleControllers } from "./schedule.controller";
import {
  CreateScheduleValidationZodSchema,
  UpdateScheduleValidationZodSchema,
  UpdateScheduleStatusValidationZodSchema,
} from "./schedule.validation";
import { Role } from "../../../../prisma/generated/prisma/enums";

const router = Router();


router.post(
  "/",
  auth(Role.LAWYER),
  validateRequest(CreateScheduleValidationZodSchema),
  ScheduleControllers.createSchedule,
);


router.get(
  "/my-schedules",
  auth(Role.LAWYER),
  ScheduleControllers.getMySchedules,
);


router.get(
  "/today",ScheduleControllers.getTodaysSchedules,
);


router.get(
  "/available",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getAvailableSchedules,
);


router.get(
  "/all-schedules",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getAllSchedules,
);


router.get(
  "/:scheduleId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getScheduleById,
);


router.patch(
  "/:scheduleId",
  auth(Role.LAWYER),
  validateRequest(UpdateScheduleValidationZodSchema),
  ScheduleControllers.updateSchedule,
);

// Publish Schedule
router.patch(
  "/:scheduleId/status",
  auth(Role.LAWYER),
  validateRequest(UpdateScheduleStatusValidationZodSchema),
  ScheduleControllers.updateScheduleStatus,
);

// Delete Schedule
router.delete(
  "/:scheduleId",
  auth(Role.LAWYER),
  ScheduleControllers.deleteSchedule,
);

export const ScheduleRoutes = router;

