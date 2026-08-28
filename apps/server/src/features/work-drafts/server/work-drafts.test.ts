/**
 * Work Drafts seam — autosave while online, personal Drafts
 * list, resume, delete that does not touch Work, time-advance
 * that does not delete, and counterparts that keep a Draft out
 * of search, planning, relations, sharing, publishing, export,
 * Capture Inbox, and Document drafts. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Taslak: autosave, anti-search, time-advance, disconnect,
 * recovery, single finalize).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	finalizeDraft,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createWorkDrafts, workDraftsCatalog } from "./work-drafts";
import {
	DRAFT_SURFACE_EXCLUSION,
	WORK_DRAFTS_COPY,
	type WorkCustomFieldDefinition,
} from "./work-drafts-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const SAVED_AT = new Date("2026-08-27T12:00:00.000Z");
const NINETY_DAYS_LATER = new Date("2026-11-25T12:00:00.000Z");
const WORK_KEY_PATTERN = /^[A-Z]+-\d+$/;
const CONCURRENT_SAVE_TITLE_PATTERN =
	/^First concurrent save|Second concurrent save$/;

describe("Work Drafts catalog", () => {
	it("exposes English Draft and Drafts without a custom-field schema", () => {
		expect(workDraftsCatalog()).toEqual({
			copy: {
				create: "Create",
				delete: "Delete",
				draft: "Draft",
				drafts: "Drafts",
				lastSaved: "Last saved",
				loading: "Loading…",
				noDrafts: "No drafts.",
				resume: "Resume",
				unsavedChangesMayBeLost: "Unsaved changes may be lost",
			},
			customFieldSchema: null,
			workCustomFields: [],
		});
		expect(WORK_DRAFTS_COPY.draft).toBe("Draft");
		expect(WORK_DRAFTS_COPY.drafts).toBe("Drafts");
		expect(WORK_DRAFTS_COPY.create).toBe("Create");
		expect(WORK_DRAFTS_COPY.lastSaved).toBe("Last saved");
		expect(WORK_DRAFTS_COPY.unsavedChangesMayBeLost).toBe(
			"Unsaved changes may be lost"
		);
	});
});

describe("Work Drafts", () => {
	let actorId: string;
	let prisma: PrismaClient;
	let pool: Pool;
	let workspaceId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		actorId = crypto.randomUUID();
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		const user = await prisma.user.create({
			data: {
				email: `${actorId}@example.com`,
				emailVerified: true,
				id: actorId,
				name: "Founder",
			},
		});
		const workspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Solo",
				ownerId: user.id,
			},
		});
		workspaceId = workspace.id;
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany({
			where: { actorId },
		});
		await prisma.workDraft.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function drafts(
		overrides: {
			connected?: boolean;
			workCreate?: Parameters<typeof createWorkDrafts>[0]["workCreate"];
			workFieldDefinitions?: (
				projectId: string | null
			) => readonly WorkCustomFieldDefinition[];
		} = {}
	) {
		return createWorkDrafts({
			actorId,
			clock: { now: () => SAVED_AT },
			connected: overrides.connected,
			prisma,
			workCreate: overrides.workCreate,
			workFieldDefinitions: overrides.workFieldDefinitions,
			workspaceId,
		});
	}

	async function openPayments() {
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `create-payments-${actorId}`,
			origin: "human",
			payload: {
				name: "Payments",
				starterConfiguration: "Blank Project",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		return created.project;
	}

	it("autosaves a personal Draft while online without a main record or Work key", async () => {
		const surface = drafts();
		const outcome = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Intake form",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});

		expect(outcome).toMatchObject({
			draft: {
				captureInboxItem: false,
				documentDraft: false,
				form: {
					customFieldValues: {},
					projectId: null,
					title: "Intake form",
					type: "Task",
				},
				kind: "work-draft",
				mainRecord: false,
				workKey: null,
			},
			lastSuccessfulSaveAt: SAVED_AT,
			mainRecord: null,
			status: "saved",
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved Draft");
		}
		expect(outcome.draft.id).not.toMatch(WORK_KEY_PATTERN);
		expect(await surface.list()).toEqual([outcome.draft]);
		expect(await surface.resume(outcome.draft.id)).toEqual(outcome.draft);
		const resumed = await surface.autosave({
			draftId: outcome.draft.id,
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Intake form after refresh",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		expect(resumed.status).toBe("saved");
		if (resumed.status !== "saved") {
			throw new Error("expected resumed Draft");
		}
		expect(resumed.draft.id).toBe(outcome.draft.id);
		expect(resumed.draft.form.title).toBe("Intake form after refresh");
		expect(await surface.list()).toHaveLength(1);
	});

	it("refuses an offline autosave, never queues, and keeps the last successful Draft", async () => {
		const online = drafts();
		const saved = await online.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Landed",
				type: "Bug",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		const offline = drafts({ connected: false });
		const refused = await offline.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Should not queue",
				type: "Bug",
			},
			idempotencyKey: crypto.randomUUID(),
		});

		expect(saved).toMatchObject({
			lastSuccessfulSaveAt: SAVED_AT,
			status: "saved",
		});
		expect(refused).toEqual({
			queued: false,
			reason: "offline",
			status: "refused",
		});
		expect(offline.writeQueue()).toEqual([]);
		expect(await online.list()).toHaveLength(1);
	});

	it("does not delete a Draft when time advances", async () => {
		const surface = drafts();
		const outcome = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Still here in ninety days",
				type: "Research",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		surface.advanceTime(NINETY_DAYS_LATER);

		expect(await surface.list()).toEqual([
			outcome.status === "saved" ? outcome.draft : undefined,
		]);
	});

	it("keeps a Draft out of search, Backlog, relations, sharing, publishing, and export", async () => {
		const surface = drafts();
		const outcome = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Do not leak this",
				type: "Improvement",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		expect(surface.surfaces(outcome.draft.id)).toEqual(DRAFT_SURFACE_EXCLUSION);
		expect(DRAFT_SURFACE_EXCLUSION).toEqual({
			backlog: false,
			export: false,
			kanban: false,
			mainRecord: false,
			notification: false,
			publish: false,
			relation: false,
			search: false,
			share: false,
			smartCollection: false,
		});
		expect(surface.searchHits()).toEqual([]);
		expect(surface.backlogRows()).toEqual([]);
		expect(surface.relationEnds()).toEqual([]);
		expect(surface.shareTargets()).toEqual([]);
		expect(surface.publishItems()).toEqual([]);
		expect(surface.exportRows()).toEqual([]);
		expect(surface.notificationEvents()).toEqual([]);
		expect(surface.projectActivityEvents()).toEqual([]);
		expect(surface.recordHistoryEvents()).toEqual([]);
		expect(outcome.mainRecord).toBeNull();
		expect(outcome.draft.workKey).toBeNull();
	});

	it("is not a Capture Inbox item or a Document draft", async () => {
		const surface = drafts();
		const outcome = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Form only",
				type: "Feature",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		expect(outcome.draft.captureInboxItem).toBe(false);
		expect(outcome.draft.documentDraft).toBe(false);
		expect(outcome.draft.kind).toBe("work-draft");
		expect(surface.captureInboxItems()).toEqual([]);
		expect(surface.documentDrafts()).toEqual([]);
	});

	it("does not mint a Work key, list Work, or emit history before Create", async () => {
		const project = await openPayments();
		const surface = drafts();
		const outcome = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Not Work yet",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		expect(outcome.draft.workKey).toBeNull();
		expect(await listWork(prisma, project.id)).toEqual([]);
		expect(surface.projectActivityEvents()).toEqual([]);
		expect(surface.recordHistoryEvents()).toEqual([]);
	});

	it("deletes a Draft without affecting Work", async () => {
		const project = await openPayments();
		const created = await createWork(prisma, {
			actorId,
			idempotencyKey: `work-${actorId}`,
			origin: "human",
			payload: {
				projectId: project.id,
				title: "Real Work",
				type: "Task",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const surface = drafts();
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Unfinished form",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		const deleted = await surface.deleteDraft({
			draftId: saved.draft.id,
			idempotencyKey: crypto.randomUUID(),
		});

		expect(deleted).toEqual({ status: "deleted" });
		expect(await surface.list()).toEqual([]);
		expect(await getWork(prisma, created.work.id)).toEqual(created.work);
		expect(await listWork(prisma, project.id)).toEqual([created.work]);
	});

	it("stores Work-bound custom field values as form state and does not define a schema", async () => {
		const project = await openPayments();
		const definitions: readonly WorkCustomFieldDefinition[] = [
			{
				boundRecordType: "Work",
				id: "severity",
				label: "Severity",
			},
		];
		const surface = drafts({
			workFieldDefinitions: (projectId) =>
				projectId === project.id ? definitions : [],
		});

		expect(surface.workCustomFields(project.id)).toEqual(definitions);
		expect(surface.workCustomFields(null)).toEqual([]);
		expect(surface.definesCustomFieldSchema()).toBe(false);

		const outcome = await surface.autosave({
			form: {
				customFieldValues: { severity: "High" },
				projectId: project.id,
				title: "With field values",
				type: "Bug",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		expect(outcome.draft.form.customFieldValues).toEqual({ severity: "High" });
		expect(outcome.draft).not.toHaveProperty("customFieldDefinitions");
		expect(outcome.draft).not.toHaveProperty("fieldSchema");
		expect(workDraftsCatalog().customFieldSchema).toBeNull();
	});

	it("replays the same autosave and conflicts on a different payload", async () => {
		const surface = drafts();
		const key = crypto.randomUUID();
		const form = {
			customFieldValues: {},
			projectId: null,
			title: "Same form",
			type: "Task" as const,
		};
		const first = await surface.autosave({
			form,
			idempotencyKey: key,
		});
		const replayed = await surface.autosave({
			form,
			idempotencyKey: key,
		});
		const conflict = await surface.autosave({
			form: { ...form, title: "Different" },
			idempotencyKey: key,
		});

		expect(first.status).toBe("saved");
		expect(replayed.status).toBe("saved");
		if (first.status !== "saved" || replayed.status !== "saved") {
			throw new Error("expected saved Draft");
		}
		expect(replayed.draft.id).toBe(first.draft.id);
		expect(await surface.list()).toHaveLength(1);
		expect(conflict).toEqual({
			reason: MUTATION_COPY.conflict,
			status: "conflict",
		});
	});

	it("serializes concurrent autosaves so the draft remains a complete form", async () => {
		const surface = drafts();
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Initial",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}
		const [first, second] = await Promise.all([
			surface.autosave({
				draftId: saved.draft.id,
				form: {
					customFieldValues: { source: "first" },
					projectId: null,
					title: "First concurrent save",
					type: "Bug",
				},
				idempotencyKey: crypto.randomUUID(),
			}),
			surface.autosave({
				draftId: saved.draft.id,
				form: {
					customFieldValues: { source: "second" },
					projectId: null,
					title: "Second concurrent save",
					type: "Research",
				},
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(first.status).toBe("saved");
		expect(second.status).toBe("saved");
		const current = await surface.resume(saved.draft.id);
		expect(current?.form.title).toMatch(CONCURRENT_SAVE_TITLE_PATTERN);
		expect(current?.form.customFieldValues).toEqual(
			current?.form.title === "First concurrent save"
				? { source: "first" }
				: { source: "second" }
		);
		expect(await surface.list()).toHaveLength(1);
	});

	it("shows Last saved and unsaved risk on disconnect with no queue row", async () => {
		const surface = drafts();
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Landed",
				type: "Bug",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		expect(saved.status).toBe("saved");
		expect(surface.disconnectChrome(true)).toBeNull();

		surface.goOffline();

		expect(surface.disconnectChrome(true)).toEqual({
			lastSavedLabel: "Last saved",
			lastSuccessfulSaveAt: SAVED_AT,
			queueRow: null,
			unsavedRisk: "Unsaved changes may be lost",
		});
		expect(surface.disconnectChrome(false)).toEqual({
			lastSavedLabel: "Last saved",
			lastSuccessfulSaveAt: SAVED_AT,
			queueRow: null,
			unsavedRisk: null,
		});
		expect(surface.writeQueue()).toEqual([]);
		expect(surface.unsavedRisk(true)).toBe("Unsaved changes may be lost");
		expect(surface.unsavedRisk(false)).toBeNull();
	});

	it("does not hidden-replay unsaved keystrokes on reconnect", async () => {
		const surface = drafts();
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "On the server",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		const reconnect = await surface.reconnect({
			customFieldValues: {},
			projectId: null,
			title: "Typed while disconnected",
			type: "Task",
		});

		expect(reconnect).toEqual({
			draft: saved.draft,
			lastSuccessfulSaveAt: SAVED_AT,
			queued: false,
			replayed: false,
		});
		expect(surface.writeQueue()).toEqual([]);
		expect(await surface.resume(saved.draft.id)).toEqual(saved.draft);
		expect((await surface.list())[0]?.form.title).toBe("On the server");
	});

	it("Create finalizes once through Work Lifecycle and consumes the Draft", async () => {
		const project = await openPayments();
		const surface = drafts({
			workCreate: async (command) =>
				await finalizeDraft(prisma, {
					actorId,
					idempotencyKey: command.idempotencyKey,
					origin: "human",
					payload: command.payload,
				}),
		});
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Ready to create",
				type: "Research",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}

		const created = await surface.finalize({
			draftId: saved.draft.id,
			form: saved.draft.form,
			idempotencyKey: `finalize-${saved.draft.id}`,
		});

		expect(created).toMatchObject({
			draft: null,
			status: "created",
			work: {
				title: "Ready to create",
				type: "Research",
			},
		});
		if (created.status !== "created") {
			throw new Error("expected created Work");
		}
		expect(created.work.key).toMatch(WORK_KEY_PATTERN);
		expect(await surface.list()).toEqual([]);
		expect(await surface.resume(saved.draft.id)).toBeNull();
		expect(await listWork(prisma, project.id)).toEqual([
			await getWork(prisma, created.work.id),
		]);
	});

	it("refuses a second Create from a consumed Draft and does not mint another Work", async () => {
		const project = await openPayments();
		const surface = drafts({
			workCreate: async (command) =>
				await finalizeDraft(prisma, {
					actorId,
					idempotencyKey: command.idempotencyKey,
					origin: "human",
					payload: command.payload,
				}),
		});
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Only once",
				type: "Task",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}
		const first = await surface.finalize({
			draftId: saved.draft.id,
			form: saved.draft.form,
			idempotencyKey: `first-${saved.draft.id}`,
		});
		const second = await surface.finalize({
			draftId: saved.draft.id,
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Second mint",
				type: "Task",
			},
			idempotencyKey: `second-${saved.draft.id}`,
		});
		const replayed = await surface.finalize({
			draftId: saved.draft.id,
			form: saved.draft.form,
			idempotencyKey: `first-${saved.draft.id}`,
		});

		expect(first.status).toBe("created");
		expect(second).toEqual({ status: "consumed" });
		expect(replayed.status).toBe("created");
		expect(await listWork(prisma, project.id)).toHaveLength(1);
	});

	it("finalizes a Draft once when different keys race", async () => {
		const project = await openPayments();
		const surface = drafts();
		const saved = await surface.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Race once",
				type: "Task",
			},
			idempotencyKey: `save-${crypto.randomUUID()}`,
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}
		const [first, second] = await Promise.all([
			surface.finalize({
				draftId: saved.draft.id,
				form: saved.draft.form,
				idempotencyKey: `finalize-a-${crypto.randomUUID()}`,
			}),
			surface.finalize({
				draftId: saved.draft.id,
				form: saved.draft.form,
				idempotencyKey: `finalize-b-${crypto.randomUUID()}`,
			}),
		]);

		expect([first.status, second.status].sort()).toEqual([
			"consumed",
			"created",
		]);
		expect(await listWork(prisma, project.id)).toHaveLength(1);
	});

	it("refuses offline Create without a queue and keeps the Draft", async () => {
		const project = await openPayments();
		const online = drafts({
			workCreate: async (command) =>
				await finalizeDraft(prisma, {
					actorId,
					idempotencyKey: command.idempotencyKey,
					origin: "human",
					payload: command.payload,
				}),
		});
		const saved = await online.autosave({
			form: {
				customFieldValues: {},
				projectId: project.id,
				title: "Still a Draft",
				type: "Bug",
			},
			idempotencyKey: crypto.randomUUID(),
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved Draft");
		}
		const offline = drafts({ connected: false });
		const refused = await offline.finalize({
			draftId: saved.draft.id,
			form: saved.draft.form,
			idempotencyKey: crypto.randomUUID(),
		});

		expect(refused).toEqual({
			queued: false,
			reason: "offline",
			status: "refused",
		});
		expect(offline.writeQueue()).toEqual([]);
		expect(await online.list()).toHaveLength(1);
		expect(await listWork(prisma, project.id)).toEqual([]);
	});
});
