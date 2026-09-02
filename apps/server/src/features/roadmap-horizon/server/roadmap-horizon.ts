import type { Prisma, PrismaClient } from "@cantiara/db";

import { listActiveBlockerSources } from "../../blockers/server/blockers";
import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { getProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import { notNowReasonByWorkId } from "./not-now-trail";
import {
	type ContributeToMilestoneCommand,
	type CreateMilestoneCommand,
	contributeToMilestoneCommandSchema,
	createMilestoneCommandSchema,
	getMilestoneQuerySchema,
	isMilestoneStatus,
	isRoadmapGroupField,
	isRoadmapHorizon,
	isRoadmapPresentation,
	type ListRoadmapQuery,
	listMilestonesQuerySchema,
	listRoadmapQuerySchema,
	MILESTONE_COPY,
	MILESTONE_COUNTERPARTS,
	MILESTONE_WRITES,
	type MilestoneStatus,
	type MilestoneView,
	type PlaceCandidateChange,
	type PlaceCandidateCommand,
	type PlaceHorizonCommand,
	type PreviewPlaceCandidateCommand,
	placeCandidateCommandSchema,
	placeHorizonCommandSchema,
	previewPlaceCandidateCommandSchema,
	ROADMAP_CANDIDATE_WRITES,
	ROADMAP_COPY,
	ROADMAP_INNER_MEMBERSHIP,
	ROADMAP_PRESENTATION_WRITES,
	ROADMAP_PRESENTATIONS,
	ROADMAP_WRITES,
	type RoadmapBlockerBadge,
	type RoadmapGroup,
	type RoadmapGroupField,
	type RoadmapHorizon,
	type RoadmapNamedView,
	type RoadmapPresentation,
	type RoadmapView,
	type RoadmapWorkItem,
	type SaveRoadmapNamedViewCommand,
	type SetMilestoneStatusCommand,
	saveRoadmapNamedViewCommandSchema,
	setMilestoneStatusCommandSchema,
} from "./roadmap-horizon-model";

type RoadmapDb = PrismaClient | Prisma.TransactionClient;

export type PlaceHorizonOutcome =
	| {
			placement: { horizon: RoadmapHorizon | null; workId: string };
			status: "committed";
			work: {
				horizon: RoadmapHorizon | null;
				id: string;
				status: string;
				targetDate: string | null;
			};
			writes: typeof ROADMAP_WRITES;
	  }
	| { reason: "target-not-found" | "unknown-horizon"; status: "rejected" };

export type SaveNamedViewOutcome =
	| { status: "committed"; view: RoadmapNamedView }
	| { reason: "target-not-found" | "unknown-presentation"; status: "rejected" };

export type MilestoneWriteOutcome =
	| { milestone: MilestoneView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: "target-not-found"; status: "rejected" };

export type SetMilestoneStatusOutcome =
	| {
			milestone: MilestoneView;
			status: "committed";
			work: MilestoneView["contributingWork"];
	  }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: "target-not-found"; status: "rejected" };

export type ContributeToMilestoneOutcome =
	| {
			milestone: MilestoneView;
			relation: { type: string };
			status: "committed";
	  }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: "target-not-found" | "ends-not-allowed"; status: "rejected" };

export type PreviewPlaceCandidateOutcome =
	| {
			confirmRequired: true;
			preview: {
				field: PlaceCandidateChange["field"];
				from: string | null;
				to: string;
			};
			status: "ready";
			workId: string;
			writes: typeof ROADMAP_CANDIDATE_WRITES;
	  }
	| { reason: "target-not-found" | "unknown-change"; status: "rejected" };

export type PlaceCandidateOutcome =
	| {
			status: "committed";
			work: {
				horizon: RoadmapHorizon | null;
				id: string;
				plannedStart: string | null;
				status: string;
				targetDate: string | null;
			};
			writes: typeof ROADMAP_CANDIDATE_WRITES;
	  }
	| {
			reason:
				| "confirm-required"
				| "target-not-found"
				| "unknown-change"
				| "unknown-horizon";
			status: "rejected";
	  };

export async function listRoadmap(
	prisma: PrismaClient,
	query: unknown
): Promise<RoadmapView | { reason: "target-not-found"; status: "rejected" }> {
	const parsed = listRoadmapQuerySchema.safeParse(query);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = await getProject(prisma, parsed.data.projectId);
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const namedView = await namedViewFor(prisma, parsed.data);
	const presentation =
		namedView?.presentation ??
		parsed.data.presentation ??
		ROADMAP_COPY.productDirection;
	const groupField =
		namedView?.groupField ?? parsed.data.groupField ?? ROADMAP_COPY.horizon;
	const horizonFilter =
		namedView?.horizonFilter ?? parsed.data.horizonFilter ?? null;
	const items = await roadmapItems(prisma, {
		horizonFilter,
		presentation,
		projectId: parsed.data.projectId,
		workspaceId: project.workspaceId,
	});
	const planned = items.filter((item) => !isUnplannedCandidate(item));
	const candidates = items.filter(isUnplannedCandidate);
	return {
		copy: {
			later: ROADMAP_COPY.later,
			next: ROADMAP_COPY.next,
			now: ROADMAP_COPY.now,
			presentationMode: ROADMAP_COPY.presentationMode,
			roadmap: ROADMAP_COPY.roadmap,
			unplannedCandidates: ROADMAP_COPY.unplannedCandidates,
		},
		groups: groupItems(planned, groupField),
		innerMembership: ROADMAP_INNER_MEMBERSHIP,
		namedView,
		presentation,
		presentationMode: parsed.data.presentationMode
			? {
					configurationHidden: true,
					detailsReadOnly: true,
					editingHidden: true,
					mode: ROADMAP_COPY.presentationMode,
					namedViewId: namedView?.id ?? parsed.data.namedViewId ?? null,
					writes: ROADMAP_PRESENTATION_WRITES,
				}
			: null,
		showOnRoadmap: false,
		unplannedCandidates: {
			collapsed: true,
			copy: { unplannedCandidates: ROADMAP_COPY.unplannedCandidates },
			items: candidates,
			membership: "live-filter",
			parked: false,
		},
		writes: ROADMAP_WRITES,
	};
}

export async function placeHorizon(
	prisma: PrismaClient,
	command: unknown
): Promise<PlaceHorizonOutcome> {
	const parsed = placeHorizonCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "unknown-horizon", status: "rejected" };
	}
	return await applyHorizon(prisma, parsed.data);
}

export async function getHorizonPlacement(
	prisma: RoadmapDb,
	workId: string
): Promise<{
	horizon: RoadmapHorizon | null;
	workId: string;
	writes: typeof ROADMAP_WRITES;
} | null> {
	const row = await prisma.work.findFirst({
		where: { id: workId, retiredIntoId: null },
	});
	if (!row) {
		return null;
	}
	return {
		horizon: asHorizon(row.horizon),
		workId: row.id,
		writes: ROADMAP_WRITES,
	};
}

export async function saveRoadmapNamedView(
	prisma: PrismaClient,
	command: unknown
): Promise<SaveNamedViewOutcome> {
	const parsed = saveRoadmapNamedViewCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "unknown-presentation", status: "rejected" };
	}
	const project = await getProject(prisma, parsed.data.projectId);
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await upsertNamedView(prisma, parsed.data);
}

export async function previewPlaceCandidate(
	prisma: PrismaClient,
	command: unknown
): Promise<PreviewPlaceCandidateOutcome> {
	const parsed = previewPlaceCandidateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "unknown-change", status: "rejected" };
	}
	return await previewCandidate(prisma, parsed.data);
}

export async function placeCandidate(
	prisma: PrismaClient,
	command: unknown
): Promise<PlaceCandidateOutcome> {
	const parsed = placeCandidateCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "unknown-change", status: "rejected" };
	}
	if (!parsed.data.confirmed) {
		return { reason: "confirm-required", status: "rejected" };
	}
	return await applyCandidate(prisma, parsed.data);
}

async function applyHorizon(
	prisma: PrismaClient,
	command: PlaceHorizonCommand
): Promise<PlaceHorizonOutcome> {
	const work = await getWork(prisma, command.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const updated = await prisma.work.update({
		data: {
			horizon: command.horizon,
			revision: { increment: 1 },
		},
		where: { id: command.workId },
	});
	return {
		placement: { horizon: command.horizon, workId: command.workId },
		status: "committed",
		work: {
			horizon: asHorizon(updated.horizon),
			id: updated.id,
			status: updated.status,
			targetDate: updated.targetDate ?? null,
		},
		writes: ROADMAP_WRITES,
	};
}

async function namedViewFor(
	prisma: RoadmapDb,
	query: ListRoadmapQuery
): Promise<RoadmapNamedView | null> {
	if (!query.namedViewId) {
		return null;
	}
	const row = await prisma.projectRoadmapNamedView.findFirst({
		where: { id: query.namedViewId, projectId: query.projectId },
	});
	if (!row) {
		return null;
	}
	return toNamedView(row);
}

async function upsertNamedView(
	prisma: PrismaClient,
	command: SaveRoadmapNamedViewCommand
): Promise<SaveNamedViewOutcome> {
	const existing = await prisma.projectRoadmapNamedView.findUnique({
		where: {
			projectId_name: { name: command.name, projectId: command.projectId },
		},
	});
	const data = {
		groupField: command.groupField ?? null,
		horizonFilter: command.horizonFilter ?? null,
		name: command.name,
		presentation: command.presentation,
		projectId: command.projectId,
	};
	const row = existing
		? await prisma.projectRoadmapNamedView.update({
				data: {
					groupField: data.groupField,
					horizonFilter: data.horizonFilter,
					presentation: data.presentation,
					revision: { increment: 1 },
				},
				where: { id: existing.id },
			})
		: await prisma.projectRoadmapNamedView.create({
				data: {
					...data,
					id: crypto.randomUUID(),
					revision: 1,
				},
			});
	return { status: "committed", view: toNamedView(row) };
}

async function roadmapItems(
	prisma: RoadmapDb,
	input: {
		horizonFilter: RoadmapHorizon | null;
		presentation: RoadmapPresentation;
		projectId: string;
		workspaceId: string;
	}
): Promise<RoadmapWorkItem[]> {
	const rows = await prisma.work.findMany({
		orderBy: { number: "asc" },
		where: {
			archived: false,
			projectId: input.projectId,
			retiredIntoId: null,
			trashedAt: null,
		},
	});
	const originLinks = await originFeatureIds(prisma, rows, input.workspaceId);
	const selected = rows.filter((row) =>
		matchesPresentation(row, input.presentation, originLinks)
	);
	const notNowReasons = await notNowReasonByWorkId(
		prisma,
		selected.map((row) => row.id)
	);
	const badges = await activeBlockerBadges(
		prisma,
		selected.map((row) => row.id)
	);
	return selected
		.filter((row) =>
			input.horizonFilter === null
				? true
				: asHorizon(row.horizon) === input.horizonFilter
		)
		.map((row) =>
			toItem(row, originLinks, input.presentation, notNowReasons, badges)
		);
}

async function activeBlockerBadges(
	prisma: RoadmapDb,
	workIds: readonly string[]
): Promise<Map<string, RoadmapBlockerBadge>> {
	const badges = new Map<string, RoadmapBlockerBadge>();
	const sources = await listActiveBlockerSources(
		prisma as PrismaClient,
		workIds
	);
	for (const [blockedWorkId, sourceList] of sources) {
		if (sourceList.length === 0) {
			continue;
		}
		badges.set(blockedWorkId, {
			blockedWorkId,
			copy: { openSourceRecord: ROADMAP_COPY.openSourceRecord },
			sources: sourceList,
		});
	}
	return badges;
}

async function previewCandidate(
	prisma: RoadmapDb,
	command: PreviewPlaceCandidateCommand
): Promise<PreviewPlaceCandidateOutcome> {
	const row = await prisma.work.findFirst({
		where: { id: command.workId, retiredIntoId: null },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		confirmRequired: true,
		preview: candidatePreview(row, command.change),
		status: "ready",
		workId: command.workId,
		writes: ROADMAP_CANDIDATE_WRITES,
	};
}

async function applyCandidate(
	prisma: PrismaClient,
	command: PlaceCandidateCommand
): Promise<PlaceCandidateOutcome> {
	if (command.change.field === ROADMAP_COPY.horizon) {
		const placed = await applyHorizon(prisma, {
			horizon: command.change.horizon,
			workId: command.workId,
		});
		if (placed.status !== "committed") {
			return placed;
		}
		const dates = await prisma.work.findFirst({
			select: { plannedStart: true, targetDate: true },
			where: { id: command.workId },
		});
		return {
			status: "committed",
			work: {
				horizon: placed.work.horizon,
				id: placed.work.id,
				plannedStart: dates?.plannedStart ?? null,
				status: placed.work.status,
				targetDate: dates?.targetDate ?? placed.work.targetDate,
			},
			writes: ROADMAP_CANDIDATE_WRITES,
		};
	}
	const current = await getWork(prisma, command.workId);
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (!(command.actorId && command.idempotencyKey)) {
		return { reason: "unknown-change", status: "rejected" };
	}
	const dated = await updateWorkPlanningDates(prisma, {
		actorId: command.actorId,
		baseRevision: current.revision,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		plannedStart:
			command.change.field === ROADMAP_COPY.plannedStart
				? command.change.plannedStart
				: (current.plannedStart ?? null),
		reappearDate: current.reappearDate ?? null,
		targetDate:
			command.change.field === ROADMAP_COPY.targetDate
				? command.change.targetDate
				: (current.targetDate ?? null),
		workId: command.workId,
	});
	if (dated.status !== "committed") {
		return { reason: "target-not-found", status: "rejected" };
	}
	const placement = await getHorizonPlacement(prisma, command.workId);
	return {
		status: "committed",
		work: {
			horizon: placement?.horizon ?? null,
			id: dated.work.id,
			plannedStart: dated.work.plannedStart ?? null,
			status: dated.work.status,
			targetDate: dated.work.targetDate ?? null,
		},
		writes: ROADMAP_CANDIDATE_WRITES,
	};
}

function candidatePreview(
	row: {
		horizon: string | null;
		plannedStart: string | null;
		targetDate: string | null;
	},
	change: PlaceCandidateChange
): {
	field: PlaceCandidateChange["field"];
	from: string | null;
	to: string;
} {
	if (change.field === ROADMAP_COPY.horizon) {
		return {
			field: change.field,
			from: asHorizon(row.horizon),
			to: change.horizon,
		};
	}
	if (change.field === ROADMAP_COPY.plannedStart) {
		return {
			field: change.field,
			from: row.plannedStart,
			to: change.plannedStart,
		};
	}
	return {
		field: change.field,
		from: row.targetDate,
		to: change.targetDate,
	};
}

function isUnplannedCandidate(item: RoadmapWorkItem): boolean {
	return (
		item.horizon === null &&
		item.plannedStart === null &&
		item.targetDate === null
	);
}

async function originFeatureIds(
	prisma: RoadmapDb,
	rows: readonly { id: string; type: string }[],
	workspaceId: string
): Promise<Map<string, string>> {
	const researchIds = rows
		.filter((row) => row.type === "Research")
		.map((row) => row.id);
	const relationsByResearch = await Promise.all(
		researchIds.map((researchId) =>
			listRelations(prisma as PrismaClient, {
				record: { id: researchId, kind: "Work" },
				viewerWorkspaceId: workspaceId,
			}).then((relations) => ({ relations, researchId }))
		)
	);
	const linked = new Map<string, string>();
	for (const { relations, researchId } of relationsByResearch) {
		for (const relation of relations) {
			if (relation.type !== RELATIONS_COPY.origin) {
				continue;
			}
			if (
				relation.from.status !== "resolved" ||
				relation.to.status !== "resolved"
			) {
				continue;
			}
			if (relation.from.id === researchId && relation.to.kind === "Work") {
				linked.set(relation.to.id, researchId);
			}
		}
	}
	return linked;
}

function matchesPresentation(
	row: { id: string; type: string },
	presentation: RoadmapPresentation,
	originLinks: Map<string, string>
): boolean {
	if (presentation === ROADMAP_COPY.allWorkTypes) {
		return true;
	}
	if (row.type === "Research") {
		return true;
	}
	return row.type === "Feature" && originLinks.has(row.id);
}

function toItem(
	row: {
		description: string | null;
		horizon: string | null;
		id: string;
		key: string;
		plannedStart: string | null;
		status: string;
		targetDate: string | null;
		title: string;
		type: string;
	},
	originLinks: Map<string, string>,
	presentation: RoadmapPresentation,
	notNowReasons: Map<string, string>,
	badges: Map<string, RoadmapBlockerBadge>
): RoadmapWorkItem {
	const originWorkId = originLinks.get(row.id) ?? null;
	const primary =
		presentation === ROADMAP_COPY.allWorkTypes || row.type === "Research";
	let problemOpportunity: string | null = null;
	if (row.type === "Research") {
		const researchBody = row.description?.trim() ?? "";
		problemOpportunity = researchBody.length > 0 ? researchBody : row.title;
	}
	const notNowReason = notNowReasons.get(row.id);
	return {
		blockerBadge: badges.get(row.id) ?? null,
		expectedOutcome: null,
		horizon: asHorizon(row.horizon),
		id: row.id,
		key: row.key,
		notNow: notNowReason ? { reason: notNowReason } : null,
		originWorkId,
		plannedStart: row.plannedStart,
		problemOpportunity,
		role: primary ? ROADMAP_COPY.primary : ROADMAP_COPY.secondary,
		status: row.status,
		targetDate: row.targetDate,
		title: row.title,
		type: row.type,
	};
}

function groupItems(
	items: readonly RoadmapWorkItem[],
	groupField: RoadmapGroupField | null
): RoadmapGroup[] {
	if (groupField === null) {
		return [
			{
				field: null,
				items: [...items],
				label: ROADMAP_COPY.roadmap,
			},
		];
	}
	const keys =
		groupField === ROADMAP_COPY.horizon
			? [ROADMAP_COPY.now, ROADMAP_COPY.next, ROADMAP_COPY.later, ""]
			: uniqueTypes(items);
	return keys.map((label) => ({
		field: groupField,
		items: items.filter((item) => {
			const value = groupValue(item, groupField);
			if (label === "") {
				return value === null;
			}
			return value === label;
		}),
		label: label === "" ? ROADMAP_COPY.unplaced : label,
	}));
}

function uniqueTypes(items: readonly RoadmapWorkItem[]): string[] {
	return [...new Set(items.map((item) => item.type))];
}

function groupValue(
	item: RoadmapWorkItem,
	groupField: RoadmapGroupField
): string | null {
	if (groupField === ROADMAP_COPY.horizon) {
		return item.horizon;
	}
	return item.type;
}

function toNamedView(row: {
	groupField: string | null;
	horizonFilter: string | null;
	id: string;
	name: string;
	presentation: string;
}): RoadmapNamedView {
	return {
		groupField:
			row.groupField && isRoadmapGroupField(row.groupField)
				? row.groupField
				: null,
		horizonFilter:
			row.horizonFilter && isRoadmapHorizon(row.horizonFilter)
				? row.horizonFilter
				: null,
		id: row.id,
		name: row.name,
		presentation: isRoadmapPresentation(row.presentation)
			? row.presentation
			: ROADMAP_PRESENTATIONS[0],
	};
}

function asHorizon(value: string | null): RoadmapHorizon | null {
	if (value && isRoadmapHorizon(value)) {
		return value;
	}
	return null;
}

export async function createMilestone(
	prisma: PrismaClient,
	command: unknown
): Promise<MilestoneWriteOutcome> {
	const parsed = createMilestoneCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = await getProject(prisma, parsed.data.projectId);
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await persistMilestone(prisma, parsed.data);
}

export async function listMilestones(
	prisma: PrismaClient,
	query: unknown
): Promise<MilestoneView[]> {
	const parsed = listMilestonesQuerySchema.safeParse(query);
	if (!parsed.success) {
		return [];
	}
	const rows = await prisma.milestone.findMany({
		include: { events: { orderBy: { createdAt: "asc" } } },
		orderBy: { createdAt: "asc" },
		where: { projectId: parsed.data.projectId },
	});
	return await Promise.all(rows.map((row) => toMilestoneView(prisma, row)));
}

export async function getMilestone(
	prisma: PrismaClient,
	milestoneId: string,
	workspaceId?: string
): Promise<MilestoneView | null> {
	const parsed = getMilestoneQuerySchema.safeParse({ milestoneId });
	if (!parsed.success) {
		return null;
	}
	const row = await prisma.milestone.findUnique({
		include: { events: { orderBy: { createdAt: "asc" } }, project: true },
		where: { id: parsed.data.milestoneId },
	});
	if (!row) {
		return null;
	}
	if (workspaceId && row.project.workspaceId !== workspaceId) {
		return null;
	}
	return await toMilestoneView(prisma, row);
}

export async function setMilestoneStatus(
	prisma: PrismaClient,
	command: unknown
): Promise<SetMilestoneStatusOutcome> {
	const parsed = setMilestoneStatusCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await persistMilestoneStatus(prisma, parsed.data);
}

export async function contributeToMilestone(
	prisma: PrismaClient,
	command: unknown
): Promise<ContributeToMilestoneOutcome> {
	const parsed = contributeToMilestoneCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await persistContribution(prisma, parsed.data);
}

async function persistMilestone(
	prisma: PrismaClient,
	command: CreateMilestoneCommand
): Promise<MilestoneWriteOutcome> {
	const title = command.title.trim();
	if (title.length === 0) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const description = command.description?.trim() ?? "";
	const targetDate = command.targetDate ?? null;
	const payload = {
		description: description.length > 0 ? description : null,
		projectId: command.projectId,
		targetDate,
		title,
	};
	return await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `milestone:${command.projectId}:create`);
		const existing = await readDurableReceipt(
			tx,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return JSON.parse(existing.resultValue) as MilestoneWriteOutcome;
		}
		const created = await tx.milestone.create({
			data: {
				description: payload.description,
				id: crypto.randomUUID(),
				projectId: command.projectId,
				revision: 1,
				status: MILESTONE_COPY.planned,
				targetDate,
				title,
			},
			include: { events: { orderBy: { createdAt: "asc" } } },
		});
		await tx.milestoneStatusEvent.create({
			data: {
				id: crypto.randomUUID(),
				milestoneId: created.id,
				previousStatus: null,
				status: MILESTONE_COPY.planned,
			},
		});
		const withEvents = await tx.milestone.findUniqueOrThrow({
			include: { events: { orderBy: { createdAt: "asc" } } },
			where: { id: created.id },
		});
		const milestone = await toMilestoneView(tx, withEvents);
		const outcome: MilestoneWriteOutcome = { milestone, status: "committed" };
		await writeDurableReceipt(tx, {
			actorId: command.actorId,
			commandKey: command.idempotencyKey,
			kind: "milestone-create",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: created.id,
		});
		return outcome;
	});
}

async function persistMilestoneStatus(
	prisma: PrismaClient,
	command: SetMilestoneStatusCommand
): Promise<SetMilestoneStatusOutcome> {
	const payload = {
		milestoneId: command.milestoneId,
		status: command.status,
	};
	return await prisma.$transaction(async (tx) => {
		await lockMutation(tx, `milestone:${command.milestoneId}:status`);
		const existing = await readDurableReceipt(
			tx,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return JSON.parse(existing.resultValue) as SetMilestoneStatusOutcome;
		}
		const row = await tx.milestone.findUnique({
			include: { events: { orderBy: { createdAt: "asc" } } },
			where: { id: command.milestoneId },
		});
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		const previousStatus = isMilestoneStatus(row.status) ? row.status : null;
		await tx.milestone.update({
			data: {
				revision: { increment: 1 },
				status: command.status,
			},
			where: { id: row.id },
		});
		await tx.milestoneStatusEvent.create({
			data: {
				id: crypto.randomUUID(),
				milestoneId: row.id,
				previousStatus,
				status: command.status,
			},
		});
		const updated = await tx.milestone.findUniqueOrThrow({
			include: { events: { orderBy: { createdAt: "asc" } } },
			where: { id: row.id },
		});
		const milestone = await toMilestoneView(tx, updated);
		const outcome: SetMilestoneStatusOutcome = {
			milestone,
			status: "committed",
			work: milestone.contributingWork,
		};
		await writeDurableReceipt(tx, {
			actorId: command.actorId,
			commandKey: command.idempotencyKey,
			committedRevision: updated.revision,
			kind: "milestone-status",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: row.id,
		});
		return outcome;
	});
}

async function persistContribution(
	prisma: PrismaClient,
	command: ContributeToMilestoneCommand
): Promise<ContributeToMilestoneOutcome> {
	const milestoneRow = await prisma.milestone.findUnique({
		include: { project: true },
		where: { id: command.milestoneId },
	});
	if (!milestoneRow) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = await getWork(prisma, command.workId);
	if (!work || work.projectId !== milestoneRow.projectId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const existing = await prisma.typedRelation.findFirst({
		where: {
			fromId: command.workId,
			fromKind: "Work",
			toId: command.milestoneId,
			toKind: "Milestone",
			type: RELATIONS_COPY.contributesToMilestone,
		},
	});
	if (existing) {
		const milestone = await getMilestone(prisma, command.milestoneId);
		if (!milestone) {
			return { reason: "target-not-found", status: "rejected" };
		}
		return {
			milestone,
			relation: { type: RELATIONS_COPY.contributesToMilestone },
			status: "committed",
		};
	}
	const linked = await createRelation(prisma, {
		actorId: command.actorId,
		from: { id: command.workId, kind: "Work" },
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		previewAcknowledged: true,
		to: { id: command.milestoneId, kind: "Milestone" },
		type: RELATIONS_COPY.contributesToMilestone,
		viewerWorkspaceId: milestoneRow.project.workspaceId,
	});
	if (linked.status === "conflict") {
		return { reason: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (linked.status === "rejected") {
		return {
			reason:
				linked.reason === "ends-not-allowed"
					? "ends-not-allowed"
					: "target-not-found",
			status: "rejected",
		};
	}
	const milestone = await getMilestone(prisma, command.milestoneId);
	if (!milestone) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		milestone,
		relation: { type: linked.relation.type },
		status: "committed",
	};
}

async function toMilestoneView(
	prisma: RoadmapDb,
	row: {
		description: string | null;
		events: readonly {
			previousStatus: string | null;
			status: string;
		}[];
		id: string;
		projectId: string;
		revision: number;
		status: string;
		targetDate: string | null;
		title: string;
	}
): Promise<MilestoneView> {
	const contributingWork = await contributingWorkFor(prisma, row.id);
	return {
		contributingWork,
		copy: {
			abandoned: MILESTONE_COPY.abandoned,
			milestone: MILESTONE_COPY.milestone,
			planned: MILESTONE_COPY.planned,
			reached: MILESTONE_COPY.reached,
		},
		counterparts: MILESTONE_COUNTERPARTS,
		description: row.description,
		focusPeriodWindow: false,
		goalContribution: false,
		history: row.events.flatMap((event) => {
			const status = isMilestoneStatus(event.status) ? event.status : null;
			if (!status) {
				return [];
			}
			const previousStatus =
				event.previousStatus && isMilestoneStatus(event.previousStatus)
					? event.previousStatus
					: null;
			return [{ previousStatus, status }];
		}),
		id: row.id,
		projectId: row.projectId,
		releaseScope: false,
		revision: row.revision,
		status: asMilestoneStatus(row.status),
		targetDate: row.targetDate,
		title: row.title,
		writes: MILESTONE_WRITES,
	};
}

async function contributingWorkFor(
	prisma: RoadmapDb,
	milestoneId: string
): Promise<MilestoneView["contributingWork"]> {
	const edges = await prisma.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			toId: milestoneId,
			toKind: "Milestone",
			type: RELATIONS_COPY.contributesToMilestone,
		},
	});
	const works = await Promise.all(
		edges.map((edge) =>
			prisma.work.findFirst({
				where: { id: edge.fromId, retiredIntoId: null },
			})
		)
	);
	return works.flatMap((work) =>
		work
			? [
					{
						id: work.id,
						key: work.key,
						status: work.status,
						title: work.title,
					},
				]
			: []
	);
}

function asMilestoneStatus(value: string): MilestoneStatus {
	if (isMilestoneStatus(value)) {
		return value;
	}
	return MILESTONE_COPY.planned;
}
