import type { RouterClient } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, publicProcedure } from "../index";

function sessionPrincipal(session: NonNullable<Context["session"]>) {
  return {
    accountId: session.user.id,
    sessionId: session.session.id,
  };
}

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  githubAvailability: publicProcedure.handler(({ context }) => ({
    status: context.githubAvailability.getStatus(),
  })),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  sessions: protectedProcedure.handler(({ context }) =>
    context.accountAccess.listSessions(sessionPrincipal(context.session)),
  ),
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await context.accountAccess.revokeSession(
        sessionPrincipal(context.session),
        input.sessionId,
      );
      return { status: true };
    }),
  revokeOtherSessions: protectedProcedure.handler(async ({ context }) => {
    await context.accountAccess.revokeOtherSessions(
      sessionPrincipal(context.session),
    );
    return { status: true };
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
