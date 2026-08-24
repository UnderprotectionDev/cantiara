import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError, type RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";

export const appRouter = {
	accountAccess: {
		me: protectedProcedure.handler(async ({ context }) => {
			const access = await getAccountAccessForUser(
				getPrismaClient(),
				context.session.user.id
			);
			if (!access) {
				throw new ORPCError("UNAUTHORIZED");
			}
			return access;
		}),
	},
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
