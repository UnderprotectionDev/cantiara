import type { PrismaClient } from "@cantiara/db";

import {
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	DRAFT_SURFACE_EXCLUSION,
	type DraftSurfaceEligibility,
	WORK_DRAFTS_COPY,
	type WorkCustomFieldDefinition,
	type WorkDraftFormState,
	type WorkDraftView,
	workDraftFormSchema,
} from "./work-drafts-model";

export type {
	WorkCustomFieldDefinition,
	WorkDraftFormState,
	WorkDraftView,
} from "./work-drafts-model";

export interface AutosaveDraftInput {
	draftId?: string;
	form: WorkDraftFormState;
	idempotencyKey: string;
}

export type AutosaveDraftOutcome =
	| {
			draft: WorkDraftView;
			lastSuccessfulSaveAt: Date;
			mainRecord: null;
			status: "saved";
	  }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export type DeleteDraftOutcome =
	| { status: "deleted" }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

export interface WorkDrafts {
	advanceTime: (instant: Date) => void;
	autosave: (input: AutosaveDraftInput) => Promise<AutosaveDraftOutcome>;
	backlogRows: () => readonly [];
	captureInboxItems: () => readonly [];
	definesCustomFieldSchema: () => false;
	deleteDraft: (input: {
		draftId: string;
		idempotencyKey: string;
	}) => Promise<DeleteDraftOutcome>;
	documentDrafts: () => readonly [];
	exportRows: () => readonly [];
	list: () => Promise<WorkDraftView[]>;
	notificationEvents: () => readonly [];
	projectActivityEvents: () => readonly [];
	publishItems: () => readonly [];
	recordHistoryEvents: () => readonly [];
	relationEnds: () => readonly [];
	resume: (draftId: string) => Promise<WorkDraftView | null>;
	searchHits: () => readonly [];
	shareTargets: () => readonly [];
	surfaces: (draftId: string) => DraftSurfaceEligibility | null;
	workCustomFields: (
		projectId: string | null
	) => readonly WorkCustomFieldDefinition[];
	writeQueue: () => readonly never[];
}

function reviveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function reviveDraft(draft: WorkDraftView): WorkDraftView {
	return {
		...draft,
		updatedAt: reviveDate(draft.updatedAt),
	};
}

function reviveAutosave(outcome: AutosaveDraftOutcome): AutosaveDraftOutcome {
	if (outcome.status !== "saved") {
		return outcome;
	}
	return {
		...outcome,
		draft: reviveDraft(outcome.draft),
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

async function readHumanReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
) {
	const existing = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" as const };
	}
	return { kind: "replay" as const, resultValue: existing.resultValue };
}

async function writeHumanReceipt(
	prisma: PrismaClient,
	input: {
		actorId: string;
		commandKey: string;
		kind: string;
		payload: unknown;
		resultValue: string;
		targetId: string;
	}
) {
	await prisma.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			kind: input.kind,
			origin: "human",
			payloadFingerprint: payloadFingerprint(input.payload),
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
}

function toView(row: {
	customFieldValuesText: string;
	id: string;
	projectId: string | null;
	title: string;
	type: string;
	updatedAt: Date;
}): WorkDraftView {
	const parsed = workDraftFormSchema.parse({
		customFieldValues: JSON.parse(row.customFieldValuesText) as Record<
			string,
			string
		>,
		projectId: row.projectId,
		title: row.title,
		type: row.type,
	});
	return {
		captureInboxItem: false,
		documentDraft: false,
		form: parsed,
		id: row.id,
		kind: "work-draft",
		mainRecord: false,
		updatedAt: row.updatedAt,
		workKey: null,
	};
}

function ownerWhere(workspaceId: string, ownerId: string) {
	return { ownerId, workspaceId };
}

export function createWorkDrafts(input: {
	actorId: string;
	clock?: { now: () => Date };
	connected?: boolean;
	prisma: PrismaClient;
	workFieldDefinitions?: (
		projectId: string | null
	) => readonly WorkCustomFieldDefinition[];
	workspaceId: string;
}): WorkDrafts {
	let now = input.clock ? input.clock.now() : new Date();
	const connected = () => input.connected !== false;
	const fieldDefinitions = input.workFieldDefinitions ?? (() => []);
	const knownIds = new Set<string>();

	async function load(draftId: string) {
		const row = await input.prisma.workDraft.findFirst({
			where: {
				...ownerWhere(input.workspaceId, input.actorId),
				id: draftId,
			},
		});
		return row ? toView(row) : null;
	}

	return {
		advanceTime(instant) {
			now = instant;
		},
		async autosave(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const form = workDraftFormSchema.parse(command.form);
			const payload = {
				draftId: command.draftId ?? "",
				form,
			};
			const existing = await readHumanReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveAutosave(
					JSON.parse(existing.resultValue) as AutosaveDraftOutcome
				);
			}
			const savedAt = now;
			let row: {
				customFieldValuesText: string;
				id: string;
				projectId: string | null;
				title: string;
				type: string;
				updatedAt: Date;
			};
			if (command.draftId) {
				const current = await input.prisma.workDraft.findFirst({
					where: {
						...ownerWhere(input.workspaceId, input.actorId),
						id: command.draftId,
					},
				});
				if (!current) {
					return { queued: false, reason: "offline", status: "refused" };
				}
				row = await input.prisma.workDraft.update({
					data: {
						customFieldValuesText: JSON.stringify(form.customFieldValues),
						projectId: form.projectId,
						title: form.title,
						type: form.type,
						updatedAt: savedAt,
					},
					where: { id: current.id },
				});
			} else {
				row = await input.prisma.workDraft.create({
					data: {
						customFieldValuesText: JSON.stringify(form.customFieldValues),
						id: crypto.randomUUID(),
						ownerId: input.actorId,
						projectId: form.projectId,
						title: form.title,
						type: form.type,
						updatedAt: savedAt,
						workspaceId: input.workspaceId,
					},
				});
			}
			const draft = toView(row);
			knownIds.add(draft.id);
			const outcome: AutosaveDraftOutcome = {
				draft,
				lastSuccessfulSaveAt: savedAt,
				mainRecord: null,
				status: "saved",
			};
			await writeHumanReceipt(input.prisma, {
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				kind: "work-draft-autosave",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: draft.id,
			});
			return outcome;
		},
		backlogRows() {
			return [];
		},
		captureInboxItems() {
			return [];
		},
		definesCustomFieldSchema() {
			return false;
		},
		async deleteDraft(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = { draftId: command.draftId };
			const existing = await readHumanReceipt(
				input.prisma,
				command.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as DeleteDraftOutcome;
			}
			const current = await input.prisma.workDraft.findFirst({
				where: {
					...ownerWhere(input.workspaceId, input.actorId),
					id: command.draftId,
				},
			});
			if (!current) {
				return { status: "not-found" };
			}
			await input.prisma.workDraft.delete({ where: { id: current.id } });
			knownIds.delete(current.id);
			const outcome: DeleteDraftOutcome = { status: "deleted" };
			await writeHumanReceipt(input.prisma, {
				actorId: input.actorId,
				commandKey: command.idempotencyKey,
				kind: "work-draft-delete",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: current.id,
			});
			return outcome;
		},
		documentDrafts() {
			return [];
		},
		exportRows() {
			return [];
		},
		async list() {
			const rows = await input.prisma.workDraft.findMany({
				orderBy: { updatedAt: "asc" },
				where: ownerWhere(input.workspaceId, input.actorId),
			});
			const views = rows.map(toView);
			for (const view of views) {
				knownIds.add(view.id);
			}
			return views;
		},
		notificationEvents() {
			return [];
		},
		projectActivityEvents() {
			return [];
		},
		publishItems() {
			return [];
		},
		recordHistoryEvents() {
			return [];
		},
		relationEnds() {
			return [];
		},
		resume(draftId) {
			return load(draftId);
		},
		searchHits() {
			return [];
		},
		shareTargets() {
			return [];
		},
		surfaces(draftId) {
			if (!knownIds.has(draftId)) {
				return null;
			}
			return DRAFT_SURFACE_EXCLUSION;
		},
		workCustomFields(projectId) {
			return fieldDefinitions(projectId).filter(
				(field) => field.boundRecordType === "Work"
			);
		},
		writeQueue() {
			return [];
		},
	};
}

export function workDraftsCatalog() {
	return {
		copy: WORK_DRAFTS_COPY,
		customFieldSchema: null,
		workCustomFields: [] as const,
	};
}
