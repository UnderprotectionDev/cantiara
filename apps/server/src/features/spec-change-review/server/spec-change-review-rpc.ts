import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { listSpecChangeReviews } from "./spec-change-review";
import { specChangeReviewCatalog } from "./spec-change-review-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const specChangeReview = {
	catalog: protectedProcedure.handler(() => specChangeReviewCatalog()),
	list: protectedProcedure
		.input(z.object({ documentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await listSpecChangeReviews(getPrismaClient(), {
				documentId: input.documentId,
				workspaceId: access.workspaceId,
			});
		}),
};
