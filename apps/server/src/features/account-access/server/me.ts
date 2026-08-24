import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";

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
};
