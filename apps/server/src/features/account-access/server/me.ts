import { protectedProcedure } from "@cantiara/api";
import {
	AccountAccessError,
	auth,
	getAccountAccessForUser,
} from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

function rethrowAccountAccess(error: unknown): never {
	if (error instanceof AccountAccessError) {
		throw new ORPCError(error.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", {
			message: error.message,
		});
	}
	throw error;
}

export const accountAccess = {
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
	revokeOtherSessions: protectedProcedure.handler(async ({ context }) => {
		try {
			await auth.accountAccess.revokeOthers(context.request);
			return { status: true as const };
		} catch (error) {
			rethrowAccountAccess(error);
		}
	}),
	revokeSession: protectedProcedure
		.input(z.object({ sessionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			try {
				await auth.accountAccess.revoke(context.request, input.sessionId);
				return { status: true as const };
			} catch (error) {
				rethrowAccountAccess(error);
			}
		}),
	sessions: protectedProcedure.handler(async ({ context }) => {
		try {
			return await auth.accountAccess.list(context.request);
		} catch (error) {
			rethrowAccountAccess(error);
		}
	}),
};
