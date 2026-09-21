import { Router } from "express";
import { Role } from "../../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { InvoiceControllers } from "./invoice.controller";
import {
  CreateInvoiceValidationZodSchema,
  UpdateInvoiceValidationZodSchema,
  UpdateInvoiceStatusValidationZodSchema,
} from "./invoice.validation";

const router = Router();

router.post(
  "/",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(CreateInvoiceValidationZodSchema),
  InvoiceControllers.createInvoice,
);

router.get(
  "/my-invoices",
  auth(Role.CLIENT, Role.LAWYER),
  InvoiceControllers.getMyInvoices,
);

router.get(
  "/all-invoices",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InvoiceControllers.getAllInvoices,
);

router.get(
  "/case/:caseId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  InvoiceControllers.getInvoicesByCase,
);

router.patch(
  "/:invoiceId/status",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UpdateInvoiceStatusValidationZodSchema),
  InvoiceControllers.updateInvoiceStatus,
);

router.post(
  "/:invoiceId/regenerate-pdf",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  InvoiceControllers.regenerateInvoicePdf,
);

router.patch(
  "/:invoiceId",
  auth(Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UpdateInvoiceValidationZodSchema),
  InvoiceControllers.updateInvoice,
);

router.delete(
  "/:invoiceId",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  InvoiceControllers.deleteInvoice,
);

router.get(
  "/:invoiceId",
  auth(Role.CLIENT, Role.LAWYER, Role.ADMIN, Role.SUPER_ADMIN),
  InvoiceControllers.getInvoiceById,
);

export const InvoiceRoutes = router;