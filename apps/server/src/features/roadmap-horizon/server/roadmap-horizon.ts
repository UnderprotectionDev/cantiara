import type { Prisma, PrismaClient } from "@cantiara/db";

import { BLOCKERS_COPY } from "../../blockers/server/blockers-model";
import { getProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	isRoadmapGroupField,
	isRoadmapHorizon,
	isRoadmapPresentation,
	type ListRoadmapQuery,
	listRoadmapQuerySchema,
	type PlaceCandidateChange,
	type PlaceCandidateCommand,
	type PlaceHorizonCommand,
	type PreviewPlaceCandidateCommand,
	placeCandidateCommandSchema,
	placeHorizonCommandSchema,
	previewPlaceCandidateCommandSchema,
	ROADMAP_BLOCKER_SOURCE_KINDS,
	ROADMAP_CANDIDATE_WRITES,
	ROADMAP_COPY,
	ROADMAP_INNER_MEMBERSHIP,
	ROADMAP_PRESENTATION_WRITES,
	ROADMAP_PRESENTATIONS,
	ROADMAP_WRITES,
	type RoadmapBlockerBadge,
	type RoadmapBlockerSourceKind,
	type RoadmapGroup,
	type RoadmapGroupField,
	type RoadmapHorizon,
	type RoadmapNamedView,
	type RoadmapPresentation,
	type RoadmapView,
	type RoadmapWorkItem,
	type SaveRoadmapNamedViewCommand,
	saveRoadmapNamedViewCommandSchema,
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
	return {
		copy: {
			later: ROADMAP_COPY.later,
			next: ROADMAP_COPY.next,
			now: ROADMAP_COPY.now,
			presentationMode: ROADMAP_COPY.presentationMode,
			roadmap: ROADMAP_COPY.roadmap,
			unplannedCandidates: ROADMAP_COPY.unplannedCandidates,
		},
		groups: groupItems(items, groupField),
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
			items: items.filter(isUnplannedCandidate),
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
		.map((row) => toItem(row, originLinks, input.presentation, badges));
}

async function activeBlockerBadges(
	prisma: RoadmapDb,
	workIds: readonly string[]
): Promise<Map<string, RoadmapBlockerBadge>> {
	const badges = new Map<string, RoadmapBlockerBadge>();
	if (workIds.length === 0) {
		return badges;
	}
	const rows = await prisma.typedRelation.findMany({
		orderBy: { establishedAt: "asc" },
		where: {
			blockerState: BLOCKERS_COPY.active,
			toId: { in: [...workIds] },
			toKind: "Work",
			type: RELATIONS_COPY.blocks,
		},
	});
	for (const row of rows) {
		if (!isRoadmapBlockerSourceKind(row.fromKind)) {
			continue;
		}
		const source = { id: row.fromId, kind: row.fromKind };
		const existing = badges.get(row.toId);
		if (existing) {
			existing.sources.push(source);
			continue;
		}
		badges.set(row.toId, {
			blockedWorkId: row.toId,
			copy: { openSourceRecord: ROADMAP_COPY.openSourceRecord },
			sources: [source],
		});
	}
	return badges;
}

function isRoadmapBlockerSourceKind(
	value: string
): value is RoadmapBlockerSourceKind {
	return (ROADMAP_BLOCKER_SOURCE_KINDS as readonly string[]).includes(value);
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
	return {
		blockerBadge: badges.get(row.id) ?? null,
		expectedOutcome: null,
		horizon: asHorizon(row.horizon),
		id: row.id,
		key: row.key,
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
