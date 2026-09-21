
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { getBkashIdToken } from "./app/lib/bkash";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AppointementRoutes } from "./app/module/appointment/appointment.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { UserRoutes } from "./app/module/user/user.route";
import { LawyerRoutes } from "./app/module/lawyer/lawyer.route";
import { CaseReportControllers } from "./app/module/casereport/caseReport.controller";
import { CaseRoutes } from "./app/module/case/case.route";
import { SpecializationRoutes } from "./app/module/Specialization/specialization.route";
import { LegalDocumentRoutes } from "./app/module/legaldocument/legaldocument.route";
import { CaseActivityRoutes } from "./app/module/caseActivity/caseActivity.route";
import { CaseMessageRoutes } from "./app/module/caseMessage/caseMessage.route";
import { CaseReportRoutes } from "./app/module/casereport/caseReport.route";
import { InvoiceRoutes } from "./app/module/invoice/invoice.route";
import { LawyerNoteRoutes } from "./app/module/lawyernote/lawyerNote.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);


app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
	const requestPath = req.originalUrl.split("?")[0];

	if (requestPath === "/api/v1/appointment/stripe/webhook") {
		return next();
	}

	return express.json()(req, res, next);
});
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/lawyer", LawyerRoutes);
app.use("/api/v1/specialization", SpecializationRoutes);
app.use("/api/v1/appointment", AppointementRoutes);
app.use("/api/v1/case",CaseRoutes);
app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/legal-document", LegalDocumentRoutes);
app.use("/api/v1/case-activity", CaseActivityRoutes);
app.use("/api/v1/case-message", CaseMessageRoutes);
app.use("/api/v1/case-report", CaseReportRoutes);
app.use("/api/v1/invoice", InvoiceRoutes);
app.use("/api/v1/lawyer-note", LawyerNoteRoutes);

app.use("/api/v1/payment", PaymentRoutes);


app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const grantIdTokenResult = await getBkashIdToken();

		console.log(grantIdTokenResult);

		res.status(httpStatus.OK).json({
			success: true,
			message: "Welcome to Justice Desk - Lawyer Consultation & Case Management System",
			data: null,
		});
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Justice Desk - Lawyer Consultation & Case Management System",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;