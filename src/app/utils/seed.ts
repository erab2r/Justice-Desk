import bcrypt from "bcryptjs";
import httpStatus from "http-status";

import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./AppError";
import {
	LawyerVerificationStatus,
	Role,
} from "../../../prisma/generated/prisma/enums";

export const seedSuperAdmin = async () => {
	try {
		const isSuperAdminExist = await prisma.user.findFirst({
			where: {
				role: Role.SUPER_ADMIN,
			},
		});

		if (isSuperAdminExist) {
			console.log("Super Admin Already Exists!");
			return;
		}

		const name = config.super_admin_name;
		const email = config.super_admin_email;
		const password = config.super_admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Super Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Super Admin Created : ", superAdmin);
	} catch (error) {
		console.log("Error Seeding Super Admin : ", error);

		await prisma.user.deleteMany({
			where: { email: config.super_admin_email },
		});
	}
};

//create tester admin

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExist = await prisma.user.findUnique({
			where: {
				email: config.tester_admin_email,
			},
		});

		if (isTesterAdminExist) {
			console.log("Tester Admin Already Exists!");
			return;
		}

		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Tester Admin Created : ", testerAdmin);
	} catch (error) {
		console.log("Error Seeding Tester Admin : ", error);

		await prisma.user.deleteMany({
			where: { email: config.tester_admin_email },
		});
	}
};

export const seedTesterLawyer = async () => {
	try {
		const isTesterLawyerExist = await prisma.user.findUnique({
			where: {
				email: config.tester_lawyer_email,
			},
		});

		if (isTesterLawyerExist) {
			console.log("Tester Lawyer Already Exists!");
			return;
		}

		const name = config.tester_lawyer_name;
		const email = config.tester_lawyer_email;
		const password = config.tester_lawyer_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Lawyer Name, Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);
		const specialization = await prisma.specialization.upsert({
			where: {
				name: "Corporate Law",
			},
			update: {},
			create: {
				name: "Corporate Law",
				description: "Legal matters related to businesses and corporations.",
			},
		});

		const testerLawyer = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.LAWYER,
				needPasswordChange: false,
				emailVerified: true,

				lawyer: {
					create: {
						email,
						name,
						experienceYears: 5,
						licenseNumber: "BAR0000",
						qualifications: "LLB",
						averageRating: 4.0,
						ratingCount: 1,
						verificationStatus: LawyerVerificationStatus.APPROVED,
						specializations: {
							create: {
								specializationId: specialization.id,
							},
						},
					},
				},
			},
		});

		console.log("Tester Lawyer Created:", testerLawyer);
		console.log("Specialization:", specialization.name);
	} catch (error) {
		console.log("Error Seeding Tester Lawyer:", error);
		if (config.tester_lawyer_email) {
			await prisma.user.deleteMany({
				where: {
					email: config.tester_lawyer_email,
				},
			});
		}
	}
};

export const seedTesterClient = async () => {
	const name = config.tester_client_name;
	const email = config.tester_client_email;
	const password = config.tester_client_password;

	if (!name || !email || !password) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Tester Client Name, Email, Password Missing In Env File!!!",
		);
	}

	const existingTesterClient = await prisma.user.findUnique({
		where: { email },
	});

	if (existingTesterClient) {
		console.log("Tester Client Already Exists!");
		return;
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,
			role: Role.CLIENT,
			needPasswordChange: false,
			emailVerified: true,
			client: {
				create: {
					name,
					email,
				},
			},
		},
	});

	console.log("Tester Client Created:", email);
};
