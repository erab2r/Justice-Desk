




import z from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters long.")
	.regex(
		/[a-z]/,
		"Password must contain at least 1 lowercase letter",
	)
	.regex(
		/[A-Z]/,
		"Password must contain at least 1 uppercase letter",
	)
	.regex(
		/[0-9]/,
		"Password must contain at least 1 number",
	)
	.regex(
		/[^A-Za-z0-9]/,
		"Password must contain at least 1 special character",
	);

const ClientRegistrationZodSchema = z.object({
	name: z
		.string("Name must be a string")
		.min(3, "Name must be at least 3 characters long")
		.max(100, "Name cannot exceed 100 characters"),

	email: z.email("Please provide a valid email address"),

	password: passwordSchema,

	client: z
		.object({
			contactNumber: z
				.string()
				.min(5, "Contact number is too short")
				.max(20, "Contact number is too long")
				.optional(),

			address: z
				.string()
				.max(500, "Address cannot exceed 500 characters")
				.optional(),

			gender: z
				.enum(["MALE", "FEMALE", "OTHER"])
				.optional(),

			dateOfBirth: z
				.string()
				.optional(),
		})
		.optional(),
});


const ClientEmailVerifyZodSchema = z.object({
	email: z.email("Please provide a valid email address"),

	otp: z
		.string()
		.length(6, "OTP must be exactly 6 characters"),
});



const LoginZodSchema = z.object({
	email: z.email("Please provide a valid email address"),

	password: passwordSchema,
});


const GoogleLoginZodSchema = z.object({
	idToken: z
		.string()
		.min(1, "Google ID token is required"),
});



const ForgotPasswordZodSchema = z.object({
	email: z.email("Please provide a valid email address"),
});



const ResetPasswordZodSchema = z.object({
	email: z.email("Please provide a valid email address"),

	newPassword: passwordSchema,

	otp: z
		.string()
		.length(6, "OTP must be exactly 6 characters"),
});



export const UserValidation = {
	ClientRegistrationZodSchema,
	ClientEmailVerifyZodSchema,
	LoginZodSchema,
	GoogleLoginZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
};