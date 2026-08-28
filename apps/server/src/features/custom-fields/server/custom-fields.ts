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
	type CustomFieldFilterPayload,
	type CustomFieldOutcome,
	type CustomFieldStoredValue,
	type CustomFieldValueOutcome,
	type CustomFieldValueView,
	createCustomFieldCommandSchema,
	customFieldDefinitionSchema,
	customFieldStoredValueSchema,
	customFieldValueViewSchema,
	fieldsOnSurface,
	isBindableRecordType,
	isCustomFieldType,
	isNotEvaluated,
	isSelectFieldType,
	normalizeStoredValue,
	type SetCustomFieldValueCommand,
	setCustomFieldValueCommandSchema,
	UNSET_CUSTOM_FIELD_VALUE,
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

export async function listSurfaceFields(
	prisma: PrismaClient,
	projectId: string,
	recordType: string,
	recordId?: string
): Promise<CustomFieldValueView[]> {
	const definitions = fieldsOnSurface(
		await listCustomFields(prisma, projectId),
		recordType
	);
	if (definitions.length === 0) {
		return [];
	}
	if (!recordId) {
		return definitions.map((definition) =>
			unwrittenValue(definition, recordType, "")
		);
	}
	const rows = await prisma.projectCustomFieldValue.findMany({
		where: {
			definitionId: { in: definitions.map((definition) => definition.id) },
			recordId,
			recordType,
		},
	});
	const byDefinition = new Map(rows.map((row) => [row.definitionId, row]));
	return definitions.map((definition) => {
		const row = byDefinition.get(definition.id);
		if (!row) {
			return unwrittenValue(definition, recordType, recordId);
		}
		return toValueView(definition, row);
	});
}

export async function setCustomFieldValue(
	prisma: PrismaClient,
	command: unknown
): Promise<CustomFieldValueOutcome> {
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

export async function listSearchFilterFields(
	prisma: PrismaClient,
	projectId: string,
	recordType: string
): Promise<CustomFieldDefinitionView[]> {
	return fieldsOnSurface(await listCustomFields(prisma, projectId), recordType);
}

export async function filterCustomFieldRecords(
	prisma: PrismaClient,
	input: CustomFieldFilterPayload
): Promise<string[]> {
	const definitions = await listSearchFilterFields(
		prisma,
		input.projectId,
		input.recordType
	);
	const definition = definitions.find(
		(field) => field.id === input.definitionId
	);
	if (!definition) {
		return [];
	}
	const wanted = normalizeStoredValue(definition.type, input.value);
	const rows = await prisma.projectCustomFieldValue.findMany({
		where: {
			definitionId: definition.id,
			recordType: input.recordType,
		},
	});
	return rows
		.filter((row) => storedValuesEqual(parseStoredValue(row.value), wanted))
		.map((row) => row.recordId);
}

export async function listCustomFieldRecordIds(
	prisma: PrismaClient,
	projectId: string,
	recordType: string
): Promise<string[]> {
	const definitions = await listSearchFilterFields(
		prisma,
		projectId,
		recordType
	);
	if (definitions.length === 0) {
		return [];
	}
	const rows = await prisma.projectCustomFieldValue.findMany({
		distinct: ["recordId"],
		orderBy: { createdAt: "asc" },
		select: { recordId: true },
		where: {
			definitionId: { in: definitions.map((definition) => definition.id) },
			recordType,
		},
	});
	return rows.map((row) => row.recordId);
}

export async function cloneCustomFieldDefinitions(
	tx: PrismaTransaction,
	sourceProjectId: string,
	targetProjectId: string
): Promise<CustomFieldDefinitionView[]> {
	const source = await tx.projectCustomFieldDefinition.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId: sourceProjectId },
	});
	if (source.length === 0) {
		return [];
	}
	const cloned = source.map((definition) => ({
		boundRecordTypes: [...definition.boundRecordTypes],
		id: crypto.randomUUID(),
		name: definition.name,
		options: [...definition.options],
		projectId: targetProjectId,
		revision: 1,
		type: definition.type,
	}));
	await tx.projectCustomFieldDefinition.createMany({ data: cloned });
	return cloned.map(toView);
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

function parseSetValueCommand(
	command: unknown
):
	| { command: SetCustomFieldValueCommand; status: "ok" }
	| { outcome: CustomFieldValueOutcome; status: "rejected" } {
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
	const parsed = setCustomFieldValueCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function setValueInTransaction(
	tx: PrismaTransaction,
	command: SetCustomFieldValueCommand,
	commandKey: string,
	fingerprint: string
): Promise<CustomFieldValueOutcome> {
	const definitionRow = await tx.projectCustomFieldDefinition.findUnique({
		where: { id: command.payload.definitionId },
	});
	if (!definitionRow) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const definition = toView(definitionRow);
	await lockProject(tx, definition.projectId);
	const replayed = await replayValueOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (!isBindableRecordType(command.payload.recordType)) {
		return { reason: "unsupported-record-type", status: "rejected" };
	}
	if (!definition.boundRecordTypes.includes(command.payload.recordType)) {
		return { reason: "unbound-record-type", status: "rejected" };
	}
	const normalized = normalizeStoredValue(
		definition.type,
		command.payload.value
	);
	const typed = valueMatchesType(definition, normalized);
	if (typed.status !== "ok") {
		return typed.outcome;
	}
	const existing = await tx.projectCustomFieldValue.findUnique({
		where: {
			definitionId_recordType_recordId: {
				definitionId: definition.id,
				recordId: command.payload.recordId,
				recordType: command.payload.recordType,
			},
		},
	});
	const currentRevision = existing?.revision ?? 0;
	if (currentRevision !== command.baseRevision) {
		const current = existing
			? toValueView(definition, existing)
			: unwrittenValue(
					definition,
					command.payload.recordType,
					command.payload.recordId
				);
		return {
			current,
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	const valueRow = existing
		? await tx.projectCustomFieldValue.update({
				data: {
					revision: currentRevision + 1,
					value: typed.value,
				},
				where: { id: existing.id },
			})
		: await tx.projectCustomFieldValue.create({
				data: {
					definitionId: definition.id,
					id: crypto.randomUUID(),
					recordId: command.payload.recordId,
					recordType: command.payload.recordType,
					revision: 1,
					value: typed.value,
				},
			});
	const view = toValueView(definition, valueRow);
	await writeValueReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		value: view,
	});
	return { status: "committed", value: view };
}

function valueMatchesType(
	definition: CustomFieldDefinitionView,
	value: CustomFieldStoredValue
):
	| { status: "ok"; value: CustomFieldStoredValue }
	| { outcome: CustomFieldValueOutcome; status: "rejected" } {
	if (value.kind === "unset") {
		return { status: "ok", value };
	}
	if (definition.type === "Text" && value.kind === "text") {
		return { status: "ok", value };
	}
	if (definition.type === "Number" && value.kind === "number") {
		if (!Number.isFinite(value.number)) {
			return {
				outcome: { reason: "value-type-mismatch", status: "rejected" },
				status: "rejected",
			};
		}
		return { status: "ok", value };
	}
	if (definition.type === "Boolean" && value.kind === "boolean") {
		return { status: "ok", value };
	}
	if (definition.type === "Date" && value.kind === "date") {
		return { status: "ok", value };
	}
	if (definition.type === "Single select" && value.kind === "single-select") {
		if (!definition.options.includes(value.option)) {
			return {
				outcome: { reason: "unknown-select-option", status: "rejected" },
				status: "rejected",
			};
		}
		return { status: "ok", value };
	}
	if (definition.type === "Multi select" && value.kind === "multi-select") {
		if (value.options.some((option) => !definition.options.includes(option))) {
			return {
				outcome: { reason: "unknown-select-option", status: "rejected" },
				status: "rejected",
			};
		}
		return { status: "ok", value };
	}
	return {
		outcome: { reason: "value-type-mismatch", status: "rejected" },
		status: "rejected",
	};
}

async function replayValueOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<CustomFieldValueOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedValueView(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { status: "replayed", value: stored };
}

async function writeValueReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		value: CustomFieldValueView;
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
			targetId: input.value.definitionId,
		},
	});
}

function unwrittenValue(
	definition: CustomFieldDefinitionView,
	recordType: string,
	recordId: string
): CustomFieldValueView {
	return {
		definitionId: definition.id,
		name: definition.name,
		notEvaluated: true,
		options: definition.options,
		recordId,
		recordType,
		revision: 0,
		type: definition.type,
		value: UNSET_CUSTOM_FIELD_VALUE,
	};
}

function toValueView(
	definition: CustomFieldDefinitionView,
	row: {
		definitionId: string;
		recordId: string;
		recordType: string;
		revision: number;
		value: Prisma.JsonValue;
	}
): CustomFieldValueView {
	const value = parseStoredValue(row.value);
	return {
		definitionId: definition.id,
		name: definition.name,
		notEvaluated: isNotEvaluated(value),
		options: definition.options,
		recordId: row.recordId,
		recordType: row.recordType,
		revision: row.revision,
		type: definition.type,
		value,
	};
}

function parseStoredValue(value: Prisma.JsonValue): CustomFieldStoredValue {
	const parsed = customFieldStoredValueSchema.safeParse(value);
	if (!parsed.success) {
		return UNSET_CUSTOM_FIELD_VALUE;
	}
	return parsed.data;
}

function storedValueView(value: string): CustomFieldValueView | null {
	try {
		return customFieldValueViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

function storedValuesEqual(
	left: CustomFieldStoredValue,
	right: CustomFieldStoredValue
): boolean {
	if (left.kind !== right.kind) {
		return false;
	}
	if (left.kind === "unset" || right.kind === "unset") {
		return left.kind === "unset" && right.kind === "unset";
	}
	if (left.kind === "text" && right.kind === "text") {
		return left.text === right.text;
	}
	if (left.kind === "number" && right.kind === "number") {
		return left.number === right.number;
	}
	if (left.kind === "boolean" && right.kind === "boolean") {
		return left.boolean === right.boolean;
	}
	if (left.kind === "date" && right.kind === "date") {
		return left.date === right.date;
	}
	if (left.kind === "single-select" && right.kind === "single-select") {
		return left.option === right.option;
	}
	if (left.kind === "multi-select" && right.kind === "multi-select") {
		return (
			left.options.length === right.options.length &&
			left.options.every((option) => right.options.includes(option))
		);
	}
	return false;
}
