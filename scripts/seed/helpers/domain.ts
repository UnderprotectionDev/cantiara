import { addActiveBlockingRelation } from "../../../apps/server/src/features/blockers/server/blockers";
import { createDocument } from "../../../apps/server/src/features/documents/server/documents";
import {
	createProject,
	updateShortCode,
} from "../../../apps/server/src/features/project-shell/server/project-shell";
import type { StarterConfiguration } from "../../../apps/server/src/features/project-shell/server/project-shell-model";
import {
	contributeToMilestone,
	createMilestone,
	placeHorizon,
} from "../../../apps/server/src/features/roadmap-horizon/server/roadmap-horizon";
import { createSource } from "../../../apps/server/src/features/sources-and-freshness/server/sources";
import {
	applyTag,
	createTag,
} from "../../../apps/server/src/features/tags/server/tags";
import { addChecklistItem } from "../../../apps/server/src/features/work-checklists/server/work-checklists";
import {
	changeWorkStatus,
	closeWork,
	createWork,
	includeWork,
	updateWorkPlanningDates,
} from "../../../apps/server/src/features/work-lifecycle/server/work-lifecycle";
import { assertCommitted } from "./committed";
import { idempotencyKey, type SeedContext } from "./context";

export interface SeededProject {
	id: string;
	name: string;
	shortCode: string;
}

export interface SeededWork {
	id: string;
	key: string;
	revision: number;
	status: string;
	title: string;
	type: string;
}

export async function seedProject(
	ctx: SeedContext,
	input: {
		name: string;
		prefix: string;
		shortCode: string;
		starterConfiguration: StarterConfiguration;
	}
): Promise<SeededProject> {
	if (ctx.dryRun) {
		return {
			id: `dry-run-project-${input.prefix}`,
			name: input.name,
			shortCode: input.shortCode,
		};
	}

	const created = await createProject(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "create-project"),
		origin: "human",
		payload: {
			name: input.name,
			starterConfiguration: input.starterConfiguration,
		},
		workspaceId: ctx.workspaceId,
	});
	assertCommitted(created, `createProject(${input.name})`);

	if (created.project.shortCode !== input.shortCode) {
		const updated = await updateShortCode(ctx.prisma, {
			actorId: ctx.actorId,
			baseRevision: created.project.revision,
			idempotencyKey: idempotencyKey(input.prefix, "short-code"),
			origin: "human",
			projectId: created.project.id,
			shortCode: input.shortCode,
		});
		assertCommitted(updated, `updateShortCode(${input.shortCode})`);
		return {
			id: updated.project.id,
			name: updated.project.name,
			shortCode: updated.project.shortCode,
		};
	}

	return {
		id: created.project.id,
		name: created.project.name,
		shortCode: created.project.shortCode,
	};
}

export async function seedWork(
	ctx: SeedContext,
	input: {
		projectId: string;
		prefix: string;
		title: string;
		type?: string;
	}
): Promise<SeededWork> {
	if (ctx.dryRun) {
		return {
			id: `dry-run-work-${input.prefix}`,
			key: `${input.prefix}-1`,
			revision: 1,
			status: "Not Started",
			title: input.title,
			type: input.type ?? "Task",
		};
	}

	const created = await createWork(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "create-work"),
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
			type: input.type,
		},
	});
	assertCommitted(created, `createWork(${input.title})`);
	return created.work;
}

export async function seedWorkStatus(
	ctx: SeedContext,
	input: {
		prefix: string;
		status: string;
		work: SeededWork;
	}
): Promise<SeededWork> {
	if (ctx.dryRun) {
		return { ...input.work, status: input.status };
	}

	const changed = await changeWorkStatus(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		idempotencyKey: idempotencyKey(input.prefix, "status"),
		origin: "human",
		status: input.status,
		workId: input.work.id,
	});
	assertCommitted(changed, `changeWorkStatus(${input.work.title})`);
	return changed.work;
}

export async function seedWorkClose(
	ctx: SeedContext,
	input: {
		prefix: string;
		result: "Completed" | "Abandoned";
		work: SeededWork;
	}
): Promise<SeededWork> {
	if (ctx.dryRun) {
		return { ...input.work, status: "Closed" };
	}

	const closed = await closeWork(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		idempotencyKey: idempotencyKey(input.prefix, "close"),
		origin: "human",
		result: input.result,
		workId: input.work.id,
	});
	assertCommitted(closed, `closeWork(${input.work.title})`);
	return closed.work;
}

export async function seedWorkPlanningDates(
	ctx: SeedContext,
	input: {
		prefix: string;
		plannedStart?: string | null;
		reappearDate?: string | null;
		targetDate?: string | null;
		work: SeededWork;
	}
): Promise<SeededWork> {
	if (ctx.dryRun) {
		return input.work;
	}

	const updated = await updateWorkPlanningDates(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		idempotencyKey: idempotencyKey(input.prefix, "planning-dates"),
		origin: "human",
		plannedStart: input.plannedStart ?? null,
		reappearDate: input.reappearDate ?? null,
		targetDate: input.targetDate ?? null,
		workId: input.work.id,
	});
	assertCommitted(updated, `updateWorkPlanningDates(${input.work.title})`);
	return updated.work;
}

export async function seedIncludeWork(
	ctx: SeedContext,
	input: {
		feature: SeededWork;
		prefix: string;
		work: SeededWork;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const included = await includeWork(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		featureId: input.feature.id,
		idempotencyKey: idempotencyKey(input.prefix, "include"),
		origin: "human",
		workId: input.work.id,
	});
	assertCommitted(included, `includeWork(${input.work.title})`);
}

export async function seedHorizon(
	ctx: SeedContext,
	input: {
		horizon: "Now" | "Next" | "Later" | null;
		prefix: string;
		workId: string;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const placed = await placeHorizon(ctx.prisma, {
		horizon: input.horizon,
		workId: input.workId,
	});
	assertCommitted(placed, `placeHorizon(${input.prefix})`);
}

export async function seedMilestone(
	ctx: SeedContext,
	input: {
		prefix: string;
		projectId: string;
		targetDate?: string;
		title: string;
		work: SeededWork;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const created = await createMilestone(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "milestone"),
		projectId: input.projectId,
		targetDate: input.targetDate ?? null,
		title: input.title,
	});
	assertCommitted(created, `createMilestone(${input.title})`);

	const linked = await contributeToMilestone(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "milestone-link"),
		milestoneId: created.milestone.id,
		workId: input.work.id,
	});
	assertCommitted(linked, `contributeToMilestone(${input.title})`);
}

export async function seedBlocker(
	ctx: SeedContext,
	input: {
		blocked: SeededWork;
		prefix: string;
		source: SeededWork;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const added = await addActiveBlockingRelation(ctx.prisma, {
		actorId: ctx.actorId,
		blockedWorkId: input.blocked.id,
		idempotencyKey: idempotencyKey(input.prefix, "blocker"),
		origin: "human",
		source: { id: input.source.id, kind: "Work" },
		viewerWorkspaceId: ctx.workspaceId,
	});
	assertCommitted(added, `addActiveBlockingRelation(${input.prefix})`);
}

export async function seedWorkspaceTag(
	ctx: SeedContext,
	input: {
		name: string;
		prefix: string;
		work: SeededWork;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const tag = await createTag(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "tag"),
		name: input.name,
		origin: "human",
		workspaceId: ctx.workspaceId,
	});
	assertCommitted(tag, `createTag(${input.name})`);

	const applied = await applyTag(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		idempotencyKey: idempotencyKey(input.prefix, "apply-tag"),
		origin: "human",
		tagId: tag.tag.id,
		workId: input.work.id,
	});
	assertCommitted(applied, `applyTag(${input.name})`);
}

export async function seedChecklistItem(
	ctx: SeedContext,
	input: {
		prefix: string;
		title: string;
		work: SeededWork;
	}
): Promise<SeededWork> {
	if (ctx.dryRun) {
		return input.work;
	}

	const added = await addChecklistItem(ctx.prisma, {
		actorId: ctx.actorId,
		baseRevision: input.work.revision,
		idempotencyKey: idempotencyKey(input.prefix, "checklist"),
		origin: "human",
		title: input.title,
		workId: input.work.id,
	});
	assertCommitted(added, `addChecklistItem(${input.title})`);
	const { work } = added.checklist;
	return {
		id: work.id,
		key: work.key,
		revision: work.revision,
		status: work.status,
		title: input.work.title,
		type: input.work.type,
	};
}

export async function seedProjectDocument(
	ctx: SeedContext,
	input: {
		body?: string;
		prefix: string;
		projectId: string;
		title: string;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const created = await createDocument(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "document"),
		origin: "human",
		payload: {
			body: input.body ?? "",
			scope: { kind: "project", projectId: input.projectId },
			title: input.title,
			type: "General",
		},
		workspaceId: ctx.workspaceId,
	});
	assertCommitted(created, `createDocument(${input.title})`);
}

export async function seedProjectSource(
	ctx: SeedContext,
	input: {
		capturedContent: string;
		prefix: string;
		projectId: string;
		title: string;
		url: string;
	}
): Promise<void> {
	if (ctx.dryRun) {
		return;
	}

	const created = await createSource(ctx.prisma, {
		actorId: ctx.actorId,
		idempotencyKey: idempotencyKey(input.prefix, "source"),
		origin: "human",
		payload: {
			capturedContent: input.capturedContent,
			projectId: input.projectId,
			title: input.title,
			url: input.url,
		},
	});
	assertCommitted(created, `createSource(${input.title})`);
}
