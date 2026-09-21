import type { UploadApiResponse } from "cloudinary";

import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (
	buffer: Buffer,
	userId: string,
) => {
	// Check current user and existing profile image
	const currentUser = await prisma.user.findUnique({
		where: {
			id: userId,
		},
		select: {
			id: true,
			imagePublicId: true,
			imageUrl: true,
			isDeleted: true,
		},
	});

	if (!currentUser) {
		throw new Error("User not found");
	}

	if (currentUser.isDeleted) {
		throw new Error("User account has been deleted");
	}

	// Upload new image to Cloudinary
	const cloudinaryResult =
		await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				cloudinary.uploader
					.upload_stream(
						{
							resource_type: "image",
							folder: "justice-desk/profile-images",
							transformation: [
								{
									width: 500,
									height: 500,
									crop: "fill",
									gravity: "face",
								},
							],
						},
						(error, result) => {
							if (error) {
								return reject(error);
							}

							if (!result) {
								return reject(
									new Error(
										"No result returned from Cloudinary",
									),
								);
							}

							resolve(result);
						},
					)
					.end(buffer);
			},
		);

	// Update user's profile image
	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},

		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},

		omit: {
			password: true,
		},
	});

	// Delete old profile image from Cloudinary
	if (currentUser.imagePublicId) {
		try {
			await cloudinary.uploader.destroy(
				currentUser.imagePublicId,
			);
		} catch (error) {
			console.error(
				"Failed to delete old profile image from Cloudinary:",
				error,
			);
		}
	}

	return updatedUser;
};

export const UserServices = {
	uploadProfileImage,
};
