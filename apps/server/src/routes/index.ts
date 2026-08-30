import { protectedProcedure, publicProcedure } from "@cantiara/api";
import type { RouterClient } from "@orpc/server";

import { accountAccess } from "../features/account-access/server/me";
import { accountPreferences } from "../features/account-preferences/server/preferences";
import { blockers } from "../features/blockers/server/blockers-rpc";
import { bulkEditing } from "../features/bulk-editing/server/bulk-editing-rpc";
import { captureInbox } from "../features/capture-triage/server/capture-inbox-router";
import { customFields } from "../features/custom-fields/server/custom-fields-rpc";
import { externalHandoffs } from "../features/external-handoffs/server/external-handoffs-rpc";
import { fileAttachments } from "../features/file-attachments/server/file-attachments-rpc";
import { priority } from "../features/priority/server/priority-rpc";
import { projectOverviewRouter } from "../features/project-overview/server/project-overview-rpc";
import { projectShell } from "../features/project-shell/server/project-shell-rpc";
import { recordActions } from "../features/record-actions/server/record-actions-rpc";
import { relations } from "../features/relations/server/relations-rpc";
import { tags } from "../features/tags/server/tags-rpc";
import { clientShell } from "../features/web-macos-client/server/desktop-api-window";
import { workChecklists } from "../features/work-checklists/server/work-checklists-rpc";
import { workContext } from "../features/work-context/server/work-context-rpc";
import { workDrafts } from "../features/work-drafts/server/work-drafts-rpc";
import { workLifecycle } from "../features/work-lifecycle/server/work-lifecycle-rpc";
import { workTemplates } from "../features/work-templates/server/work-templates-rpc";
import { workspaceOverviewRouter } from "../features/workspace-overview/server/workspace-overview-rpc";

export const appRouter = {
	accountAccess,
	accountPreferences,
	blockers,
	bulkEditing,
	captureInbox,
	clientShell,
	customFields,
	externalHandoffs,
	fileAttachments,
	healthCheck: publicProcedure.handler(() => "OK"),
	priority,
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	projectOverview: projectOverviewRouter,
	projectShell,
	recordActions,
	relations,
	tags,
	workChecklists,
	workContext,
	workDrafts,
	workLifecycle,
	workspaceOverview: workspaceOverviewRouter,
	workTemplates,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
