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
	type CreateCustomFieldCommand,
	type CustomFieldDefinitionView,
	type CustomFieldOutcome,
	createCustomFieldCommandSchema,
	customFieldDefinitionSchema,
	isBindableRecordType,
	isCustomFieldType,
	isSelectFieldType,
} from "./custom-fields-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function createCustomField(
	prisma: PrismaClient,
	command: unknown
): Promise<CustomFieldOutcome> {
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

export async function listCustomFields(
	prisma: PrismaClient,
	projectId: string
): Promise<CustomFieldDefinitionView[]> {
	const rows = await prisma.projectCustomFieldDefinition.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return rows.map(toView);
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreateCustomFieldCommand; status: "ok" }
	| { outcome: CustomFieldOutcome; status: "rejected" } {
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
	const parsed = createCustomFieldCommandSchema.safeParse(command);
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
	command: CreateCustomFieldCommand,
	commandKey: string,
	fingerprint: string
): Promise<CustomFieldOutcome> {
	const project = await tx.project.findUnique({
		where: { id: command.payload.projectId },
	});
	if (!project) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, project.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const validated = validateCreatePayload(command.payload);
	if (validated.status !== "ok") {
		return validated.outcome;
	}
	const id = crypto.randomUUID();
	await tx.projectCustomFieldDefinition.create({
		data: {
			boundRecordTypes: [...validated.boundRecordTypes],
			id,
			name: validated.name,
			options: [...validated.options],
			projectId: project.id,
			revision: 1,
			type: validated.type,
		},
	});
	const row = await tx.projectCustomFieldDefinition.findUnique({
		where: { id },
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const definition = toView(row);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		definition,
		fingerprint,
	});
	return { definition, status: "committed" };
}

function validateCreatePayload(payload: CreateCustomFieldCommand["payload"]):
	| {
			boundRecordTypes: string[];
			name: string;
			options: string[];
			status: "ok";
			type: string;
	  }
	| { outcome: CustomFieldOutcome; status: "rejected" } {
	const name = payload.name?.trim() ?? "";
	if (name.length === 0) {
		return {
			outcome: { reason: "missing-name", status: "rejected" },
			status: "rejected",
		};
	}
	const type = payload.type?.trim() ?? "";
	if (!isCustomFieldType(type)) {
		return {
			outcome: { reason: "unknown-field-type", status: "rejected" },
			status: "rejected",
		};
	}
	const boundRecordTypes = uniqueNonEmpty(payload.boundRecordTypes);
	if (boundRecordTypes.length === 0) {
		return {
			outcome: { reason: "missing-bound-record-types", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		boundRecordTypes.some((recordType) => !isBindableRecordType(recordType))
	) {
		return {
			outcome: { reason: "unsupported-record-type", status: "rejected" },
			status: "rejected",
		};
	}
	const options = isSelectFieldType(type)
		? uniqueNonEmpty(payload.options)
		: [];
	if (isSelectFieldType(type) && options.length === 0) {
		return {
			outcome: { reason: "missing-select-options", status: "rejected" },
			status: "rejected",
		};
	}
	return {
		boundRecordTypes,
		name,
		options,
		status: "ok",
		type,
	};
}

function uniqueNonEmpty(values: readonly string[] | undefined): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values ?? []) {
		const trimmed = value.trim();
		if (trimmed.length === 0 || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<CustomFieldOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.projectCustomFieldDefinition.findUnique({
		where: { id: existing.targetId },
	});
	if (live) {
		return { definition: toView(live), status: "replayed" };
	}
	const stored = storedDefinition(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { definition: stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		definition: CustomFieldDefinitionView;
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

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`custom-fields:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function toView(row: {
	boundRecordTypes: string[];
	id: string;
	name: string;
	options: string[];
	projectId: string;
	revision: number;
	type: string;
}): CustomFieldDefinitionView {
	return {
		boundRecordTypes: row.boundRecordTypes,
		id: row.id,
		name: row.name,
		options: row.options,
		projectId: row.projectId,
		revision: row.revision,
		type: row.type,
	};
}

function storedDefinition(value: string): CustomFieldDefinitionView | null {
	try {
		return customFieldDefinitionSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}
