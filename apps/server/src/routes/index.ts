import { protectedProcedure, publicProcedure } from "@cantiara/api";
import type { RouterClient } from "@orpc/server";

import { accountAccess } from "../features/account-access/server/me";
import { accountPreferences } from "../features/account-preferences/server/preferences";
import { captureInbox } from "../features/capture-triage/server/capture-inbox-router";
import { customFields } from "../features/custom-fields/server/custom-fields-rpc";
import { projectOverviewRouter } from "../features/project-overview/server/project-overview-rpc";
import { projectShell } from "../features/project-shell/server/project-shell-rpc";
import { clientShell } from "../features/web-macos-client/server/desktop-api-window";
import { relations } from "../features/relations/server/relations-rpc";
import { workLifecycle } from "../features/work-lifecycle/server/work-lifecycle-rpc";

export const appRouter = {
	accountAccess,
	accountPreferences,
	captureInbox,
	clientShell,
	customFields,
	projectOverview: projectOverviewRouter,
	projectShell,
	relations,
	workLifecycle,
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
