import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import {
	getPrismaClient,
	prismaClientHasCurrentWorkspaceModel,
	workspaceOverviewLayoutSelect,
} from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	LIVE_BLOCK_KINDS,
	LIVE_BLOCK_LIMIT,
	PREPARED_MODULE_HEADINGS,
	parseWorkspaceOverviewLayout,
	sourcesFromWorkspaceSnapshot,
	workspaceOverview,
} from "./workspace-overview";

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
	const [workspace, projects, works] = await Promise.all([
		prisma.workspace.findUnique({
			select: workspaceOverviewLayoutSelect(prisma),
			where: { id: workspaceId },
		}),
		prisma.project.findMany({
			select: {
				id: true,
				lifecycleStatus: true,
				name: true,
				targetDate: true,
			},
			where: { workspaceId },
		}),
		prisma.work.findMany({
			orderBy: { updatedAt: "desc" },
			select: {
				archived: true,
				id: true,
				title: true,
				updatedAt: true,
			},
			take: 40,
			where: { archived: false, project: { workspaceId } },
		}),
	]);
	const layout = parseWorkspaceOverviewLayout(
		workspace && "overviewLayout" in workspace
			? workspace.overviewLayout
			: undefined
	);
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
			if (prismaClientHasCurrentWorkspaceModel(prisma)) {
				await prisma.workspace.update({
					data: {
						overviewLayout: {
							hidden: input.hidden,
							liveBlocks: input.liveBlocks,
							order: input.order,
						},
					},
					where: { id: access.workspaceId },
				});
			}
			return await loadOverview(access.workspaceId);
		}),
};
