import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LegalDocumentControllers } from "./legalDocument.controller";
import { CreateLegalDocumentValidationZodSchema, UpdateLegalDocumentValidationZodSchema } from "./legalDocument.validation";


const router = Router();

router.post(
  "/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(CreateLegalDocumentValidationZodSchema),
  LegalDocumentControllers.createLegalDocument,
);

router.get(
  "/my-documents",
  auth(Role.CLIENT, Role.LAWYER),
  LegalDocumentControllers.getMyDocuments,
);

router.get(
  "/case/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LegalDocumentControllers.getDocumentsByCase,
);

router.patch(
  "/:documentId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UpdateLegalDocumentValidationZodSchema),
  LegalDocumentControllers.updateLegalDocument,
);

router.delete(
  "/:documentId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LegalDocumentControllers.deleteLegalDocument,
);

router.get(
  "/:documentId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  LegalDocumentControllers.getLegalDocumentById,
);

export const LegalDocumentRoutes = router;