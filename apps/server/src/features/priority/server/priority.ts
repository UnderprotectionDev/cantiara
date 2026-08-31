import type { Prisma, PrismaClient } from "@cantiara/db";

import { orderedManualWorkIds } from "../../backlog/server/backlog";
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
	type ClosePrioritizationSessionCommand,
	type CreatePrioritizationSessionCommand,
	type CreatePriorityCriterionCommand,
	closePrioritizationSessionCommandSchema,
	createPrioritizationSessionCommandSchema,
	createPriorityCriterionCommandSchema,
	emptyRankExplanations,
	isPriorityRank,
	PRIORITY_COPY,
	PRIORITY_RANKS,
	type PrioritizationSessionOutcome,
	type PrioritizationSessionView,
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
	prioritizationSessionViewSchema,
	priorityCriterionDefinitionSchema,
	priorityCriterionValueSchema,
	type RankExplanations,
	type RelocatePriorityMapPointOutcome,
	type ReorderPrioritizationSessionCommand,
	rankExplanationsSchema,
	readPriorityMapInputSchema,
	reorderPrioritizationSessionCommandSchema,
	type SavePriorityMapPresentationCommand,
	type SetPrioritizationSessionScopeCommand,
	type SetPriorityCriterionValueCommand,
	savePriorityMapPresentationCommandSchema,
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
	const backlogOrderIds = await orderedManualWorkIds(
		db,
		row.projectId,
		works.map((work) => work.id)
	);
	const backlogIndex = new Map(
		backlogOrderIds.map((workId, index) => [workId, index])
	);
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
	const sessionWork = new Set(sessionOrder);
	const backlogOrder = backlogOrderIds.filter((workId) =>
		sessionWork.has(workId)
	);
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
