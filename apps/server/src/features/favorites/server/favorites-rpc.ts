import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createFavorites } from "./favorites";
import { FAVORITE_SOURCE_TYPES, favoritesCatalog } from "./favorites-model";

async function favoritesFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createFavorites({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const membershipInput = z.object({
	idempotencyKey: z.string().min(1),
	sourceId: z.string(),
	sourceType: z.enum(FAVORITE_SOURCE_TYPES),
});

const sourceInput = z.object({
	sourceId: z.string().min(1),
	sourceType: z.enum(FAVORITE_SOURCE_TYPES),
});

export const favorites = {
	add: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await favoritesFor(context.session.user.id);
			return surface.add(input);
		}),
	catalog: protectedProcedure.handler(() => favoritesCatalog()),
	list: protectedProcedure.handler(async ({ context }) => {
		const surface = await favoritesFor(context.session.user.id);
		return surface.list();
	}),
	listForSource: protectedProcedure
		.input(sourceInput)
		.handler(async ({ context, input }) => {
			const surface = await favoritesFor(context.session.user.id);
			return surface.listForSource(input);
		}),
	remove: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await favoritesFor(context.session.user.id);
			return surface.remove(input);
		}),
};
