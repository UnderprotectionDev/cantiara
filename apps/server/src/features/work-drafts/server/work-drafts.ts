import type { PrismaClient } from "@cantiara/db";
import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createWorkInTransaction,
	finalizeDraft,
} from "../../work-lifecycle/server/work-lifecycle";
import type { WorkLifecycleOutcome } from "../../work-lifecycle/server/work-lifecycle-model";
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
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

export type DeleteDraftOutcome =
	| { status: "deleted" }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "not-found" };

export interface FinalizeDraftInput {
	draftId?: string;
	form: WorkDraftFormState;
	idempotencyKey: string;
}

export type FinalizeDraftOutcome =
	| {
			draft: null;
			status: "created";
			work: { id: string; key: string; title: string; type: string };
	  }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { status: "consumed" }
	| { status: "not-found" }
	| { reason: string; status: "rejected" };

export type WorkDraftCreateAdapter = (command: {
	idempotencyKey: string;
	payload: { projectId: string; title: string; type: string };
}) => Promise<WorkLifecycleOutcome>;

export interface DisconnectChrome {
	lastSavedLabel: typeof WORK_DRAFTS_COPY.lastSaved;
	lastSuccessfulSaveAt: Date | null;
	queueRow: null;
	unsavedRisk: typeof WORK_DRAFTS_COPY.unsavedChangesMayBeLost | null;
}

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
	disconnectChrome: (hasUnsavedChanges: boolean) => DisconnectChrome | null;
	documentDrafts: () => readonly [];
	exportRows: () => readonly [];
	finalize: (input: FinalizeDraftInput) => Promise<FinalizeDraftOutcome>;
	goOffline: () => void;
	list: () => Promise<WorkDraftView[]>;
	notificationEvents: () => readonly [];
	projectActivityEvents: () => readonly [];
	publishItems: () => readonly [];
	reconnect: (unsaved?: WorkDraftFormState) => Promise<{
		draft: WorkDraftView | null;
		lastSuccessfulSaveAt: Date | null;
		queued: false;
		replayed: false;
	}>;
	recordHistoryEvents: () => readonly [];
	relationEnds: () => readonly [];
	resume: (draftId: string) => Promise<WorkDraftView | null>;
	searchHits: () => readonly [];
	shareTargets: () => readonly [];
	surfaces: (draftId: string) => DraftSurfaceEligibility | null;
	unsavedRisk: (
		hasUnsavedChanges: boolean
	) => typeof WORK_DRAFTS_COPY.unsavedChangesMayBeLost | null;
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
	workCreate?: WorkDraftCreateAdapter;
	workFieldDefinitions?: (
		projectId: string | null
	) => readonly WorkCustomFieldDefinition[];
	workspaceId: string;
}): WorkDrafts {
	let now = input.clock ? input.clock.now() : new Date();
	let online = input.connected !== false;
	const fieldDefinitions = input.workFieldDefinitions ?? (() => []);
	const customWorkCreate = input.workCreate;
	const knownIds = new Set<string>();
	let lastSuccessfulSaveAt: Date | null = null;
	let lastSavedDraftId: string | null = null;
	const workCreate: WorkDraftCreateAdapter =
		customWorkCreate ??
		((command) =>
			finalizeDraft(input.prisma, {
				actorId: input.actorId,
				idempotencyKey: command.idempotencyKey,
				origin: "human",
				payload: command.payload,
			}));

	function unsavedRisk(
		hasUnsavedChanges: boolean
	): typeof WORK_DRAFTS_COPY.unsavedChangesMayBeLost | null {
		return hasUnsavedChanges ? WORK_DRAFTS_COPY.unsavedChangesMayBeLost : null;
	}

	function fromWorkCreate(created: WorkLifecycleOutcome):
		| {
				status: "ok";
				work: { id: string; key: string; title: string; type: string };
		  }
		| FinalizeDraftOutcome {
		if (created.status === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (created.status === "committed" || created.status === "replayed") {
			return {
				status: "ok",
				work: {
					id: created.work.id,
					key: created.work.key,
					title: created.work.title,
					type: created.work.type,
				},
			};
		}
		return {
			reason: "reason" in created ? created.reason : "target-not-found",
			status: "rejected",
		};
	}

	async function consumeDraft(draftId: string) {
		await input.prisma.workDraft.deleteMany({
			where: {
				...ownerWhere(input.workspaceId, input.actorId),
				id: draftId,
			},
		});
		knownIds.delete(draftId);
		if (lastSavedDraftId === draftId) {
			lastSavedDraftId = null;
		}
	}

	async function load(draftId: string) {
		const row = await input.prisma.workDraft.findFirst({
			where: {
				...ownerWhere(input.workspaceId, input.actorId),
				id: draftId,
			},
		});
		return row ? toView(row) : null;
	}

	async function finalizeToWork(
		command: FinalizeDraftInput
	): Promise<FinalizeDraftOutcome> {
		if (!online) {
			return { queued: false, reason: "offline", status: "refused" };
		}
		const form = workDraftFormSchema.parse(command.form);
		const payload = {
			draftId: command.draftId ?? "",
			form,
		};
		const existing = await readDurableReceipt(
			input.prisma,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return JSON.parse(existing.resultValue) as FinalizeDraftOutcome;
		}
		if (command.draftId && !(await load(command.draftId))) {
			return { status: "consumed" };
		}
		const { projectId } = form;
		if (!projectId) {
			return { reason: "missing-project", status: "rejected" };
		}
		const created = customWorkCreate
			? fromWorkCreate(
					await workCreate({
						idempotencyKey: command.idempotencyKey,
						payload: {
							projectId,
							title: form.title,
							type: form.type,
						},
					})
				)
			: await input.prisma.$transaction(
					async (
						tx
					): Promise<
						| FinalizeDraftOutcome
						| {
								status: "ok";
								work: { id: string; key: string; title: string; type: string };
						  }
						// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: finalize coordinates the draft lock, Work creation, consumption, and receipt barrier.
					> => {
						await lockMutation(
							tx,
							`work-draft-finalize:${input.actorId}:${command.draftId ?? "new"}`
						);
						const lockedReceipt = await readDurableReceipt(
							tx,
							command.idempotencyKey,
							payload
						);
						if (lockedReceipt?.kind === "conflict") {
							return { reason: MUTATION_COPY.conflict, status: "conflict" };
						}
						if (lockedReceipt?.kind === "replay") {
							return JSON.parse(
								lockedReceipt.resultValue
							) as FinalizeDraftOutcome;
						}
						if (command.draftId) {
							const draft = await tx.workDraft.findFirst({
								where: {
									...ownerWhere(input.workspaceId, input.actorId),
									id: command.draftId,
								},
							});
							if (!draft) {
								return { status: "consumed" };
							}
						}
						const work = fromWorkCreate(
							await createWorkInTransaction(tx, {
								actorId: input.actorId,
								idempotencyKey: command.idempotencyKey,
								origin: "human",
								payload: {
									projectId,
									title: form.title,
									type: form.type,
								},
							})
						);
						if (work.status !== "ok") {
							return work;
						}
						if (command.draftId) {
							await tx.workDraft.deleteMany({
								where: {
									...ownerWhere(input.workspaceId, input.actorId),
									id: command.draftId,
								},
							});
						}
						const committed: FinalizeDraftOutcome = {
							draft: null,
							status: "created",
							work: work.work,
						};
						await writeDurableReceipt(tx, {
							actorId: input.actorId,
							commandKey: command.idempotencyKey,
							kind: "work-draft-finalize",
							payload,
							resultValue: JSON.stringify(committed),
							targetId: command.draftId ?? work.work.id,
						});
						return committed;
					}
				);
		if (created.status !== "ok") {
			return created;
		}
		if (command.draftId) {
			await consumeDraft(command.draftId);
		}
		const outcome: FinalizeDraftOutcome = {
			draft: null,
			status: "created",
			work: created.work,
		};
		lastSuccessfulSaveAt = now;
		await writeDurableReceipt(input.prisma, {
			actorId: input.actorId,
			commandKey: command.idempotencyKey,
			kind: "work-draft-finalize",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: command.draftId ?? created.work.id,
		});
		return outcome;
	}

	return {
		advanceTime(instant) {
			now = instant;
		},
		async autosave(command) {
			if (!online) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			return await input.prisma.$transaction(
				async (tx): Promise<AutosaveDraftOutcome> => {
					await lockMutation(
						tx,
						`work-draft:${command.draftId ?? `new:${input.actorId}`}`
					);
					const form = workDraftFormSchema.parse(command.form);
					const payload = {
						draftId: command.draftId ?? "",
						form,
					};
					const existing = await readDurableReceipt(
						tx,
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
						const current = await tx.workDraft.findFirst({
							where: {
								...ownerWhere(input.workspaceId, input.actorId),
								id: command.draftId,
							},
						});
						if (!current) {
							return { status: "not-found" };
						}
						row = await tx.workDraft.update({
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
						row = await tx.workDraft.create({
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
					lastSuccessfulSaveAt = savedAt;
					lastSavedDraftId = draft.id;
					await writeDurableReceipt(tx, {
						actorId: input.actorId,
						commandKey: command.idempotencyKey,
						kind: "work-draft-autosave",
						payload,
						resultValue: JSON.stringify(outcome),
						targetId: draft.id,
					});
					return outcome;
				}
			);
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
			if (!online) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = { draftId: command.draftId };
			const result = await input.prisma.$transaction(
				async (tx): Promise<DeleteDraftOutcome> => {
					await lockMutation(tx, `work-draft:${command.draftId}`);
					const existing = await readDurableReceipt(
						tx,
						command.idempotencyKey,
						payload
					);
					if (existing?.kind === "conflict") {
						return { reason: MUTATION_COPY.conflict, status: "conflict" };
					}
					if (existing?.kind === "replay") {
						return JSON.parse(existing.resultValue) as DeleteDraftOutcome;
					}
					const current = await tx.workDraft.findFirst({
						where: {
							...ownerWhere(input.workspaceId, input.actorId),
							id: command.draftId,
						},
					});
					if (!current) {
						return { status: "not-found" };
					}
					await tx.workDraft.delete({ where: { id: current.id } });
					knownIds.delete(current.id);
					const outcome: DeleteDraftOutcome = { status: "deleted" };
					await writeDurableReceipt(tx, {
						actorId: input.actorId,
						commandKey: command.idempotencyKey,
						kind: "work-draft-delete",
						payload,
						resultValue: JSON.stringify(outcome),
						targetId: current.id,
					});
					return outcome;
				}
			);
			return result;
		},
		disconnectChrome(hasUnsavedChanges) {
			if (online) {
				return null;
			}
			return {
				lastSavedLabel: WORK_DRAFTS_COPY.lastSaved,
				lastSuccessfulSaveAt,
				queueRow: null,
				unsavedRisk: unsavedRisk(hasUnsavedChanges),
			};
		},
		documentDrafts() {
			return [];
		},
		exportRows() {
			return [];
		},
		finalize: finalizeToWork,
		goOffline() {
			online = false;
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
		async reconnect(_unsaved?: WorkDraftFormState) {
			const draft = lastSavedDraftId ? await load(lastSavedDraftId) : null;
			return {
				draft,
				lastSuccessfulSaveAt,
				queued: false,
				replayed: false,
			};
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
		unsavedRisk,
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
