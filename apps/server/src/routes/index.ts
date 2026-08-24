import { protectedProcedure, publicProcedure } from "@cantiara/api";
import type { RouterClient } from "@orpc/server";

import { accountAccess } from "../features/account-access/server/me";

export const appRouter = {
	accountAccess,
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
