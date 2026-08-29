import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	type CustomFieldStoredValue,
	customFieldStoredValueSchema,
	isBindableRecordType,
	normalizeStoredValue,
} from "../../custom-fields/server/custom-fields-model";
import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import type { LightChecklistItem } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	type CreateWorkTemplateCommand,
	createWorkTemplateCommandSchema,
	FORBIDDEN_TEMPLATE_PAYLOAD_KEYS,
	type InstantiatedWorkView,
	type InstantiateWorkFromTemplateCommand,
	type InstantiateWorkOutcome,
	instantiatedWorkViewSchema,
	instantiateWorkFromTemplateCommandSchema,
	isWorkType,
	type PreviewRelativeDatesInput,
	previewRelativeDateRules,
	type RelativeDatePreviewOutcome,
	type RelativeDateRule,
	type SelectedFieldDefaultInput,
	type SelectedFieldDefaultView,
	type TrashWorkTemplateCommand,
	trashWorkTemplateCommandSchema,
	type UpdateWorkTemplateCommand,
	updateWorkTemplateCommandSchema,
	type WorkTemplateChecklistItem,
	type WorkTemplateOutcome,
	type WorkTemplateRejectionReason,
	type WorkTemplateView,
	workTemplateChecklistItemSchema,
	workTemplateViewSchema,
} from "./work-templates-model";

type PrismaTransaction = Prisma.TransactionClient;

const DOCUMENT_PLACEHOLDER = /\{\{[^}]+\}\}/;

export async function createWorkTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkTemplateOutcome> {
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

export async function updateWorkTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkTemplateOutcome> {
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

export async function trashWorkTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<WorkTemplateOutcome> {
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

export async function instantiateWorkFromTemplate(
	prisma: PrismaClient,
	command: unknown
): Promise<InstantiateWorkOutcome> {
	const parsed = parseInstantiateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		instantiateInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function listWorkTemplates(
	prisma: PrismaClient,
	projectId: string
): Promise<WorkTemplateView[]> {
	const rows = await prisma.workTemplate.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId, trashedAt: null },
	});
	return Promise.all(rows.map((row) => toView(prisma, row)));
}

export async function getWorkTemplate(
	prisma: PrismaClient,
	templateId: string
): Promise<WorkTemplateView | null> {
	const row = await prisma.workTemplate.findUnique({
		where: { id: templateId },
	});
	if (!row || row.trashedAt) {
		return null;
	}
	return toView(prisma, row);
}

export async function previewWorkTemplateDates(
	prisma: PrismaClient,
	input: PreviewRelativeDatesInput
): Promise<RelativeDatePreviewOutcome> {
	let plannedStartRule = input.plannedStartRule ?? null;
	let targetDateRule = input.targetDateRule ?? null;
	if (input.templateId) {
		const row = await prisma.workTemplate.findUnique({
			where: { id: input.templateId },
		});
		if (!row) {
			return { reason: "target-not-found", status: "rejected" };
		}
		if (row.trashedAt) {
			return { reason: "trashed-not-effective", status: "rejected" };
		}
		plannedStartRule = ruleFromOffset(row.plannedStartOffsetDays);
		targetDateRule = ruleFromOffset(row.targetDateOffsetDays);
	}
	return previewRelativeDateRules({
		createDay: input.createDay,
		plannedStartRule,
		targetDateRule,
	});
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreateWorkTemplateCommand; status: "ok" }
	| { outcome: WorkTemplateOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return envelope;
	}
	const forbidden = forbiddenPayloadReason(envelope.command.payload);
	if (forbidden) {
		return {
			outcome: { reason: forbidden, status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = createWorkTemplateCommandSchema.safeParse(envelope.command);
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
	| { command: UpdateWorkTemplateCommand; status: "ok" }
	| { outcome: WorkTemplateOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return envelope;
	}
	const forbidden = forbiddenPayloadReason(envelope.command.payload);
	if (forbidden) {
		return {
			outcome: { reason: forbidden, status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = updateWorkTemplateCommandSchema.safeParse(envelope.command);
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
	| { command: TrashWorkTemplateCommand; status: "ok" }
	| { outcome: WorkTemplateOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return envelope;
	}
	const parsed = trashWorkTemplateCommandSchema.safeParse(envelope.command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseEnvelope(
	command: unknown
):
	| { command: Record<string, unknown>; status: "ok" }
	| { outcome: WorkTemplateOutcome; status: "rejected" } {
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
	return { command, status: "ok" };
}

function parseInstantiateCommand(
	command: unknown
):
	| { command: InstantiateWorkFromTemplateCommand; status: "ok" }
	| { outcome: InstantiateWorkOutcome; status: "rejected" } {
	const envelope = parseEnvelope(command);
	if (envelope.status !== "ok") {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const forbidden = forbiddenPayloadReason(envelope.command.payload);
	if (forbidden) {
		return {
			outcome: { reason: forbidden, status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = instantiateWorkFromTemplateCommandSchema.safeParse(
		envelope.command
	);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function forbiddenPayloadReason(
	payload: unknown
): WorkTemplateRejectionReason | null {
	if (!isRecord(payload)) {
		return null;
	}
	for (const key of FORBIDDEN_TEMPLATE_PAYLOAD_KEYS) {
		if (key in payload) {
			if (
				key === "plannedStart" ||
				key === "targetDate" ||
				key === "due" ||
				key === "absoluteDates"
			) {
				return "absolute-date";
			}
			return "forbidden-payload";
		}
	}
	return null;
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateWorkTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkTemplateOutcome> {
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
	const validated = await validateDefinitionPayload(tx, command.payload);
	if (validated.status !== "ok") {
		return validated.outcome;
	}
	const id = crypto.randomUUID();
	await tx.workTemplate.create({
		data: {
			descriptionSkeleton: validated.descriptionSkeleton,
			id,
			lightChecklist: validated.lightChecklist,
			name: validated.name,
			plannedStartOffsetDays: validated.plannedStartRule?.offsetDays ?? null,
			projectId: project.id,
			revision: 1,
			selectedFieldDefaults: validated.selectedFieldDefaults,
			targetDateOffsetDays: validated.targetDateRule?.offsetDays ?? null,
			workType: validated.workType,
		},
	});
	const row = await tx.workTemplate.findUnique({ where: { id } });
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const template = await toView(tx, row);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		template,
	});
	return { status: "committed", template };
}

async function updateInTransaction(
	tx: PrismaTransaction,
	command: UpdateWorkTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkTemplateOutcome> {
	const existing = await tx.workTemplate.findUnique({
		where: { id: command.payload.templateId },
	});
	if (!existing) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (existing.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	await lockProject(tx, existing.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (existing.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const validated = await validateDefinitionPayload(tx, {
		...command.payload,
		projectId: existing.projectId,
	});
	if (validated.status !== "ok") {
		return validated.outcome;
	}
	await tx.workTemplate.update({
		data: {
			descriptionSkeleton: validated.descriptionSkeleton,
			lightChecklist: validated.lightChecklist,
			name: validated.name,
			plannedStartOffsetDays: validated.plannedStartRule?.offsetDays ?? null,
			revision: existing.revision + 1,
			selectedFieldDefaults: validated.selectedFieldDefaults,
			targetDateOffsetDays: validated.targetDateRule?.offsetDays ?? null,
			workType: validated.workType,
		},
		where: { id: existing.id },
	});
	const row = await tx.workTemplate.findUnique({ where: { id: existing.id } });
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const template = await toView(tx, row);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		template,
	});
	return { status: "committed", template };
}

async function trashInTransaction(
	tx: PrismaTransaction,
	command: TrashWorkTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<WorkTemplateOutcome> {
	const existing = await tx.workTemplate.findUnique({
		where: { id: command.payload.templateId },
	});
	if (!existing) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, existing.projectId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (existing.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	if (existing.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const template = await toView(tx, existing);
	await tx.workTemplate.update({
		data: {
			revision: existing.revision + 1,
			trashedAt: new Date(),
		},
		where: { id: existing.id },
	});
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		template,
	});
	return { status: "committed", template };
}

async function instantiateInTransaction(
	tx: PrismaTransaction,
	command: InstantiateWorkFromTemplateCommand,
	commandKey: string,
	fingerprint: string
): Promise<InstantiateWorkOutcome> {
	const existing = await tx.workTemplate.findUnique({
		where: { id: command.payload.templateId },
	});
	if (!existing) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockProject(tx, existing.projectId);
	const replayed = await replayInstantiate(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	if (existing.trashedAt) {
		return { reason: "trashed-not-effective", status: "rejected" };
	}
	if (existing.revision !== command.baseRevision) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const dates = relativeDatesForInstantiate(
		existing,
		command.payload.createDay
	);
	if (dates.status === "rejected") {
		return dates;
	}
	const minted = await mintIndependentWork(tx, command, existing);
	if (minted.status !== "ok") {
		return minted.outcome;
	}
	await writeInstantiateReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		selectedFieldDefaults: minted.selectedFieldDefaults,
		work: minted.work,
	});
	return {
		selectedFieldDefaults: minted.selectedFieldDefaults,
		status: "committed",
		work: minted.work,
	};
}

function relativeDatesForInstantiate(
	existing: {
		plannedStartOffsetDays: number | null;
		targetDateOffsetDays: number | null;
	},
	createDay: string | undefined
): RelativeDatePreviewOutcome | { status: "ok" } {
	if (
		existing.plannedStartOffsetDays === null &&
		existing.targetDateOffsetDays === null
	) {
		return { status: "ok" };
	}
	return previewRelativeDateRules({
		createDay: createDay ?? "",
		plannedStartRule: ruleFromOffset(existing.plannedStartOffsetDays),
		targetDateRule: ruleFromOffset(existing.targetDateOffsetDays),
	});
}

async function mintIndependentWork(
	tx: PrismaTransaction,
	command: InstantiateWorkFromTemplateCommand,
	existing: {
		descriptionSkeleton: string | null;
		lightChecklist: Prisma.JsonValue;
		name: string;
		projectId: string;
		selectedFieldDefaults: Prisma.JsonValue;
		workType: string;
	}
): Promise<
	| {
			selectedFieldDefaults: SelectedFieldDefaultView[];
			status: "ok";
			work: InstantiatedWorkView["work"];
	  }
	| { outcome: InstantiateWorkOutcome; status: "rejected" }
> {
	const title = (command.payload.title ?? existing.name).trim();
	if (title.length === 0) {
		return {
			outcome: { reason: "missing-name", status: "rejected" },
			status: "rejected",
		};
	}
	const created = await createWorkInTransaction(tx, {
		actorId: command.actorId,
		idempotencyKey: `${command.idempotencyKey}:work`,
		origin: HUMAN_ORIGIN,
		payload: {
			projectId: existing.projectId,
			title,
			type: existing.workType,
		},
	});
	if (created.status !== "committed") {
		return { outcome: mapCreatedWorkOutcome(created), status: "rejected" };
	}
	const lightChecklist = asChecklist(existing.lightChecklist).map(
		(item): LightChecklistItem => ({
			completed: false,
			id: crypto.randomUUID(),
			title: item.title,
		})
	);
	await tx.work.update({
		data: {
			description: existing.descriptionSkeleton,
			lightChecklist,
			revision: created.work.revision + 1,
		},
		where: { id: created.work.id },
	});
	const selectedFieldDefaults = await hydrateDefaults(
		tx,
		existing.projectId,
		existing.selectedFieldDefaults
	);
	await Promise.all(
		selectedFieldDefaults.map((field) =>
			tx.projectCustomFieldValue.create({
				data: {
					definitionId: field.definitionId,
					id: crypto.randomUUID(),
					recordId: created.work.id,
					recordType: "Work",
					revision: 1,
					value: field.value,
				},
			})
		)
	);
	return {
		selectedFieldDefaults,
		status: "ok",
		work: {
			...created.work,
			description: existing.descriptionSkeleton,
			lightChecklist,
			revision: created.work.revision + 1,
		},
	};
}

function mapCreatedWorkOutcome(
	created: Exclude<
		Awaited<ReturnType<typeof createWorkInTransaction>>,
		{ status: "committed" }
	>
): InstantiateWorkOutcome {
	if (created.status === "conflict") {
		return created;
	}
	if (created.status === "rejected" && created.reason === "unknown-work-type") {
		return { reason: created.reason, status: "rejected" };
	}
	if (created.status === "rejected" && created.reason === "target-not-found") {
		return { reason: created.reason, status: "rejected" };
	}
	if (created.status === "rejected" && created.reason === "missing-title") {
		return { reason: "missing-name", status: "rejected" };
	}
	return { reason: "target-not-found", status: "rejected" };
}

async function validateDefinitionPayload(
	tx: PrismaTransaction,
	payload: CreateWorkTemplateCommand["payload"]
): Promise<
	| {
			descriptionSkeleton: string | null;
			lightChecklist: WorkTemplateChecklistItem[];
			name: string;
			plannedStartRule: RelativeDateRule | null;
			selectedFieldDefaults: SelectedFieldDefaultView[];
			status: "ok";
			targetDateRule: RelativeDateRule | null;
			workType: string;
	  }
	| { outcome: WorkTemplateOutcome; status: "rejected" }
> {
	const name = payload.name?.trim() ?? "";
	if (name.length === 0) {
		return {
			outcome: { reason: "missing-name", status: "rejected" },
			status: "rejected",
		};
	}
	const workType = payload.workType?.trim() ?? "";
	if (!isWorkType(workType)) {
		return {
			outcome: { reason: "unknown-work-type", status: "rejected" },
			status: "rejected",
		};
	}
	const descriptionSkeleton = payload.descriptionSkeleton?.trim() || null;
	if (
		descriptionSkeleton !== null &&
		DOCUMENT_PLACEHOLDER.test(descriptionSkeleton)
	) {
		return {
			outcome: { reason: "document-placeholder", status: "rejected" },
			status: "rejected",
		};
	}
	const lightChecklist = (payload.lightChecklist ?? []).flatMap((item) => {
		const title = item.title.trim();
		if (title.length === 0) {
			return [];
		}
		return [{ id: item.id, title }];
	});
	const plannedStartRule = payload.plannedStartRule ?? null;
	const targetDateRule = payload.targetDateRule ?? null;
	const fields = await resolveSelectedDefaults(
		tx,
		payload.projectId,
		payload.selectedFieldDefaults ?? []
	);
	if (fields.status !== "ok") {
		return fields;
	}
	return {
		descriptionSkeleton,
		lightChecklist,
		name,
		plannedStartRule,
		selectedFieldDefaults: fields.defaults,
		status: "ok",
		targetDateRule,
		workType,
	};
}

async function resolveSelectedDefaults(
	tx: PrismaTransaction,
	projectId: string,
	inputs: readonly SelectedFieldDefaultInput[]
): Promise<
	| { defaults: SelectedFieldDefaultView[]; status: "ok" }
	| { outcome: WorkTemplateOutcome; status: "rejected" }
> {
	if (inputs.some((input) => input.value.kind === "date")) {
		return {
			outcome: { reason: "date-field-default", status: "rejected" },
			status: "rejected",
		};
	}
	const ids = inputs.map((input) => input.definitionId);
	const rows =
		ids.length === 0
			? []
			: await tx.projectCustomFieldDefinition.findMany({
					where: { id: { in: ids }, projectId },
				});
	const byId = new Map(rows.map((row) => [row.id, row]));
	const defaults: SelectedFieldDefaultView[] = [];
	for (const input of inputs) {
		const definition = byId.get(input.definitionId);
		if (!definition) {
			return {
				outcome: { reason: "unbound-field", status: "rejected" },
				status: "rejected",
			};
		}
		if (definition.type === "Date") {
			return {
				outcome: { reason: "date-field-default", status: "rejected" },
				status: "rejected",
			};
		}
		if (
			!(
				definition.boundRecordTypes.includes("Work") &&
				isBindableRecordType("Work")
			)
		) {
			return {
				outcome: { reason: "unbound-field", status: "rejected" },
				status: "rejected",
			};
		}
		const normalized = normalizeStoredValue(definition.type, input.value);
		if (!valueMatchesType(definition.type, definition.options, normalized)) {
			return {
				outcome: { reason: "value-type-mismatch", status: "rejected" },
				status: "rejected",
			};
		}
		defaults.push({
			definitionId: definition.id,
			name: definition.name,
			type: definition.type,
			value: normalized,
		});
	}
	return { defaults, status: "ok" };
}

function valueMatchesType(
	type: string,
	options: readonly string[],
	value: CustomFieldStoredValue
): boolean {
	if (value.kind === "unset") {
		return true;
	}
	if (type === "Text" && value.kind === "text") {
		return true;
	}
	if (type === "Number" && value.kind === "number") {
		return Number.isFinite(value.number);
	}
	if (type === "Boolean" && value.kind === "boolean") {
		return true;
	}
	if (type === "Single select" && value.kind === "single-select") {
		return options.includes(value.option);
	}
	if (type === "Multi select" && value.kind === "multi-select") {
		return value.options.every((option) => options.includes(option));
	}
	return false;
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<WorkTemplateOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await tx.workTemplate.findUnique({
		where: { id: existing.targetId },
	});
	if (live && !live.trashedAt) {
		return { status: "replayed", template: await toView(tx, live) };
	}
	const stored = storedTemplate(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { status: "replayed", template: stored };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		template: WorkTemplateView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.template.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.template),
			targetId: input.template.id,
		},
	});
}

async function replayInstantiate(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<InstantiateWorkOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const stored = storedInstantiated(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return {
		selectedFieldDefaults: stored.selectedFieldDefaults,
		status: "replayed",
		work: stored.work,
	};
}

async function writeInstantiateReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		selectedFieldDefaults: SelectedFieldDefaultView[];
		work: InstantiatedWorkView["work"];
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.work.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify({
				selectedFieldDefaults: input.selectedFieldDefaults,
				work: input.work,
			}),
			targetId: input.work.id,
		},
	});
}

function storedInstantiated(value: string): InstantiatedWorkView | null {
	try {
		return instantiatedWorkViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`work-templates:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

function ruleFromOffset(offsetDays: number | null): RelativeDateRule | null {
	if (offsetDays === null) {
		return null;
	}
	return { offsetDays };
}

async function toView(
	db: PrismaClient | PrismaTransaction,
	row: {
		descriptionSkeleton: string | null;
		id: string;
		lightChecklist: Prisma.JsonValue;
		name: string;
		plannedStartOffsetDays: number | null;
		projectId: string;
		revision: number;
		selectedFieldDefaults: Prisma.JsonValue;
		targetDateOffsetDays: number | null;
		workType: string;
	}
): Promise<WorkTemplateView> {
	return {
		descriptionSkeleton: row.descriptionSkeleton,
		id: row.id,
		lightChecklist: asChecklist(row.lightChecklist),
		name: row.name,
		plannedStartRule: ruleFromOffset(row.plannedStartOffsetDays),
		projectId: row.projectId,
		revision: row.revision,
		selectedFieldDefaults: await hydrateDefaults(
			db,
			row.projectId,
			row.selectedFieldDefaults
		),
		targetDateRule: ruleFromOffset(row.targetDateOffsetDays),
		workType: row.workType,
	};
}

function asChecklist(value: Prisma.JsonValue): WorkTemplateChecklistItem[] {
	const parsed = z.array(workTemplateChecklistItemSchema).safeParse(value);
	return parsed.success ? parsed.data : [];
}

async function hydrateDefaults(
	db: PrismaClient | PrismaTransaction,
	projectId: string,
	value: Prisma.JsonValue
): Promise<SelectedFieldDefaultView[]> {
	if (!Array.isArray(value)) {
		return [];
	}
	const parsed = value.flatMap((item) => {
		if (!isRecord(item) || typeof item.definitionId !== "string") {
			return [];
		}
		const stored = customFieldStoredValueSchema.safeParse(item.value);
		if (!stored.success || stored.data.kind === "date") {
			return [];
		}
		return [
			{
				definitionId: item.definitionId,
				name: typeof item.name === "string" ? item.name : "",
				value: stored.data,
			},
		];
	});
	const ids = parsed.map((item) => item.definitionId);
	const rows =
		ids.length === 0
			? []
			: await db.projectCustomFieldDefinition.findMany({
					where: { id: { in: ids }, projectId },
				});
	const byId = new Map(rows.map((row) => [row.id, row]));
	return parsed.flatMap((item) => {
		const definition = byId.get(item.definitionId);
		if (!definition || definition.type === "Date") {
			return [];
		}
		return [
			{
				definitionId: definition.id,
				name: item.name.length > 0 ? item.name : definition.name,
				type: definition.type,
				value: item.value,
			},
		];
	});
}

function storedTemplate(value: string): WorkTemplateView | null {
	try {
		return workTemplateViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}
