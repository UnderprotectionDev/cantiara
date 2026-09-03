import { forgetPrismaClientCache } from "@cantiara/db";
import { ORPCError, os } from "@orpc/server";

import {
	toMainFlowFailureError,
	writeMainFlowFailureLog,
} from "./client-shell-failure";
import type { Context } from "./context";
import {
	assertDesktopApiWriteAllowed,
	desktopApiContractFrom,
	signedDesktopApiCatalog,
} from "./desktop-api-window";
import { createGeneratedClientReload } from "./stale-generated-client-reload";

export const o = os.$context<Context>();

const runWithGeneratedClientReload = createGeneratedClientReload(
	forgetPrismaClientCache
);

const withMainFlowFailure = o.middleware(async ({ context, next }) => {
	try {
		return await runWithGeneratedClientReload(() => next());
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

const requireSupportedDesktopApi = o.middleware(async ({ context, next }) => {
	assertDesktopApiWriteAllowed(
		desktopApiContractFrom(context.request),
		signedDesktopApiCatalog,
		new Date()
	);
	return await next();
});

export const protectedWriteProcedure = protectedProcedure.use(
	requireSupportedDesktopApi
);

export type {
	DesktopApiWindowDecision,
	DesktopApiWindowStatus,
	SignedDesktopApiCatalog,
	SignedDesktopApiContract,
} from "./desktop-api-window";
export {
	assertDesktopApiWriteAllowed,
	DESKTOP_API_CONTRACT,
	DESKTOP_API_HEADER,
	DESKTOP_API_WINDOW_DAYS,
	desktopApiContractFrom,
	evaluateDesktopApiWindow,
	signedDesktopApiCatalog,
	UPDATE_REQUIRED,
} from "./desktop-api-window";
