
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

// Create Schedule
router.post(
  "/",
  auth(Role.LAWYER),
  validateRequest(CreateScheduleValidationZodSchema),
  ScheduleControllers.createSchedule,
);

// Get My Schedules
router.get(
  "/my-schedules",
  auth(Role.LAWYER),
  ScheduleControllers.getMySchedules,
);

// Get Today's Schedules
router.get(
  "/today",ScheduleControllers.getTodaysSchedules,
);

// Get Available Schedules
router.get(
  "/available",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getAvailableSchedules,
);

// Get All Schedules
router.get(
  "/all-schedules",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getAllSchedules,
);

// Get Schedule By ID
router.get(
  "/:scheduleId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  ScheduleControllers.getScheduleById,
);

// Update Schedule
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

