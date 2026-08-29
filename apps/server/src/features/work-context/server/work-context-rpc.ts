import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { loadWorkContextCard } from "./work-context";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const workContext = {
	get: protectedProcedure
		.input(
			z.object({
				revealedSections: z.array(z.string()).optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const card = await loadWorkContextCard(getPrismaClient(), {
				revealedSections: input.revealedSections,
				viewerWorkspaceId: access.workspaceId,
				workId: input.workId,
			});
			if (!card) {
				throw new ORPCError("NOT_FOUND");
			}
			return card;
		}),
};
