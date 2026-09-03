import { protectedProcedure, publicProcedure } from "@cantiara/api";
import type { RouterClient } from "@orpc/server";

import { accountAccess } from "../features/account-access/server/me";
import { accountPreferences } from "../features/account-preferences/server/preferences";
import { backlog } from "../features/backlog/server/backlog-rpc";
import { blockers } from "../features/blockers/server/blockers-rpc";
import { bulkEditing } from "../features/bulk-editing/server/bulk-editing-rpc";
import { captureInbox } from "../features/capture-triage/server/capture-inbox-router";
import { completionEffects } from "../features/completion-effects/server/completion-effects";
import { customFields } from "../features/custom-fields/server/custom-fields-rpc";
import { dailyFocus } from "../features/daily-focus/server/daily-focus-rpc";
import { documents } from "../features/documents/server/documents-rpc";
import { externalHandoffs } from "../features/external-handoffs/server/external-handoffs-rpc";
import { fileAttachments } from "../features/file-attachments/server/file-attachments-rpc";
import { focusPeriod } from "../features/focus-period/server/focus-period-rpc";
import { kanban } from "../features/kanban/server/kanban-rpc";
import { personalWiki } from "../features/personal-wiki/server/personal-wiki-rpc";
import { priority } from "../features/priority/server/priority-rpc";
import { projectOverviewRouter } from "../features/project-overview/server/project-overview-rpc";
import { projectShell } from "../features/project-shell/server/project-shell-rpc";
import { recordActions } from "../features/record-actions/server/record-actions-rpc";
import { recordDiscovery } from "../features/record-discovery/server/record-discovery-rpc";
import { relations } from "../features/relations/server/relations-rpc";
import { roadmapHorizon } from "../features/roadmap-horizon/server/roadmap-horizon-rpc";
import { smartCollections } from "../features/smart-collections/server/smart-collections-rpc";
import { tags } from "../features/tags/server/tags-rpc";
import { unifiedCalendar } from "../features/unified-calendar/server/unified-calendar-rpc";
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
	backlog,
	blockers,
	bulkEditing,
	captureInbox,
	clientShell,
	completionEffects,
	customFields,
	dailyFocus,
	documents,
	externalHandoffs,
	fileAttachments,
	focusPeriod,
	healthCheck: publicProcedure.handler(() => "OK"),
	kanban,
	personalWiki,
	priority,
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	projectOverview: projectOverviewRouter,
	projectShell,
	recordActions,
	recordDiscovery,
	relations,
	roadmapHorizon,
	smartCollections,
	tags,
	unifiedCalendar,
	workChecklists,
	workContext,
	workDrafts,
	workLifecycle,
	workspaceOverview: workspaceOverviewRouter,
	workTemplates,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
