import { ORPCError, os } from "@orpc/server";

import {
	toMainFlowFailureError,
	writeMainFlowFailureLog,
} from "./client-shell-failure";
import type { Context } from "./context";

export const o = os.$context<Context>();

const withMainFlowFailure = o.middleware(async ({ context, next }) => {
	try {
		return await next();
	} catch (error) {
		throw toMainFlowFailureError(error, {
			write: (record) => {
				writeMainFlowFailureLog(context.log, record);
			},
		});
	}
});

export const publicProcedure = o.use(withMainFlowFailure);

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return await next({
		context: {
			log: context.log,
			request: context.request,
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);
