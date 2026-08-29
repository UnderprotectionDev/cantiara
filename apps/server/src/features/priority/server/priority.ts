import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	type ClosePrioritizationSessionCommand,
	type CreatePrioritizationSessionCommand,
	type CreatePriorityCriterionCommand,
	closePrioritizationSessionCommandSchema,
	createPrioritizationSessionCommandSchema,
	createPriorityCriterionCommandSchema,
	emptyRankExplanations,
	isPriorityRank,
	PRIORITY_COPY,
	type PrioritizationSessionOutcome,
	type PrioritizationSessionView,
	type PriorityCriterionDefinitionView,
	type PriorityCriterionOutcome,
	type PriorityCriterionValueOutcome,
	type PriorityCriterionValueView,
	prioritizationSessionViewSchema,
	priorityCriterionDefinitionSchema,
	priorityCriterionValueSchema,
	type RankExplanations,
	type ReorderPrioritizationSessionCommand,
	rankExplanationsSchema,
	reorderPrioritizationSessionCommandSchema,
	type SetPrioritizationSessionScopeCommand,
	type SetPriorityCriterionValueCommand,
	setPrioritizationSessionScopeCommandSchema,
	setPriorityCriterionValueCommandSchema,
	type TrashPriorityCriterionCommand,
	trashPriorityCriterionCommandSchema,
	type UpdatePriorityCriterionCommand,
	updatePriorityCriterionCommandSchema,
} from "./priority-model";

type PrismaTransaction = Prisma.TransactionClient;

const SCORING_KEYS = [
	"automaticWinner",
	"dailyFocus",
	"decision",
	"focusPeriod",
	"formula",
	"score",
	"sessionScore",
	"weight",
	"winner",
	"wsjf",
] as const;

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

export async function createPrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	const parsed = parseSessionCommand(
		command,
		createPrioritizationSessionCommandSchema
	);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createSessionInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function reorderPrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	const parsed = parseSessionCommand(
		command,
		reorderPrioritizationSessionCommandSchema
	);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		reorderSessionInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function setPrioritizationSessionScope(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	const parsed = parseSessionCommand(
		command,
		setPrioritizationSessionScopeCommandSchema
	);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		setSessionScopeInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function closePrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	return await mutateSessionFlag(prisma, command, "close");
}

export async function reopenPrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	return await mutateSessionFlag(prisma, command, "reopen");
}

export async function archivePrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	return await mutateSessionFlag(prisma, command, "archive");
}

export async function trashPrioritizationSession(
	prisma: PrismaClient,
	command: unknown
): Promise<PrioritizationSessionOutcome> {
	return await mutateSessionFlag(prisma, command, "trash");
}

export async function listPrioritizationSessions(
	prisma: PrismaClient,
	projectId: string
): Promise<PrioritizationSessionView[]> {
	const rows = await prisma.prioritizationSession.findMany({
		orderBy: { createdAt: "asc" },
		where: { archivedAt: null, projectId, trashedAt: null },
	});
	const listed = await Promise.all(
		rows.map((row) => loadSessionView(prisma, row.id))
	);
	return listed.filter(
		(session): session is PrioritizationSessionView => session !== null
	);
}

export async function getPrioritizationSession(
	prisma: PrismaClient,
	sessionId: string
): Promise<PrioritizationSessionView | null> {
	return await loadSessionView(prisma, sessionId);
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

type SessionFlagKind = "archive" | "close" | "reopen" | "trash";

function parseSessionCommand<T>(
	command: unknown,
	schema: {
		safeParse: (
			value: unknown
		) => { data: T; success: true } | { success: false };
	}
):
	| { command: T; status: "ok" }
	| { outcome: PrioritizationSessionOutcome; status: "rejected" } {
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
	const parsed = schema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function mutateSessionFlag(
	prisma: PrismaClient,
	command: unknown,
	kind: SessionFlagKind
): Promise<PrioritizationSessionOutcome> {
	const parsed = parseSessionCommand(
		command,
		closePrioritizationSessionCommandSchema
	);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		kind,
		...parsed.command.payload,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		sessionFlagInTransaction(tx, parsed.command, kind, commandKey, fingerprint)
	);
}

async function createSessionInTransaction(
	tx: PrismaTransaction,
	command: CreatePrioritizationSessionCommand,
	commandKey: string,
	fingerprint: string
): Promise<PrioritizationSessionOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, project.id);
	const replayed = await replaySession(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const name = command.payload.name?.trim() ?? "";
	if (name.length === 0) {
		return { reason: "missing-name", status: "rejected" };
	}
	const workIds = command.payload.workIds ?? [];
	const scoped = await loadScopedWork(tx, project.id, workIds);
	if (!scoped) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const id = crypto.randomUUID();
	await tx.prioritizationSession.create({
		data: {
			id,
			items: {
				create: workIds.map((workId, sortOrder) => ({
					id: crypto.randomUUID(),
					sortOrder,
					workId,
				})),
			},
			name,
			projectId: project.id,
			revision: 1,
		},
	});
	const session = await loadSessionView(tx, id);
	if (!session) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeSessionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		session,
	});
	return { session, status: "committed" };
}

async function reorderSessionInTransaction(
	tx: PrismaTransaction,
	command: ReorderPrioritizationSessionCommand,
	commandKey: string,
	fingerprint: string
): Promise<PrioritizationSessionOutcome> {
	const current = await tx.prioritizationSession.findUnique({
		include: { items: true },
		where: { id: command.payload.sessionId },
	});
	if (!current || current.trashedAt || current.archivedAt) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (current.closedAt) {
		return { reason: "session-closed", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replaySession(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const currentIds = new Set(current.items.map((item) => item.workId));
	const nextIds = command.payload.workIds;
	if (
		nextIds.length !== currentIds.size ||
		nextIds.some((workId) => !currentIds.has(workId))
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await applySessionOrder(tx, current.id, nextIds);
	await tx.prioritizationSession.update({
		data: { revision: current.revision + 1 },
		where: { id: current.id },
	});
	const session = await loadSessionView(tx, current.id);
	if (!session) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeSessionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		session,
	});
	return { session, status: "committed" };
}

async function setSessionScopeInTransaction(
	tx: PrismaTransaction,
	command: SetPrioritizationSessionScopeCommand,
	commandKey: string,
	fingerprint: string
): Promise<PrioritizationSessionOutcome> {
	const current = await tx.prioritizationSession.findUnique({
		where: { id: command.payload.sessionId },
	});
	if (!current || current.trashedAt || current.archivedAt) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (current.closedAt) {
		return { reason: "session-closed", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replaySession(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const scoped = await loadScopedWork(
		tx,
		current.projectId,
		command.payload.workIds
	);
	if (!scoped) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await tx.prioritizationSessionItem.deleteMany({
		where: { sessionId: current.id },
	});
	await applySessionOrder(tx, current.id, command.payload.workIds);
	await tx.prioritizationSession.update({
		data: { revision: current.revision + 1 },
		where: { id: current.id },
	});
	const session = await loadSessionView(tx, current.id);
	if (!session) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeSessionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		session,
	});
	return { session, status: "committed" };
}

async function sessionFlagInTransaction(
	tx: PrismaTransaction,
	command: ClosePrioritizationSessionCommand,
	kind: SessionFlagKind,
	commandKey: string,
	fingerprint: string
): Promise<PrioritizationSessionOutcome> {
	const current = await tx.prioritizationSession.findUnique({
		where: { id: command.payload.sessionId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, current.projectId);
	const replayed = await replaySession(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const now = new Date();
	let { archivedAt, closedAt, trashedAt } = current;
	if (kind === "archive") {
		archivedAt = now;
	}
	if (kind === "close") {
		closedAt = now;
	}
	if (kind === "reopen") {
		closedAt = null;
	}
	if (kind === "trash") {
		trashedAt = now;
	}
	await tx.prioritizationSession.update({
		data: {
			archivedAt,
			closedAt,
			revision: current.revision + 1,
			trashedAt,
		},
		where: { id: current.id },
	});
	const session = await loadSessionView(tx, current.id);
	if (!session) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await writeSessionReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		session,
	});
	return { session, status: "committed" };
}

async function applySessionOrder(
	tx: PrismaTransaction,
	sessionId: string,
	workIds: string[]
): Promise<void> {
	const existing = await tx.prioritizationSessionItem.findMany({
		where: { sessionId },
	});
	const byWork = new Map(existing.map((item) => [item.workId, item]));
	await Promise.all(
		workIds.map((workId, sortOrder) => {
			const row = byWork.get(workId);
			if (row) {
				return tx.prioritizationSessionItem.update({
					data: { sortOrder },
					where: { id: row.id },
				});
			}
			return tx.prioritizationSessionItem.create({
				data: {
					id: crypto.randomUUID(),
					sessionId,
					sortOrder,
					workId,
				},
			});
		})
	);
}

async function loadScopedWork(
	tx: PrismaTransaction,
	projectId: string,
	workIds: string[]
): Promise<boolean> {
	if (workIds.length === 0) {
		return true;
	}
	const unique = new Set(workIds);
	if (unique.size !== workIds.length) {
		return false;
	}
	const rows = await tx.work.findMany({
		select: { id: true },
		where: { id: { in: workIds }, projectId, retiredIntoId: null },
	});
	return rows.length === unique.size;
}

async function replaySession(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<PrioritizationSessionOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedSession(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { session: stored, status: "replayed" };
}

async function writeSessionReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		session: PrioritizationSessionView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.session.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.session),
			targetId: input.session.id,
		},
	});
}

async function loadSessionView(
	db: PrismaClient | PrismaTransaction,
	sessionId: string
): Promise<PrioritizationSessionView | null> {
	const row = await db.prioritizationSession.findUnique({
		include: { items: { orderBy: { sortOrder: "asc" } } },
		where: { id: sessionId },
	});
	if (!row) {
		return null;
	}
	const workIds = row.items.map((item) => item.workId);
	const works = await db.work.findMany({
		orderBy: { number: "asc" },
		where: { projectId: row.projectId, retiredIntoId: null },
	});
	const backlogIndex = new Map(works.map((work, index) => [work.id, index]));
	const workById = new Map(works.map((work) => [work.id, work]));
	const definitions = await db.projectPriorityCriterion.findMany({
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		where: { enabled: true, projectId: row.projectId, trashedAt: null },
	});
	const values =
		workIds.length === 0 || definitions.length === 0
			? []
			: await db.projectPriorityCriterionValue.findMany({
					where: {
						criterionId: { in: definitions.map((definition) => definition.id) },
						workId: { in: workIds },
					},
				});
	const relations =
		workIds.length === 0
			? []
			: await db.typedRelation.findMany({
					where: {
						OR: [
							{ fromId: { in: workIds }, fromKind: "Work" },
							{ toId: { in: workIds }, toKind: "Work" },
						],
					},
				});
	const cards = row.items.map((item, sessionRank) => {
		const work = workById.get(item.workId);
		const related = relations.filter(
			(relation) =>
				(relation.fromKind === "Work" && relation.fromId === item.workId) ||
				(relation.toKind === "Work" && relation.toId === item.workId)
		);
		return {
			backlogRank: backlogIndex.get(item.workId) ?? sessionRank,
			criterionValues: definitions.map((definition) => {
				const value = values.find(
					(rowValue) =>
						rowValue.criterionId === definition.id &&
						rowValue.workId === item.workId
				);
				const rank =
					value?.rank && isPriorityRank(value.rank) ? value.rank : null;
				return {
					criterionId: definition.id,
					name: definition.name,
					notEvaluated: rank === null,
					rank,
				};
			}),
			evidence: {
				feedbackRecords: countRelated(related, item.workId, "Feedback"),
				uniqueCompanies: countRelated(related, item.workId, "Company"),
				uniqueContacts: countRelated(related, item.workId, "Contact"),
			},
			riskCount: countRelated(related, item.workId, "Risk"),
			sessionRank,
			targetDate: null,
			title: work?.title ?? "",
			workId: item.workId,
		};
	});
	const sessionOrder = cards.map((card) => card.workId);
	const backlogOrder = works
		.filter((work) => sessionOrder.includes(work.id))
		.map((work) => work.id);
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		cards,
		closedAt: row.closedAt?.toISOString() ?? null,
		comparison: {
			backlogOrder,
			implicitSync: false,
			sessionOrder,
		},
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		revision: row.revision,
		writes: {
			backlogOrder: false,
			criterionValues: false,
			dailyFocus: false,
			decisionRecord: false,
			focusPeriod: false,
			roadmapHorizon: false,
			sessionScore: false,
			status: false,
		},
	};
}

function countRelated(
	relations: Array<{
		fromId: string;
		fromKind: string;
		toId: string;
		toKind: string;
	}>,
	workId: string,
	kind: string
): number {
	const ids = new Set<string>();
	for (const relation of relations) {
		if (
			relation.fromKind === "Work" &&
			relation.fromId === workId &&
			relation.toKind === kind
		) {
			ids.add(relation.toId);
		}
		if (
			relation.toKind === "Work" &&
			relation.toId === workId &&
			relation.fromKind === kind
		) {
			ids.add(relation.fromId);
		}
	}
	return ids.size;
}

function storedSession(value: string): PrioritizationSessionView | null {
	try {
		return prioritizationSessionViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}
