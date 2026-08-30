import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import {
	getPrismaClient,
	readWorkspaceOverviewLayout,
	writeWorkspaceOverviewLayout,
} from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { CROSS_PROJECT_LIST_COLUMNS } from "./cross-project-lists";
import {
	LIVE_BLOCK_KINDS,
	LIVE_BLOCK_LIMIT,
	PREPARED_MODULE_HEADINGS,
	parseWorkspaceOverviewLayout,
	sourcesFromWorkspaceSnapshot,
	workspaceOverview,
} from "./workspace-overview";

const savedListInputSchema = z.object({
	columns: z.array(z.enum(CROSS_PROJECT_LIST_COLUMNS)),
	conditions: z.object({
		archived: z.boolean().nullable(),
		enabledAreas: z.array(z.string()),
		lifecycleStatuses: z.array(z.string()),
		stageNames: z.array(z.string()),
		targetDateOnOrAfter: z.string().nullable(),
		targetDateOnOrBefore: z.string().nullable(),
	}),
	grouping: z.enum(CROSS_PROJECT_LIST_COLUMNS).nullable(),
	id: z.string().min(1),
	name: z.string().min(1),
	sort: z.object({
		column: z.enum(CROSS_PROJECT_LIST_COLUMNS),
		direction: z.enum(["asc", "desc"]),
	}),
});

const layoutInputSchema = z.object({
	hidden: z.array(z.enum(PREPARED_MODULE_HEADINGS)),
	liveBlocks: z
		.array(
			z.object({
				kind: z.enum(LIVE_BLOCK_KINDS),
				sourceId: z.string().min(1),
			})
		)
		.max(LIVE_BLOCK_LIMIT),
	order: z.array(z.enum(PREPARED_MODULE_HEADINGS)),
	savedLists: z.array(savedListInputSchema),
});

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function loadOverview(workspaceId: string) {
	const prisma = getPrismaClient();
	const [overviewLayout, projects, works] = await Promise.all([
		readWorkspaceOverviewLayout(prisma, workspaceId),
		prisma.project.findMany({
			select: {
				areaSettings: {
					select: { enabled: true, name: true },
				},
				id: true,
				lifecycleStatus: true,
				name: true,
				stages: {
					orderBy: { sortOrder: "asc" },
					select: { name: true },
				},
				targetDate: true,
			},
			where: { workspaceId },
		}),
		prisma.work.findMany({
			orderBy: { updatedAt: "desc" },
			select: {
				archived: true,
				id: true,
				projectId: true,
				title: true,
				updatedAt: true,
			},
			take: 40,
			where: { archived: false, project: { workspaceId } },
		}),
	]);
	const layout = parseWorkspaceOverviewLayout(overviewLayout);
	return workspaceOverview(
		sourcesFromWorkspaceSnapshot({ projects, works }),
		layout
	);
}

export const workspaceOverviewRouter = {
	get: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await loadOverview(access.workspaceId);
	}),
	saveLayout: protectedWriteProcedure
		.input(layoutInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const prisma = getPrismaClient();
			await writeWorkspaceOverviewLayout(prisma, access.workspaceId, {
				hidden: input.hidden,
				liveBlocks: input.liveBlocks,
				order: input.order,
				savedLists: input.savedLists,
			});
			return await loadOverview(access.workspaceId);
		}),
};
