import cron from "node-cron";
import { prisma } from "./prisma";
import { LawyerVerificationStatus, Role } from "../../../prisma/generated/prisma/enums";

export const deleteUnverifiedLawyers = async () => {
	cron.schedule("*/10 * * * *", async () => {
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
			const deletedLawyers = await prisma.user.deleteMany({
				where: {
					role: Role.LAWYER,
					emailVerified: false,
					createdAt: { lt: oneHourAgo },
					lawyer: {
						verificationStatus: LawyerVerificationStatus.PENDING,
					},
				},
			});

			if (deletedLawyers.count > 0) {
				console.log(`
                Cron: Deleted ${deletedLawyers.count} unverified email lawyer applications older than 1 hour
                `);
			}
		} catch (error) {
			console.log(
				"Cron: Failed to delete unverified lawyer applications",
				error,
			);
		}

		console.log("Unverified Lawyer Delete cron schedule (every 10 minutes)");
	});
};
