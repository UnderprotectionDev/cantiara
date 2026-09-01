import type { Prisma, PrismaClient } from "@cantiara/db";

import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type ApplyNotNowCommand,
	applyNotNowCommandSchema,
	NOT_NOW_WRITES,
	type NotNowDraft,
	type NotNowGround,
	type NotNowReviewLaterEffect,
	notNowDraftSchema,
	type ReconsiderNotNowCommand,
	ROADMAP_COPY,
	reconsiderNotNowCommandSchema,
} from "./roadmap-horizon-model";

type NotNowDb = PrismaClient | Prisma.TransactionClient;

export interface NotNowTrailRecord {
	actorId: string;
	closeAction: string | null;
	closedAt: string | null;
	grounds: NotNowGround[];
	id: string;
	reason: string;
	recordedAt: string;
	reevaluationCondition: string | null;
	state: "active" | "closed";
}

export interface NotNowReviewLaterPreview {
	effect: NotNowReviewLaterEffect;
	ids: string[];
	silentDelete: false;
}

export interface NotNowPreview {
	active: NotNowTrailRecord | null;
	conditionWatched: false;
	grounds: NotNowGround[];
	history: NotNowTrailRecord[];
	reason: string;
	reevaluationCondition: string | null;
	replacesActive: boolean;
	reviewLater: NotNowReviewLaterPreview;
	writes: typeof NOT_NOW_WRITES;
}

export interface NotNowView {
	active: NotNowTrailRecord | null;
	autoReactivate: false;
	conditionWatched: false;
	decisionRecord: false;
	history: NotNowTrailRecord[];
	parked: false;
	reviewLater: { ids: string[]; silentDelete: false };
	work: {
		horizon: string | null;
		id: string;
		plannedStart: string | null;
		status: string;
		targetDate: string | null;
	};
	writes: typeof NOT_NOW_WRITES;
}

export type NotNowWriteOutcome =
	| { status: "committed"; trail: NotNowView }
	| {
			reason:
				| "preview-required"
				| "target-not-found"
				| "work-not-open"
				| "no-active-trail";
			status: "rejected";
	  };

export interface NotNowMark {
	reason: string;
	workId: string;
}

export async function previewNotNow(
	prisma: PrismaClient,
	draft: unknown
): Promise<NotNowPreview | { reason: "target-not-found"; status: "rejected" }> {
	const parsed = notNowDraftSchema.safeParse(draft);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const work = await getWork(prisma, parsed.data.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return await buildPreview(prisma, parsed.data);
}

export async function applyNotNow(
	prisma: PrismaClient,
	command: unknown
): Promise<NotNowWriteOutcome> {
	const parsed = applyNotNowCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "preview-required", status: "rejected" };
	}
	return await prisma.$transaction((tx) => applyInTransaction(tx, parsed.data));
}

export async function previewReconsiderNotNow(
	prisma: PrismaClient,
	input: { reviewLaterEffect?: NotNowReviewLaterEffect; workId: string }
): Promise<NotNowPreview | { reason: "target-not-found"; status: "rejected" }> {
	const work = await getWork(prisma, input.workId);
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const view = await loadNotNowView(prisma, input.workId);
	if (!view?.active) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const effect = input.reviewLaterEffect ?? ROADMAP_COPY.keepReviewLater;
	return {
		active: view.active,
		conditionWatched: false,
		grounds: view.active.grounds,
		history: view.history,
		reason: view.active.reason,
		reevaluationCondition: view.active.reevaluationCondition,
		replacesActive: false,
		reviewLater: {
			effect,
			ids: view.reviewLater.ids,
			silentDelete: false,
		},
		writes: NOT_NOW_WRITES,
	};
}

export async function reconsiderNotNow(
	prisma: PrismaClient,
	command: unknown
): Promise<NotNowWriteOutcome> {
	const parsed = reconsiderNotNowCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "preview-required", status: "rejected" };
	}
	return await prisma.$transaction((tx) =>
		reconsiderInTransaction(tx, parsed.data)
	);
}

export async function getNotNowTrail(
	prisma: NotNowDb,
	workId: string
): Promise<NotNowView | null> {
	return await loadNotNowView(prisma, workId);
}

export async function listNotNowMarks(
	prisma: NotNowDb,
	projectId: string
): Promise<NotNowMark[]> {
	const rows = await prisma.workNotNowTrail.findMany({
		orderBy: { recordedAt: "asc" },
		where: {
			state: "active",
			work: { projectId, retiredIntoId: null },
		},
	});
	return rows.map((row) => ({
		reason: row.reason,
		workId: row.workId,
	}));
}

export async function notNowReasonByWorkId(
	prisma: NotNowDb,
	workIds: readonly string[]
): Promise<Map<string, string>> {
	if (workIds.length === 0) {
		return new Map();
	}
	const rows = await prisma.workNotNowTrail.findMany({
		where: { state: "active", workId: { in: [...workIds] } },
	});
	return new Map(rows.map((row) => [row.workId, row.reason]));
}

async function applyInTransaction(
	tx: Prisma.TransactionClient,
	command: ApplyNotNowCommand
): Promise<NotNowWriteOutcome> {
	const work = await tx.work.findFirst({
		where: { id: command.workId, retiredIntoId: null },
	});
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (work.status === WORK_STATUS.closed) {
		return { reason: "work-not-open", status: "rejected" };
	}
	const active = await tx.workNotNowTrail.findFirst({
		where: { state: "active", workId: command.workId },
	});
	if (active) {
		await tx.workNotNowTrail.update({
			data: {
				closeAction: ROADMAP_COPY.notNow,
				closedAt: new Date(),
				state: "closed",
			},
			where: { id: active.id },
		});
	}
	const condition = emptyToNull(command.reevaluationCondition);
	await tx.workNotNowTrail.create({
		data: {
			actorId: command.actorId,
			grounds: command.grounds,
			id: crypto.randomUUID(),
			reason: command.reason,
			reevaluationCondition: condition,
			state: "active",
			workId: command.workId,
		},
	});
	const nextIds = nextReviewLaterIds(
		parseIdList(work.notNowReviewLaterIds),
		command.linkedReviewLaterIds ?? [],
		command.reviewLaterEffect ?? ROADMAP_COPY.keepReviewLater
	);
	await tx.work.update({
		data: { notNowReviewLaterIds: nextIds },
		where: { id: command.workId },
	});
	const trail = await loadNotNowView(tx, command.workId);
	if (!trail) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return { status: "committed", trail };
}

async function reconsiderInTransaction(
	tx: Prisma.TransactionClient,
	command: ReconsiderNotNowCommand
): Promise<NotNowWriteOutcome> {
	const work = await tx.work.findFirst({
		where: { id: command.workId, retiredIntoId: null },
	});
	if (!work) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const active = await tx.workNotNowTrail.findFirst({
		where: { state: "active", workId: command.workId },
	});
	if (!active) {
		return { reason: "no-active-trail", status: "rejected" };
	}
	await tx.workNotNowTrail.update({
		data: {
			closeAction: ROADMAP_COPY.reconsidering,
			closedAt: new Date(),
			state: "closed",
		},
		where: { id: active.id },
	});
	const nextIds = nextReviewLaterIds(
		parseIdList(work.notNowReviewLaterIds),
		[],
		command.reviewLaterEffect ?? ROADMAP_COPY.keepReviewLater
	);
	await tx.work.update({
		data: { notNowReviewLaterIds: nextIds },
		where: { id: command.workId },
	});
	const trail = await loadNotNowView(tx, command.workId);
	if (!trail) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return { status: "committed", trail };
}

async function buildPreview(
	prisma: NotNowDb,
	draft: NotNowDraft
): Promise<NotNowPreview> {
	const view = await loadNotNowView(prisma, draft.workId);
	const existingIds = view?.reviewLater.ids ?? [];
	const incoming = draft.linkedReviewLaterIds ?? [];
	const effect = draft.reviewLaterEffect ?? ROADMAP_COPY.keepReviewLater;
	const previewIds = nextReviewLaterIds(existingIds, incoming, effect);
	return {
		active: view?.active ?? null,
		conditionWatched: false,
		grounds: draft.grounds,
		history: view?.history ?? [],
		reason: draft.reason,
		reevaluationCondition: emptyToNull(draft.reevaluationCondition),
		replacesActive: view?.active !== null,
		reviewLater: {
			effect,
			ids: previewIds,
			silentDelete: false,
		},
		writes: NOT_NOW_WRITES,
	};
}

async function loadNotNowView(
	prisma: NotNowDb,
	workId: string
): Promise<NotNowView | null> {
	const work = await prisma.work.findFirst({
		where: { id: workId, retiredIntoId: null },
	});
	if (!work) {
		return null;
	}
	const rows = await prisma.workNotNowTrail.findMany({
		orderBy: { recordedAt: "asc" },
		where: { workId },
	});
	const records = rows.map(toTrailRecord);
	const active = records.find((row) => row.state === "active") ?? null;
	const history = records.filter((row) => row.state === "closed");
	return {
		active,
		autoReactivate: false,
		conditionWatched: false,
		decisionRecord: false,
		history,
		parked: false,
		reviewLater: {
			ids: parseIdList(work.notNowReviewLaterIds),
			silentDelete: false,
		},
		work: {
			horizon: work.horizon,
			id: work.id,
			plannedStart: work.plannedStart,
			status: work.status,
			targetDate: work.targetDate,
		},
		writes: NOT_NOW_WRITES,
	};
}

function toTrailRecord(row: {
	actorId: string;
	closeAction: string | null;
	closedAt: Date | null;
	grounds: Prisma.JsonValue;
	id: string;
	reason: string;
	recordedAt: Date;
	reevaluationCondition: string | null;
	state: string;
}): NotNowTrailRecord {
	return {
		actorId: row.actorId,
		closeAction: row.closeAction,
		closedAt: row.closedAt?.toISOString() ?? null,
		grounds: parseGrounds(row.grounds),
		id: row.id,
		reason: row.reason,
		recordedAt: row.recordedAt.toISOString(),
		reevaluationCondition: row.reevaluationCondition,
		state: row.state === "closed" ? "closed" : "active",
	};
}

function parseGrounds(value: Prisma.JsonValue): NotNowGround[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => {
		if (
			item &&
			typeof item === "object" &&
			"id" in item &&
			"kind" in item &&
			typeof item.id === "string" &&
			typeof item.kind === "string"
		) {
			return [{ id: item.id, kind: item.kind as NotNowGround["kind"] }];
		}
		return [];
	});
}

function parseIdList(value: Prisma.JsonValue): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function nextReviewLaterIds(
	existing: readonly string[],
	incoming: readonly string[],
	effect: NotNowReviewLaterEffect
): string[] {
	if (effect === ROADMAP_COPY.removeReviewLater) {
		return [];
	}
	return [...new Set([...existing, ...incoming])];
}

function emptyToNull(value: string | null | undefined): string | null {
	if (value === undefined || value === null) {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}
