

import { Router } from "express";

import { Role } from "../../../../prisma/generated/prisma/enums";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";

import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();
router.post(
	"/register",
	validateRequest(UserValidation.ClientRegistrationZodSchema),
	AuthController.registerClient,
);
router.post(
	"/verify-email",
	validateRequest(UserValidation.ClientEmailVerifyZodSchema),
	AuthController.verifyClientEmail,
);

router.post(
	"/login",
	validateRequest(UserValidation.LoginZodSchema),
	AuthController.loginUser,
);
router.post(
	"/google",
	validateRequest(UserValidation.GoogleLoginZodSchema),
	AuthController.googleLogin,
);

router.get(
	"/me",
	auth(
		Role.ADMIN,
		Role.LAWYER,
		Role.CLIENT,
		Role.SUPER_ADMIN,
	),
	AuthController.getMe,
);
router.post(
	"/refresh-token",
	AuthController.refreshToken,
);

router.post(
	"/logout",
	AuthController.logoutUser,
);

router.post(
	"/forgot-password",
	validateRequest(UserValidation.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	validateRequest(UserValidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

export const AuthRoutes = router;