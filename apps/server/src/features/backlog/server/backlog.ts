import type { PrismaClient } from "@cantiara/db";

import { getProject } from "../../project-shell/server/project-shell";
import {
	applyPlanningMembership,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	BACKLOG_COPY,
	type BacklogPlanningOutcome,
	PLANNING_SURFACE,
	type PlaceOnPlanningSurfaceCommand,
	PREPARED_MEMBERSHIP,
	type PreparedBacklogView,
	placeOnPlanningSurfaceCommandSchema,
	type TakeUpFromBacklogCommand,
	takeUpFromBacklogCommandSchema,
} from "./backlog-model";

export async function listPreparedBacklog(
	prisma: PrismaClient,
	projectId: string
): Promise<PreparedBacklogView> {
	const [works, trashed] = await Promise.all([
		listWork(prisma, projectId, { archived: false }),
		prisma.work.findMany({
			select: { id: true },
			where: { projectId, trashedAt: { not: null } },
		}),
	]);
	const trashedIds = new Set(trashed.map((row) => row.id));
	return {
		copy: { backlog: BACKLOG_COPY.backlog },
		items: works.filter((work) => !(work.archived || trashedIds.has(work.id))),
		membership: PREPARED_MEMBERSHIP,
	};
}

export async function takeUpFromBacklog(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogPlanningOutcome> {
	const parsed = takeUpFromBacklogCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await applyPreparedPlanningMove(prisma, {
		surface: parsed.data.onto ?? PLANNING_SURFACE.dailyFocus,
		workId: parsed.data.workId,
	});
}

export async function placeOnPlanningSurface(
	prisma: PrismaClient,
	command: unknown
): Promise<BacklogPlanningOutcome> {
	const parsed = placeOnPlanningSurfaceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await applyPreparedPlanningMove(prisma, parsed.data);
}

export async function projectStagesForWork(
	prisma: PrismaClient,
	workId: string
) {
	const work = await getWork(prisma, workId);
	if (!work) {
		return null;
	}
	const project = await getProject(prisma, work.projectId);
	if (!project) {
		return null;
	}
	return project.stages.map((stage) => ({
		id: stage.id,
		name: stage.name,
		state: stage.state,
	}));
}

async function applyPreparedPlanningMove(
	prisma: PrismaClient,
	command: PlaceOnPlanningSurfaceCommand | TakeUpFromBacklogCommand
): Promise<BacklogPlanningOutcome> {
	const work = await getWork(prisma, command.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const prepared = await listPreparedBacklog(prisma, work.projectId);
	if (!prepared.items.some((item) => item.id === work.id)) {
		return { reason: "not-in-prepared-set", status: "rejected" };
	}
	const surface =
		"surface" in command
			? command.surface
			: (command.onto ?? PLANNING_SURFACE.dailyFocus);
	const outcome = await applyPlanningMembership(prisma, {
		surface,
		workId: command.workId,
	});
	if (outcome.status !== "committed") {
		return {
			reason:
				outcome.reason === "close-step-required"
					? "close-step-required"
					: "target-not-found",
			status: "rejected",
		};
	}
	return {
		membership: { surface },
		status: "committed",
		work: outcome.work,
	};
}
