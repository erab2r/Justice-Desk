import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CreateLawyerNoteValidationZodSchema, UpdateLawyerNoteValidationZodSchema } from "./lawyerNote.validation";
import { LawyerNoteControllers } from "./lawyerNote.controller";



const router = Router();
router.post(
  "/:caseId",
  auth(Role.LAWYER, Role.ADMIN),
  validateRequest(CreateLawyerNoteValidationZodSchema),
  LawyerNoteControllers.createNote,
);


router.get(
  "/case/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LawyerNoteControllers.getNotesByCase,
);

// Get a single note
router.get(
  "/:noteId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LawyerNoteControllers.getNoteById,
);

// Update a note
router.patch(
  "/:noteId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UpdateLawyerNoteValidationZodSchema),
  LawyerNoteControllers.updateNote,
);

// Delete a note
router.delete(
  "/:noteId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LawyerNoteControllers.deleteNote,
);

export const LawyerNoteRoutes = router;