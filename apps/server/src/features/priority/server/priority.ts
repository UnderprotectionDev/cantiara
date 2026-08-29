import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	type CreatePriorityCriterionCommand,
	createPriorityCriterionCommandSchema,
	emptyRankExplanations,
	isPriorityRank,
	PRIORITY_COPY,
	PRIORITY_RANKS,
	type PriorityCriterionDefinitionView,
	type PriorityCriterionOutcome,
	type PriorityCriterionValueOutcome,
	type PriorityCriterionValueView,
	type PriorityMapEvidence,
	type PriorityMapPresentation,
	type PriorityMapPresentationOutcome,
	type PriorityMapReadOutcome,
	type PriorityMapView,
	type PriorityRank,
	priorityCriterionDefinitionSchema,
	priorityCriterionValueSchema,
	type RankExplanations,
	type RelocatePriorityMapPointOutcome,
	rankExplanationsSchema,
	readPriorityMapInputSchema,
	type SavePriorityMapPresentationCommand,
	type SetPriorityCriterionValueCommand,
	savePriorityMapPresentationCommandSchema,
	setPriorityCriterionValueCommandSchema,
	type TrashPriorityCriterionCommand,
	trashPriorityCriterionCommandSchema,
	type UpdatePriorityCriterionCommand,
	updatePriorityCriterionCommandSchema,
} from "./priority-model";

type PrismaTransaction = Prisma.TransactionClient;

const SCORING_KEYS = ["formula", "score", "weight", "wsjf"] as const;

export async function createPriorityCriterion(
	prisma: PrismaClient,
	command: unknown
): Promise<PriorityCriterionOutcome> {
	const parsed = parseCreateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function updatePriorityCriterion(
	prisma: PrismaClient,
	command: unknown
): Promise<PriorityCriterionOutcome> {
	const parsed = parseUpdateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function trashPriorityCriterion(
	prisma: PrismaClient,
	command: unknown
): Promise<PriorityCriterionOutcome> {
	const parsed = parseTrashCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		trashInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function setPriorityCriterionValue(
	prisma: PrismaClient,
	command: unknown
): Promise<PriorityCriterionValueOutcome> {
	const parsed = parseSetValueCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setValueInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function listPriorityCriteria(
	prisma: PrismaClient,
	projectId: string
): Promise<PriorityCriterionDefinitionView[]> {
	const rows = await prisma.projectPriorityCriterion.findMany({
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		where: { projectId, trashedAt: null },
	});
	return rows.map(toDefinitionView);
}

export async function listWorkPriorityValues(
	prisma: PrismaClient,
	projectId: string,
	workId: string
): Promise<PriorityCriterionValueView[]> {
	const definitions = await prisma.projectPriorityCriterion.findMany({
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		where: { enabled: true, projectId, trashedAt: null },
	});
	if (definitions.length === 0) {
		return [];
	}
	const rows = await prisma.projectPriorityCriterionValue.findMany({
		where: {
			criterionId: { in: definitions.map((definition) => definition.id) },
			workId,
		},
	});
	const byCriterion = new Map(rows.map((row) => [row.criterionId, row]));
	return definitions.map((definition) => {
		const row = byCriterion.get(definition.id);
		return toValueView(definition, workId, row ?? null);
	});
}

export async function readPriorityMap(
	prisma: PrismaClient,
	input: unknown
): Promise<PriorityMapReadOutcome> {
	const parsed = readPriorityMapInputSchema.safeParse(input);
	if (!parsed.success) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (parsed.data.horizontalCriterionId === parsed.data.verticalCriterionId) {
		return { reason: "axes-not-distinct", status: "rejected" };
	}
	const axes = await loadAxes(prisma, parsed.data);
	if (axes.status !== "ok") {
		return axes;
	}
	const works = await prisma.work.findMany({
		orderBy: { number: "asc" },
		select: { id: true, key: true, title: true },
		where: {
			archived: false,
			projectId: parsed.data.projectId,
			retiredIntoId: null,
		},
	});
	const values = await prisma.projectPriorityCriterionValue.findMany({
		where: {
			criterionId: {
				in: [axes.horizontal.id, axes.vertical.id],
			},
			workId: { in: works.map((work) => work.id) },
		},
	});
	const evidenceByWork = await evidenceCounts(
		prisma,
		works.map((work) => work.id)
	);
	return {
		status: "ok",
		view: placeOnMap(
			works,
			values,
			axes.horizontal,
			axes.vertical,
			evidenceByWork
		),
	};
}

export async function savePriorityMapPresentation(
	prisma: PrismaClient,
	command: unknown
): Promise<PriorityMapPresentationOutcome> {
	if (!isRecord(command)) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	const parsed = savePriorityMapPresentationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "missing-idempotency-key", status: "rejected" };
	}
	if (
		parsed.data.payload.horizontalCriterionId ===
		parsed.data.payload.verticalCriterionId
	) {
		return { reason: "axes-not-distinct", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		savePresentationInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function getPriorityMapPresentation(
	prisma: PrismaClient,
	projectId: string
): Promise<PriorityMapPresentation | null> {
	const row = await prisma.projectPriorityMapPresentation.findUnique({
		where: { projectId },
	});
	if (!row) {
		return null;
	}
	return {
		horizontalCriterionId: row.horizontalCriterionId,
		projectId: row.projectId,
		verticalCriterionId: row.verticalCriterionId,
	};
}

export function relocatePriorityMapPoint(
	_prisma: PrismaClient,
	_command: unknown
): Promise<RelocatePriorityMapPointOutcome> {
	return Promise.resolve({
		reason: "position-is-not-order",
		status: "rejected",
	});
}

export async function clonePriorityCriteria(
	tx: PrismaTransaction,
	sourceProjectId: string,
	targetProjectId: string
): Promise<PriorityCriterionDefinitionView[]> {
	const source = await tx.projectPriorityCriterion.findMany({
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		where: { projectId: sourceProjectId, trashedAt: null },
	});
	if (source.length === 0) {
		return [];
	}
	const cloned = source.map((definition) => ({
		description: definition.description,
		enabled: definition.enabled,
		id: crypto.randomUUID(),
		name: definition.name,
		preparedKind: definition.preparedKind,
		projectId: targetProjectId,
		rankExplanations: definition.rankExplanations as Prisma.InputJsonValue,
		revision: 1,
		sortOrder: definition.sortOrder,
	}));
	await tx.projectPriorityCriterion.createMany({ data: cloned });
	const rows = await tx.projectPriorityCriterion.findMany({
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		where: { projectId: targetProjectId, trashedAt: null },
	});
	return rows.map(toDefinitionView);
}

export async function seedPreparedEvidenceStrength(
	tx: PrismaTransaction,
	projectId: string,
	starterConfiguration: string
): Promise<void> {
	if (starterConfiguration === "Blank Project") {
		return;
	}
	await tx.projectPriorityCriterion.create({
		data: {
			description: "",
			enabled: false,
			id: crypto.randomUUID(),
			name: PRIORITY_COPY.evidenceStrength,
			preparedKind: PRIORITY_COPY.evidenceStrength,
			projectId,
			rankExplanations: emptyRankExplanations(),
			revision: 1,
			sortOrder: 0,
		},
	});
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreatePriorityCriterionCommand; status: "ok" }
	| { outcome: PriorityCriterionOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (isRecord(command.payload) && hasScoringKeys(command.payload)) {
		return {
			outcome: { reason: "formula-not-supported", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = createPriorityCriterionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseUpdateCommand(
	command: unknown
):
	| { command: UpdatePriorityCriterionCommand; status: "ok" }
	| { outcome: PriorityCriterionOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = updatePriorityCriterionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseTrashCommand(
	command: unknown
):
	| { command: TrashPriorityCriterionCommand; status: "ok" }
	| { outcome: PriorityCriterionOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = trashPriorityCriterionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseSetValueCommand(
	command: unknown
):
	| { command: SetPriorityCriterionValueCommand; status: "ok" }
	| { outcome: PriorityCriterionValueOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (isRecord(command.payload) && hasScoringKeys(command.payload)) {
		return {
			outcome: { reason: "formula-not-supported", status: "rejected" },
			status: "rejected",
		};
	}
	if (isRecord(command.payload) && hasUnknownRank(command.payload.rank)) {
		return {
			outcome: { reason: "unknown-rank", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = setPriorityCriterionValueCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreatePriorityCriterionCommand,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, project.id);
	const replayed = await replayDefinition(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const name = command.payload.name?.trim() ?? "";
	if (name.length === 0) {
		return { reason: "missing-name", status: "rejected" };
	}
	const last = await tx.projectPriorityCriterion.findFirst({
		orderBy: { sortOrder: "desc" },
		select: { sortOrder: true },
		where: { projectId: project.id },
	});
	const id = crypto.randomUUID();
	await tx.projectPriorityCriterion.create({
		data: {
			description: command.payload.description?.trim() ?? "",
			enabled: true,
			id,
			name,
			preparedKind: null,
			projectId: project.id,
			rankExplanations:
				command.payload.rankExplanations ?? emptyRankExplanations(),
			revision: 1,
			sortOrder: (last?.sortOrder ?? -1) + 1,
		},
	});
	const row = await tx.projectPriorityCriterion.findUnique({ where: { id } });
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const definition = toDefinitionView(row);
	await writeDefinitionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		definition,
		fingerprint,
	});
	return { definition, status: "committed" };
}

async function updateInTransaction(
	tx: PrismaTransaction,
	command: UpdatePriorityCriterionCommand,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionOutcome> {
	const current = await tx.projectPriorityCriterion.findUnique({
		where: { id: command.payload.criterionId },
	});
	if (!current || current.trashedAt) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayDefinition(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const name =
		command.payload.name === undefined
			? current.name
			: command.payload.name.trim();
	if (name.length === 0) {
		return { reason: "missing-name", status: "rejected" };
	}
	await tx.projectPriorityCriterion.update({
		data: {
			description:
				command.payload.description === undefined
					? current.description
					: command.payload.description.trim(),
			enabled: command.payload.enabled ?? current.enabled,
			name,
			revision: current.revision + 1,
			...(command.payload.rankExplanations
				? { rankExplanations: command.payload.rankExplanations }
				: {}),
		},
		where: { id: current.id },
	});
	const row = await tx.projectPriorityCriterion.findUnique({
		where: { id: current.id },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const definition = toDefinitionView(row);
	await writeDefinitionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		definition,
		fingerprint,
	});
	return { definition, status: "committed" };
}

async function trashInTransaction(
	tx: PrismaTransaction,
	command: TrashPriorityCriterionCommand,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionOutcome> {
	const current = await tx.projectPriorityCriterion.findUnique({
		where: { id: command.payload.criterionId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replayDefinition(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	await tx.projectPriorityCriterion.update({
		data: {
			revision: current.revision + 1,
			trashedAt: new Date(),
		},
		where: { id: current.id },
	});
	const row = await tx.projectPriorityCriterion.findUnique({
		where: { id: current.id },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const definition = toDefinitionView(row);
	await writeDefinitionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		definition,
		fingerprint,
	});
	return { definition, status: "committed" };
}

async function setValueInTransaction(
	tx: PrismaTransaction,
	command: SetPriorityCriterionValueCommand,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionValueOutcome> {
	const definition = await tx.projectPriorityCriterion.findUnique({
		where: { id: command.payload.criterionId },
	});
	if (!definition) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (definition.trashedAt || !definition.enabled) {
		return { reason: "criterion-not-effective", status: "rejected" };
	}
	const work = await tx.work.findUnique({
		where: { id: command.payload.workId },
	});
	if (!work || work.projectId !== definition.projectId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, definition.projectId);
	const replayed = await replayValue(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const existing = await tx.projectPriorityCriterionValue.findUnique({
		where: {
			criterionId_workId: {
				criterionId: definition.id,
				workId: work.id,
			},
		},
	});
	const nextRevision = (existing?.revision ?? 0) + 1;
	const row = existing
		? await tx.projectPriorityCriterionValue.update({
				data: {
					rank: command.payload.rank,
					revision: nextRevision,
				},
				where: { id: existing.id },
			})
		: await tx.projectPriorityCriterionValue.create({
				data: {
					criterionId: definition.id,
					id: crypto.randomUUID(),
					rank: command.payload.rank,
					revision: nextRevision,
					workId: work.id,
				},
			});
	const value = toValueView(definition, work.id, row);
	await writeValueReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		value,
	});
	return { status: "committed", value };
}

async function replayDefinition(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.projectPriorityCriterion.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { definition: toDefinitionView(live), status: "replayed" };
	}
	const stored = storedDefinition(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { definition: stored, status: "replayed" };
}

async function replayValue(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<PriorityCriterionValueOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedValue(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { status: "replayed", value: stored };
}

async function writeDefinitionReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		definition: PriorityCriterionDefinitionView;
		fingerprint: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.definition.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.definition),
			targetId: input.definition.id,
		},
	});
}

async function writeValueReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		value: PriorityCriterionValueView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.value.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.value),
			targetId: input.value.criterionId,
		},
	});
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`priority:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function hasScoringKeys(payload: Record<string, unknown>): boolean {
	return SCORING_KEYS.some((key) => key in payload);
}

function hasUnknownRank(rank: unknown): boolean {
	if (rank === null || rank === undefined) {
		return false;
	}
	return typeof rank !== "string" || !isPriorityRank(rank);
}

function toDefinitionView(row: {
	description: string;
	enabled: boolean;
	id: string;
	name: string;
	preparedKind: string | null;
	projectId: string;
	rankExplanations: Prisma.JsonValue;
	revision: number;
}): PriorityCriterionDefinitionView {
	return {
		description: row.description,
		enabled: row.enabled,
		id: row.id,
		name: row.name,
		preparedKind:
			row.preparedKind === PRIORITY_COPY.evidenceStrength
				? PRIORITY_COPY.evidenceStrength
				: null,
		projectId: row.projectId,
		rankExplanations: parseRankExplanations(row.rankExplanations),
		revision: row.revision,
	};
}

function toValueView(
	definition: {
		description: string;
		enabled: boolean;
		id: string;
		name: string;
		preparedKind: string | null;
		projectId: string;
		rankExplanations: Prisma.JsonValue;
		revision: number;
	},
	workId: string,
	row: { rank: string | null; revision: number } | null
): PriorityCriterionValueView {
	const rank = row?.rank && isPriorityRank(row.rank) ? row.rank : null;
	return {
		criterionId: definition.id,
		enabled: definition.enabled,
		name: definition.name,
		notEvaluated: rank === null,
		rank,
		rankExplanations: parseRankExplanations(definition.rankExplanations),
		revision: row === null ? 0 : row.revision,
		workId,
	};
}

function parseRankExplanations(value: Prisma.JsonValue): RankExplanations {
	const parsed = rankExplanationsSchema.safeParse(value);
	if (!parsed.success) {
		return emptyRankExplanations();
	}
	return parsed.data;
}

function storedDefinition(
	value: string
): PriorityCriterionDefinitionView | null {
	try {
		return priorityCriterionDefinitionSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

function storedValue(value: string): PriorityCriterionValueView | null {
	try {
		return priorityCriterionValueSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

async function loadAxes(
	prisma: PrismaClient | PrismaTransaction,
	input: {
		horizontalCriterionId: string;
		projectId: string;
		verticalCriterionId: string;
	}
): Promise<
	| {
			horizontal: { id: string; name: string };
			status: "ok";
			vertical: { id: string; name: string };
	  }
	| { reason: "target-not-found"; status: "rejected" }
> {
	const rows = await prisma.projectPriorityCriterion.findMany({
		where: {
			enabled: true,
			id: {
				in: [input.horizontalCriterionId, input.verticalCriterionId],
			},
			projectId: input.projectId,
			trashedAt: null,
		},
	});
	const horizontal = rows.find((row) => row.id === input.horizontalCriterionId);
	const vertical = rows.find((row) => row.id === input.verticalCriterionId);
	if (!(horizontal && vertical)) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		horizontal: { id: horizontal.id, name: horizontal.name },
		status: "ok",
		vertical: { id: vertical.id, name: vertical.name },
	};
}

function placeOnMap(
	works: readonly { id: string; key: string; title: string }[],
	values: readonly {
		criterionId: string;
		rank: string | null;
		workId: string;
	}[],
	horizontal: { id: string; name: string },
	vertical: { id: string; name: string },
	evidenceByWork: Map<string, PriorityMapEvidence | null>
): PriorityMapView {
	const plotted: PriorityMapView["plotted"] = [];
	const unevaluated: PriorityMapView["unevaluated"] = [];
	for (const work of works) {
		const horizontalRank = rankFor(values, work.id, horizontal.id);
		const verticalRank = rankFor(values, work.id, vertical.id);
		const evidence = evidenceByWork.get(work.id) ?? null;
		if (horizontalRank && verticalRank) {
			plotted.push({
				evidence,
				horizontalRank,
				key: work.key,
				title: work.title,
				verticalRank,
				workId: work.id,
			});
			continue;
		}
		const missingAxes: Array<"horizontal" | "vertical"> = [];
		if (!horizontalRank) {
			missingAxes.push("horizontal");
		}
		if (!verticalRank) {
			missingAxes.push("vertical");
		}
		unevaluated.push({
			evidence,
			key: work.key,
			missingAxes,
			title: work.title,
			workId: work.id,
		});
	}
	return {
		horizontal,
		plotted,
		ranks: [...PRIORITY_RANKS],
		unevaluated,
		vertical,
	};
}

function rankFor(
	values: readonly {
		criterionId: string;
		rank: string | null;
		workId: string;
	}[],
	workId: string,
	criterionId: string
): PriorityRank | null {
	const row = values.find(
		(value) => value.workId === workId && value.criterionId === criterionId
	);
	if (!(row?.rank && isPriorityRank(row.rank))) {
		return null;
	}
	return row.rank;
}

async function evidenceCounts(
	prisma: PrismaClient,
	workIds: string[]
): Promise<Map<string, PriorityMapEvidence | null>> {
	const counts = new Map<string, PriorityMapEvidence | null>();
	if (workIds.length === 0) {
		return counts;
	}
	const feedbackIdsByWork = await feedbackIdsForWorks(prisma, workIds);
	const feedbackIds = uniqueIds(feedbackIdsByWork);
	const contactsByFeedback = await contactsForFeedback(prisma, feedbackIds);
	const companyByContact = await companiesForContacts(
		prisma,
		uniqueIds(contactsByFeedback)
	);
	for (const workId of workIds) {
		counts.set(
			workId,
			evidenceForWork(
				feedbackIdsByWork.get(workId) ?? new Set<string>(),
				contactsByFeedback,
				companyByContact
			)
		);
	}
	return counts;
}

async function feedbackIdsForWorks(
	prisma: PrismaClient,
	workIds: string[]
): Promise<Map<string, Set<string>>> {
	const rows = await prisma.typedRelation.findMany({
		where: {
			OR: [
				{
					fromKind: "Feedback",
					toId: { in: workIds },
					toKind: "Work",
					type: RELATIONS_COPY.evidence,
				},
				{
					fromId: { in: workIds },
					fromKind: "Work",
					toKind: "Feedback",
					type: RELATIONS_COPY.evidence,
				},
			],
		},
	});
	const feedbackIdsByWork = new Map<string, Set<string>>();
	for (const row of rows) {
		const workId = row.toKind === "Work" ? row.toId : row.fromId;
		const feedbackId = row.fromKind === "Feedback" ? row.fromId : row.toId;
		const set = feedbackIdsByWork.get(workId) ?? new Set<string>();
		set.add(feedbackId);
		feedbackIdsByWork.set(workId, set);
	}
	return feedbackIdsByWork;
}

async function contactsForFeedback(
	prisma: PrismaClient,
	feedbackIds: string[]
): Promise<Map<string, Set<string>>> {
	const contactsByFeedback = new Map<string, Set<string>>();
	if (feedbackIds.length === 0) {
		return contactsByFeedback;
	}
	const rows = await prisma.typedRelation.findMany({
		where: {
			OR: [
				{
					fromId: { in: feedbackIds },
					fromKind: "Feedback",
					toKind: "Contact",
					type: RELATIONS_COPY.related,
				},
				{
					fromKind: "Contact",
					toId: { in: feedbackIds },
					toKind: "Feedback",
					type: RELATIONS_COPY.related,
				},
			],
		},
	});
	for (const row of rows) {
		const feedbackId = row.fromKind === "Feedback" ? row.fromId : row.toId;
		const contactId = row.fromKind === "Contact" ? row.fromId : row.toId;
		const set = contactsByFeedback.get(feedbackId) ?? new Set<string>();
		set.add(contactId);
		contactsByFeedback.set(feedbackId, set);
	}
	return contactsByFeedback;
}

async function companiesForContacts(
	prisma: PrismaClient,
	contactIds: string[]
): Promise<Map<string, string>> {
	if (contactIds.length === 0) {
		return new Map();
	}
	const rows = await prisma.typedRelation.findMany({
		where: {
			fromId: { in: contactIds },
			fromKind: "Contact",
			toKind: "Company",
			type: RELATIONS_COPY.belongsToCompany,
		},
	});
	return new Map(rows.map((row) => [row.fromId, row.toId]));
}

function uniqueIds(grouped: Map<string, Set<string>>): string[] {
	return [...new Set([...grouped.values()].flatMap((set) => [...set]))];
}

function evidenceForWork(
	feedback: Set<string>,
	contactsByFeedback: Map<string, Set<string>>,
	companyByContact: Map<string, string>
): PriorityMapEvidence | null {
	const contacts = new Set<string>();
	const companies = new Set<string>();
	for (const feedbackId of feedback) {
		for (const contactId of contactsByFeedback.get(feedbackId) ?? []) {
			contacts.add(contactId);
			const companyId = companyByContact.get(contactId);
			if (companyId) {
				companies.add(companyId);
			}
		}
	}
	if (feedback.size === 0 && contacts.size === 0 && companies.size === 0) {
		return null;
	}
	return {
		feedbackCount: feedback.size,
		uniqueCompanyCount: companies.size,
		uniqueContactCount: contacts.size,
	};
}

async function savePresentationInTransaction(
	tx: PrismaTransaction,
	command: SavePriorityMapPresentationCommand,
	commandKey: string,
	fingerprint: string
): Promise<PriorityMapPresentationOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const axes = await loadAxes(tx, command.payload);
	if (axes.status !== "ok") {
		return axes;
	}
	await lockProject(tx, project.id);
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const stored = storedPresentation(existing.resultValue);
		if (!stored) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { presentation: stored, status: "replayed" };
	}
	const presentation: PriorityMapPresentation = {
		horizontalCriterionId: command.payload.horizontalCriterionId,
		projectId: project.id,
		verticalCriterionId: command.payload.verticalCriterionId,
	};
	await tx.projectPriorityMapPresentation.upsert({
		create: {
			horizontalCriterionId: presentation.horizontalCriterionId,
			id: crypto.randomUUID(),
			projectId: presentation.projectId,
			revision: 1,
			verticalCriterionId: presentation.verticalCriterionId,
		},
		update: {
			horizontalCriterionId: presentation.horizontalCriterionId,
			revision: { increment: 1 },
			verticalCriterionId: presentation.verticalCriterionId,
		},
		where: { projectId: presentation.projectId },
	});
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(presentation),
			targetId: project.id,
		},
	});
	return { presentation, status: "committed" };
}

function storedPresentation(value: string): PriorityMapPresentation | null {
	try {
		const parsed = JSON.parse(value) as PriorityMapPresentation;
		if (
			typeof parsed.horizontalCriterionId === "string" &&
			typeof parsed.projectId === "string" &&
			typeof parsed.verticalCriterionId === "string"
		) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}
