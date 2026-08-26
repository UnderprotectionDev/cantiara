/**
 * Capture Inbox seam — freeform and mini-template save without a
 * main record, Create Bug hand-off with no Inbox item, surface
 * counterparts, time-advance that does not delete, and online-only
 * last successful save / unsaved risk with no queue. Synthetic
 * fixture for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Yakalama) schema, counterparts, and time-advance.
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	type CaptureInbox,
	createCaptureInbox,
	type WorkCreateCommand,
} from "./capture-inbox";
import { CAPTURE_INBOX_COPY, miniTemplateCatalog } from "./capture-inbox-model";
import {
	createPrismaCaptureStagingStore,
	createRecordingCaptureStagingStore,
} from "./capture-staging-store";
import {
	createRecordBinder,
	TRIAGE_EXIT_CATALOG,
} from "./capture-triage-exits";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const CAPTURED_AT = new Date("2026-08-26T12:00:00.000Z");
const NINETY_DAYS_LATER = new Date("2026-11-24T12:00:00.000Z");
const TEST_STAGING_ROOT_KEY = Buffer.alloc(32, 9);

describe("Capture Inbox catalog", () => {
	it("exposes the closed mini-template catalog with optional English fields", () => {
		expect(miniTemplateCatalog()).toEqual([
			{
				fields: [
					{
						id: "observedBehavior",
						label: "Observed Behavior",
						required: false,
					},
					{
						id: "expectedBehavior",
						label: "Expected Behavior",
						required: false,
					},
					{
						id: "reproductionContext",
						label: "Reproduction Context",
						required: false,
					},
				],
				id: "bug-capture",
				label: "Bug Capture",
			},
			{
				fields: [
					{ id: "feedback", label: "Feedback", required: false },
					{ id: "channel", label: "Channel", required: false },
					{ id: "contact", label: "Contact", required: false },
				],
				id: "feedback-capture",
				label: "Feedback Capture",
			},
			{
				fields: [
					{
						id: "noteOrExcerpt",
						label: "Note or Excerpt",
						required: false,
					},
					{
						id: "sourceContext",
						label: "Source Context",
						required: false,
					},
				],
				id: "research-fragment",
				label: "Research Fragment",
			},
		]);
		expect(CAPTURE_INBOX_COPY.captureInbox).toBe("Capture Inbox");
		expect(CAPTURE_INBOX_COPY.captureAttachment).toBe("Capture attachment");
		expect(CAPTURE_INBOX_COPY.createBug).toBe("Create Bug");
		expect(CAPTURE_INBOX_COPY.workspaceCaptureInbox).toBe(
			"Workspace Capture Inbox"
		);
		expect(CAPTURE_INBOX_COPY.projectCaptureInbox).toBe(
			"Project Capture Inbox"
		);
		expect(CAPTURE_INBOX_COPY.noCapturesInThisInbox).toBe(
			"No captures in this Inbox."
		);
		expect(CAPTURE_INBOX_COPY.createBugNeedsProjectAndBugCapture).toBe(
			"Create Bug is available when Project is set and type is Bug Capture."
		);
		expect(CAPTURE_INBOX_COPY.createBugDoesNotStayInInbox).toBe(
			"Create Bug does not stay in the Capture Inbox. A Work record is not stored yet."
		);
		expect(CAPTURE_INBOX_COPY.leaveEmptyForWorkspaceCaptureInbox).toBe(
			"Leave empty to save to the Workspace Capture Inbox."
		);
		expect(CAPTURE_INBOX_COPY.convert).toBe("Convert");
		expect(CAPTURE_INBOX_COPY.attachToExisting).toBe("Attach to existing");
		expect(CAPTURE_INBOX_COPY.delete).toBe("Delete");
		expect(CAPTURE_INBOX_COPY.bulkSenseMaking).toBe("Bulk sense-making");
		expect(CAPTURE_INBOX_COPY.ungrouped).toBe("Ungrouped");
		expect(CAPTURE_INBOX_COPY.otherProjects).toBe("Other Projects");
		expect(TRIAGE_EXIT_CATALOG).toEqual([
			{ id: "convert", label: "Convert" },
			{ id: "attach", label: "Attach to existing" },
			{ id: "delete", label: "Delete" },
		]);
	});
});

describe("Capture Inbox", () => {
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
		await prisma.captureBulkSenseView.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.captureInboxItem.deleteMany({
			where: { ownerId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function inbox(
		overrides: {
			binder?: ReturnType<typeof createRecordBinder>;
			connected?: boolean;
			convertCreate?: Parameters<typeof createCaptureInbox>[0]["convertCreate"];
			fileAttachmentFinalize?: Parameters<
				typeof createCaptureInbox
			>[0]["fileAttachmentFinalize"];
			prisma?: PrismaClient;
			similarRecords?: Parameters<
				typeof createCaptureInbox
			>[0]["similarRecords"];
			stagingStore?: Parameters<typeof createCaptureInbox>[0]["stagingStore"];
			workCreate?: (command: WorkCreateCommand) => Promise<{
				handedOff: true;
				workKey: null;
			}>;
		} = {}
	): CaptureInbox {
		return createCaptureInbox({
			actorId,
			binder: overrides.binder,
			clock: { now: () => CAPTURED_AT },
			connected: overrides.connected,
			convertCreate: overrides.convertCreate,
			fileAttachmentFinalize: overrides.fileAttachmentFinalize,
			prisma: overrides.prisma ?? prisma,
			similarRecords: overrides.similarRecords,
			stagingRootKey: TEST_STAGING_ROOT_KEY,
			stagingStore: overrides.stagingStore,
			workCreate: overrides.workCreate,
			workspaceId,
		});
	}

	function prismaWithoutBulkSenseView(): PrismaClient {
		return new Proxy(prisma, {
			get(target, prop, receiver) {
				if (prop === "captureBulkSenseView") {
					return;
				}
				const value = Reflect.get(target, prop, receiver) as unknown;
				return typeof value === "function"
					? (value as (...args: never[]) => unknown).bind(target)
					: value;
			},
		}) as PrismaClient;
	}

	it("saves freeform text to the Workspace Capture Inbox without a main record", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "A thought before I know what it is",
		});

		expect(outcome).toEqual({
			item: {
				attachmentRef: null,
				body: "A thought before I know what it is",
				capturedAt: CAPTURED_AT,
				fields: {},
				id: expect.any(String),
				kind: "capture-inbox-item",
				link: "",
				origin: "",
				scope: { kind: "workspace" },
				template: null,
			},
			lastSuccessfulSaveAt: CAPTURED_AT,
			mainRecord: null,
			status: "saved",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([
			outcome.status === "saved" ? outcome.item : undefined,
		]);
	});

	it("formats a Bug Capture with empty fields and does not create a Bug", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			template: "bug-capture",
		});

		expect(outcome).toEqual({
			item: {
				attachmentRef: null,
				body: "",
				capturedAt: CAPTURED_AT,
				fields: {},
				id: expect.any(String),
				kind: "capture-inbox-item",
				link: "",
				origin: "",
				scope: { kind: "workspace" },
				template: "bug-capture",
			},
			lastSuccessfulSaveAt: CAPTURED_AT,
			mainRecord: null,
			status: "saved",
		});
	});

	it("formats filled mini-template fields on the Inbox item only", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			fields: {
				expectedBehavior: "The session starts",
				observedBehavior: "Login button does nothing",
				reproductionContext: "Safari, signed-out",
			},
			idempotencyKey: crypto.randomUUID(),
			template: "bug-capture",
		});

		expect(outcome).toMatchObject({
			item: {
				body: [
					"Observed Behavior",
					"Login button does nothing",
					"",
					"Expected Behavior",
					"The session starts",
					"",
					"Reproduction Context",
					"Safari, signed-out",
				].join("\n"),
				fields: {
					expectedBehavior: "The session starts",
					observedBehavior: "Login button does nothing",
					reproductionContext: "Safari, signed-out",
				},
				kind: "capture-inbox-item",
				template: "bug-capture",
			},
			mainRecord: null,
			status: "saved",
		});
	});

	it("places a capture in the Project Inbox when the Project is known", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			fields: { noteOrExcerpt: "Clip from the interview" },
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			template: "research-fragment",
		});

		expect(outcome).toMatchObject({
			item: {
				body: "Note or Excerpt\nClip from the interview",
				kind: "capture-inbox-item",
				scope: { kind: "project", projectId: "proj-cantiara" },
				template: "research-fragment",
			},
			mainRecord: null,
			status: "saved",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([outcome.status === "saved" ? outcome.item : undefined]);
	});

	it("lists a Project Inbox without requiring the same capital letters", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			fields: { feedback: "Feedback2" },
			idempotencyKey: crypto.randomUUID(),
			projectId: "Feedback",
			template: "feedback-capture",
		});

		expect(
			await capture.list({ kind: "project", projectId: "feedback" })
		).toEqual([outcome.status === "saved" ? outcome.item : undefined]);
	});

	it("lists every Capture Inbox together, Workspace and each Project", async () => {
		const capture = inbox();
		const workspace = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "A thought before I know the Project",
		});
		const project = await capture.save({
			fields: { feedback: "Feedback2" },
			idempotencyKey: crypto.randomUUID(),
			projectId: "Feedback",
			template: "feedback-capture",
		});

		expect(await capture.listAll()).toEqual([
			workspace.status === "saved" ? workspace.item : undefined,
			project.status === "saved" ? project.item : undefined,
		]);
		expect(await capture.list({ kind: "workspace" })).toEqual([
			workspace.status === "saved" ? workspace.item : undefined,
		]);
	});

	it("calls Work create for Create Bug and leaves no Inbox item or Work key", async () => {
		const commands: WorkCreateCommand[] = [];
		const createKey = crypto.randomUUID();
		const capture = inbox({
			workCreate: (command) => {
				commands.push(command);
				return Promise.resolve({ handedOff: true, workKey: null });
			},
		});
		const outcome = await capture.createBug({
			fields: { observedBehavior: "Crash on save" },
			idempotencyKey: createKey,
			projectId: "proj-cantiara",
			text: "Create this Bug now",
		});

		expect(outcome).toEqual({
			inboxItem: null,
			lastSuccessfulSaveAt: CAPTURED_AT,
			status: "handed-off",
			workCreate: { handedOff: true, workKey: null },
		});
		expect(commands).toEqual([
			{
				actorId,
				fields: { observedBehavior: "Crash on save" },
				idempotencyKey: createKey,
				projectId: "proj-cantiara",
				text: "Create this Bug now",
				workType: "bug",
			},
		]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("refuses Create Bug when type is Feedback Capture or Research Fragment", async () => {
		const commands: WorkCreateCommand[] = [];
		const capture = inbox({
			workCreate: (command) => {
				commands.push(command);
				return Promise.resolve({ handedOff: true, workKey: null });
			},
		});

		expect(
			await capture.createBug({
				idempotencyKey: crypto.randomUUID(),
				projectId: "proj-cantiara",
				template: "feedback-capture",
				text: "This is feedback",
			})
		).toEqual({
			reason: CAPTURE_INBOX_COPY.createBugNeedsProjectAndBugCapture,
			status: "unavailable",
		});
		expect(
			await capture.createBug({
				idempotencyKey: crypto.randomUUID(),
				projectId: "proj-cantiara",
				template: "research-fragment",
				text: "A clip",
			})
		).toEqual({
			reason: CAPTURE_INBOX_COPY.createBugNeedsProjectAndBugCapture,
			status: "unavailable",
		});
		expect(commands).toEqual([]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
	});

	it("hands off Create Bug when type is Bug Capture", async () => {
		const commands: WorkCreateCommand[] = [];
		const createKey = crypto.randomUUID();
		const capture = inbox({
			workCreate: (command) => {
				commands.push(command);
				return Promise.resolve({ handedOff: true, workKey: null });
			},
		});
		const outcome = await capture.createBug({
			fields: { observedBehavior: "Crash on save" },
			idempotencyKey: createKey,
			projectId: "proj-cantiara",
			template: "bug-capture",
			text: "Create this Bug now",
		});

		expect(outcome).toEqual({
			inboxItem: null,
			lastSuccessfulSaveAt: CAPTURED_AT,
			status: "handed-off",
			workCreate: { handedOff: true, workKey: null },
		});
		expect(commands).toHaveLength(1);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
	});

	it("keeps a capture out of search, share, publish, export, Backlog, and Draft", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Do not leak this",
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(await capture.surfaces(outcome.item.id)).toEqual({
			backlog: false,
			draft: false,
			export: false,
			mainRecord: false,
			publish: false,
			search: false,
			share: false,
		});
		expect(capture.searchHits()).toEqual([]);
		expect(outcome.item.kind).toBe("capture-inbox-item");
		expect(outcome.mainRecord).toBeNull();
	});

	it("does not delete a pending capture when time advances", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Still here in ninety days",
		});
		capture.advanceTime(NINETY_DAYS_LATER);

		expect(await capture.list({ kind: "workspace" })).toEqual([
			outcome.status === "saved" ? outcome.item : undefined,
		]);
	});

	it("refuses an offline write, keeps last successful save, and never queues", async () => {
		const online = inbox();
		const saved = await online.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Landed",
		});
		const offline = inbox({ connected: false });
		const refused = await offline.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Should not queue",
		});

		expect(saved).toMatchObject({
			lastSuccessfulSaveAt: CAPTURED_AT,
			status: "saved",
		});
		expect(refused).toEqual({
			queued: false,
			reason: "offline",
			status: "refused",
		});
		expect(offline.writeQueue()).toEqual([]);
		expect(offline.unsavedRisk(true)).toBe("Unsaved changes may be lost");
		expect(offline.unsavedRisk(false)).toBeNull();
		expect(await online.list({ kind: "workspace" })).toHaveLength(1);
	});

	it("shows several captures side by side in Bulk sense-making as view metadata", async () => {
		const capture = inbox();
		const first = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Crash on save",
		});
		const second = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Login does nothing",
		});
		if (first.status !== "saved" || second.status !== "saved") {
			throw new Error("expected saved captures");
		}

		expect(await capture.bulkSenseMaking()).toEqual({
			clusters: [],
			items: [first.item, second.item],
			kind: "view-metadata",
			label: CAPTURE_INBOX_COPY.bulkSenseMaking,
			placements: [],
		});
	});

	it("keeps Bulk cluster names and positions as view metadata across sessions", async () => {
		const capture = inbox();
		const first = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Crash on save",
		});
		const second = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Login does nothing",
		});
		if (first.status !== "saved" || second.status !== "saved") {
			throw new Error("expected saved captures");
		}

		const named = await capture.nameBulkCluster({
			idempotencyKey: crypto.randomUUID(),
			name: "Login bugs",
		});
		expect(named).toEqual({
			cluster: {
				id: expect.any(String),
				kind: "view-metadata",
				name: "Login bugs",
			},
			status: "named",
		});
		if (named.status !== "named") {
			throw new Error("expected a named cluster");
		}

		expect(
			await capture.placeInBulk({
				clusterId: named.cluster.id,
				idempotencyKey: crypto.randomUUID(),
				itemId: first.item.id,
				position: { x: 0, y: 0 },
			})
		).toEqual({
			placement: {
				clusterId: named.cluster.id,
				itemId: first.item.id,
				position: { x: 0, y: 0 },
			},
			status: "placed",
		});
		expect(
			await capture.placeInBulk({
				clusterId: named.cluster.id,
				idempotencyKey: crypto.randomUUID(),
				itemId: second.item.id,
				position: { x: 1, y: 0 },
			})
		).toEqual({
			placement: {
				clusterId: named.cluster.id,
				itemId: second.item.id,
				position: { x: 1, y: 0 },
			},
			status: "placed",
		});

		const later = inbox();
		expect(await later.bulkSenseMaking()).toEqual({
			clusters: [
				{
					id: named.cluster.id,
					kind: "view-metadata",
					name: "Login bugs",
				},
			],
			items: [first.item, second.item],
			kind: "view-metadata",
			label: CAPTURE_INBOX_COPY.bulkSenseMaking,
			placements: [
				{
					clusterId: named.cluster.id,
					itemId: first.item.id,
					position: { x: 0, y: 0 },
				},
				{
					clusterId: named.cluster.id,
					itemId: second.item.id,
					position: { x: 1, y: 0 },
				},
			],
		});
	});

	it("keeps Bulk cluster names when the product Prisma client was generated before CaptureBulkSenseView", async () => {
		const stale = prismaWithoutBulkSenseView();
		expect(stale.captureBulkSenseView).toBeUndefined();
		const capture = inbox({ prisma: stale });
		const saved = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		const named = await capture.nameBulkCluster({
			idempotencyKey: crypto.randomUUID(),
			name: "Login bugs",
		});
		expect(named).toEqual({
			cluster: {
				id: expect.any(String),
				kind: "view-metadata",
				name: "Login bugs",
			},
			status: "named",
		});
		if (named.status !== "named") {
			throw new Error("expected a named cluster");
		}
		expect(
			await capture.placeInBulk({
				clusterId: named.cluster.id,
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				position: { x: 0, y: 0 },
			})
		).toEqual({
			placement: {
				clusterId: named.cluster.id,
				itemId: saved.item.id,
				position: { x: 0, y: 0 },
			},
			status: "placed",
		});

		const later = inbox({ prisma: stale });
		expect(await later.bulkSenseMaking()).toEqual({
			clusters: [
				{
					id: named.cluster.id,
					kind: "view-metadata",
					name: "Login bugs",
				},
			],
			items: [saved.item],
			kind: "view-metadata",
			label: CAPTURE_INBOX_COPY.bulkSenseMaking,
			placements: [
				{
					clusterId: named.cluster.id,
					itemId: saved.item.id,
					position: { x: 0, y: 0 },
				},
			],
		});
	});

	it("keeps Bulk cluster metadata out of search, planning, sharing, publishing, and export", async () => {
		const capture = inbox();
		const saved = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}
		const named = await capture.nameBulkCluster({
			idempotencyKey: crypto.randomUUID(),
			name: "Login bugs",
		});
		if (named.status !== "named") {
			throw new Error("expected a named cluster");
		}
		await capture.placeInBulk({
			clusterId: named.cluster.id,
			idempotencyKey: crypto.randomUUID(),
			itemId: saved.item.id,
			position: { x: 0, y: 0 },
		});

		expect(capture.bulkSurfaces()).toEqual({
			export: false,
			mainRecord: false,
			planning: false,
			publish: false,
			relation: false,
			search: false,
			share: false,
			tag: false,
		});
		expect(capture.searchHits()).toEqual([]);
		const view = await capture.bulkSenseMaking();
		expect(view.kind).toBe("view-metadata");
		expect(view.clusters).toEqual([
			{
				id: named.cluster.id,
				kind: "view-metadata",
				name: "Login bugs",
			},
		]);
		expect(await capture.surfaces(saved.item.id)).toEqual({
			backlog: false,
			draft: false,
			export: false,
			mainRecord: false,
			publish: false,
			search: false,
			share: false,
		});
	});

	it("removes Bulk layout when an item exits and still consumes through the three exits", async () => {
		const binder = createRecordBinder([
			{
				fields: { notes: "existing notes" },
				id: "work-1",
				projectId: "proj-cantiara",
				projectName: "Cantiara",
				title: "Login crash",
			},
		]);
		const capture = inbox({
			binder,
			convertCreate: (command) =>
				Promise.resolve({
					handedOff: true,
					recordId: null,
					targetKind: command.targetKind,
				}),
		});
		const toDelete = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Throw this away",
		});
		const toConvert = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Crash on save",
		});
		const toAttach = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Login does nothing",
		});
		if (
			toDelete.status !== "saved" ||
			toConvert.status !== "saved" ||
			toAttach.status !== "saved"
		) {
			throw new Error("expected saved captures");
		}
		const named = await capture.nameBulkCluster({
			idempotencyKey: crypto.randomUUID(),
			name: "Login bugs",
		});
		if (named.status !== "named") {
			throw new Error("expected a named cluster");
		}
		await capture.placeInBulk({
			clusterId: named.cluster.id,
			idempotencyKey: crypto.randomUUID(),
			itemId: toDelete.item.id,
			position: { x: 0, y: 0 },
		});
		await capture.placeInBulk({
			clusterId: named.cluster.id,
			idempotencyKey: crypto.randomUUID(),
			itemId: toConvert.item.id,
			position: { x: 1, y: 0 },
		});
		await capture.placeInBulk({
			clusterId: named.cluster.id,
			idempotencyKey: crypto.randomUUID(),
			itemId: toAttach.item.id,
			position: { x: 2, y: 0 },
		});

		expect(
			await capture.deleteItem({
				idempotencyKey: crypto.randomUUID(),
				itemId: toDelete.item.id,
			})
		).toEqual({
			exit: "delete",
			inboxItem: null,
			status: "consumed",
		});
		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: toConvert.item.id,
				previewed: true,
				targetKind: "work",
			})
		).toMatchObject({
			exit: "convert",
			inboxItem: null,
			status: "consumed",
		});
		const attached = await capture.attach({
			idempotencyKey: crypto.randomUUID(),
			itemId: toAttach.item.id,
			previewed: true,
			relation: "origin",
			targetId: "work-1",
		});
		expect(attached).toMatchObject({
			exit: "attach",
			inboxItem: null,
			status: "consumed",
		});
		expect(await capture.bulkSenseMaking()).toEqual({
			clusters: [],
			items: [],
			kind: "view-metadata",
			label: CAPTURE_INBOX_COPY.bulkSenseMaking,
			placements: [],
		});
		expect(capture.triageExits()).toEqual(["convert", "attach", "delete"]);

		if (attached.status !== "consumed") {
			throw new Error("expected attach to consume");
		}
		const undone = await capture.undoMerge({
			idempotencyKey: crypto.randomUUID(),
			mergeId: attached.mergeId,
		});
		expect(undone).toEqual({
			inboxItem: toAttach.item,
			status: "restored",
		});
		expect(await capture.bulkSenseMaking()).toEqual({
			clusters: [],
			items: [toAttach.item],
			kind: "view-metadata",
			label: CAPTURE_INBOX_COPY.bulkSenseMaking,
			placements: [],
		});
	}, 20_000);

	it("exposes exactly three triage exits and does not treat Create Bug as one", async () => {
		const capture = inbox();
		expect(capture.triageExits()).toEqual(["convert", "attach", "delete"]);
		const created = await capture.createBug({
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Direct Bug",
		});
		expect(created.status).toBe("handed-off");
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
	});

	it("deletes an Inbox item so it is no longer listed", async () => {
		const capture = inbox();
		const saved = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Throw this away",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.deleteItem({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
			})
		).toEqual({
			exit: "delete",
			inboxItem: null,
			status: "consumed",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("does not consume a capture when Convert is previewed or similar records are listed", async () => {
		const commands: Array<{ targetKind: string }> = [];
		const capture = inbox({
			convertCreate: (command) => {
				commands.push({ targetKind: command.targetKind });
				return Promise.resolve({
					handedOff: true,
					recordId: null,
					targetKind: command.targetKind,
				});
			},
			similarRecords: () => [
				{
					basis: { excerpt: "Login crash", kind: "title" },
					id: "work-1",
					projectId: "proj-cantiara",
					projectName: "Cantiara",
					title: "Login crash",
				},
			],
		});
		const saved = await capture.save({
			fields: { observedBehavior: "Login button does nothing" },
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			template: "bug-capture",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.previewConvert({
				itemId: saved.item.id,
				targetKind: "work",
			})
		).toEqual({
			fieldMappings: [
				{
					sourceField: "Observed Behavior",
					targetField: "Observed Behavior",
					value: "Login button does nothing",
				},
			],
			original: {
				capturedAt: CAPTURED_AT,
				link: "",
				origin: "",
				screenshot: null,
				text: "Observed Behavior\nLogin button does nothing",
			},
			proposed: {
				body: "Observed Behavior\nLogin button does nothing",
				kind: "work",
				label: "Work",
				link: "",
				screenshot: null,
				targetScope: {
					heading: "Project Capture Inbox",
					kind: "project",
					projectId: "proj-cantiara",
				},
			},
		});
		expect(await capture.suggestSimilar({ itemId: saved.item.id })).toEqual({
			otherProjects: { heading: "Other Projects", matches: [] },
			primary: [
				{
					basis: { excerpt: "Login crash", kind: "title" },
					id: "work-1",
					projectId: "proj-cantiara",
					projectName: "Cantiara",
					title: "Login crash",
				},
			],
		});
		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				previewed: false,
				targetKind: "work",
			})
		).toEqual({
			preview: {
				fieldMappings: [
					{
						sourceField: "Observed Behavior",
						targetField: "Observed Behavior",
						value: "Login button does nothing",
					},
				],
				original: {
					capturedAt: CAPTURED_AT,
					link: "",
					origin: "",
					screenshot: null,
					text: "Observed Behavior\nLogin button does nothing",
				},
				proposed: {
					body: "Observed Behavior\nLogin button does nothing",
					kind: "work",
					label: "Work",
					link: "",
					screenshot: null,
					targetScope: {
						heading: "Project Capture Inbox",
						kind: "project",
						projectId: "proj-cantiara",
					},
				},
			},
			status: "needs-preview",
		});
		expect(commands).toEqual([]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([saved.item]);
	});

	it("converts one Inbox item into a single handed-off record and preserves origin", async () => {
		const commands: Array<{
			origin: string;
			targetKind: string;
			text: string;
		}> = [];
		const capture = inbox({
			convertCreate: (command) => {
				commands.push({
					origin: command.item.origin,
					targetKind: command.targetKind,
					text: command.item.body,
				});
				return Promise.resolve({
					handedOff: true,
					recordId: null,
					targetKind: command.targetKind,
				});
			},
		});
		const saved = await capture.save({
			attachmentRef: "staging-shot",
			idempotencyKey: crypto.randomUUID(),
			link: "https://example.com/bug",
			origin: "https://example.com/bug",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				previewed: true,
				targetKind: "document",
			})
		).toEqual({
			exit: "convert",
			inboxItem: null,
			mainRecord: null,
			recordCreate: {
				handedOff: true,
				recordId: null,
				targetKind: "document",
			},
			status: "consumed",
			visibleAttachment: null,
		});
		expect(commands).toEqual([
			{
				origin: "https://example.com/bug",
				targetKind: "document",
				text: "Crash on save",
			},
		]);
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
	});

	it("groups same-Project similar matches first and names other Projects", async () => {
		const capture = inbox({
			similarRecords: () => [
				{
					basis: { excerpt: "Login crash", kind: "title" },
					id: "work-local",
					projectId: "proj-cantiara",
					projectName: "Cantiara",
					title: "Login crash",
				},
				{
					basis: {
						excerpt: "Login button does nothing",
						kind: "text",
					},
					id: "work-other",
					projectId: "proj-other",
					projectName: "Other App",
					title: "Same crash elsewhere",
				},
			],
		});
		const saved = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Login button does nothing",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(await capture.suggestSimilar({ itemId: saved.item.id })).toEqual({
			otherProjects: {
				heading: "Other Projects",
				matches: [
					{
						basis: {
							excerpt: "Login button does nothing",
							kind: "text",
						},
						id: "work-other",
						projectId: "proj-other",
						projectName: "Other App",
						title: "Same crash elsewhere",
					},
				],
			},
			primary: [
				{
					basis: { excerpt: "Login crash", kind: "title" },
					id: "work-local",
					projectId: "proj-cantiara",
					projectName: "Cantiara",
					title: "Login crash",
				},
			],
		});
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([saved.item]);
	});

	it("does not attach without a target and relation preview", async () => {
		const binder = createRecordBinder([
			{
				fields: { notes: "existing notes" },
				id: "work-other",
				projectId: "proj-other",
				projectName: "Other App",
				title: "Same crash elsewhere",
			},
		]);
		const capture = inbox({ binder });
		const saved = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		const preview = await capture.previewAttach({
			itemId: saved.item.id,
			relation: "origin",
			targetId: "work-other",
		});
		expect(preview).toEqual({
			crossProject: true,
			item: saved.item,
			relation: "origin",
			target: {
				id: "work-other",
				projectId: "proj-other",
				projectName: "Other App",
				title: "Same crash elsewhere",
			},
		});
		expect(
			await capture.attach({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				previewed: false,
				relation: "origin",
				targetId: "work-other",
			})
		).toEqual({
			preview,
			status: "needs-preview",
		});
		expect(binder.get("work-other")?.binds).toEqual([]);
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([saved.item]);
	});

	it("attaches a capture as origin after preview and preserves origin fields", async () => {
		const binder = createRecordBinder([
			{
				fields: { notes: "existing notes" },
				id: "work-1",
				projectId: "proj-cantiara",
				projectName: "Cantiara",
				title: "Login crash",
			},
		]);
		const capture = inbox({ binder });
		const saved = await capture.save({
			attachmentRef: "staging-shot",
			idempotencyKey: crypto.randomUUID(),
			link: "https://example.com/bug",
			origin: "https://example.com/bug",
			projectId: "proj-cantiara",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		const attached = await capture.attach({
			idempotencyKey: crypto.randomUUID(),
			itemId: saved.item.id,
			previewed: true,
			relation: "origin",
			targetId: "work-1",
		});
		expect(attached).toEqual({
			bind: {
				fields: {
					originAttachment: "staging-shot",
					originCapturedAt: CAPTURED_AT.toISOString(),
					originLink: "https://example.com/bug",
					originMessage: "Crash on save",
					originSource: "https://example.com/bug",
				},
				relation: "origin",
				targetId: "work-1",
			},
			exit: "attach",
			inboxItem: null,
			mergeId: expect.any(String),
			status: "consumed",
		});
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
		const target = binder.get("work-1");
		if (!target) {
			throw new Error("expected bound record");
		}
		expect(target.fields.notes).toBe("existing notes");
		expect(target.fields.originMessage).toBe("Crash on save");
	});

	it("undoes a merge by restoring Inbox fields and keeping later unrelated target edits", async () => {
		const binder = createRecordBinder([
			{
				fields: { notes: "existing notes" },
				id: "work-1",
				projectId: "proj-cantiara",
				projectName: "Cantiara",
				title: "Login crash",
			},
		]);
		const capture = inbox({ binder });
		const saved = await capture.save({
			attachmentRef: "staging-shot",
			idempotencyKey: crypto.randomUUID(),
			link: "https://example.com/bug",
			origin: "https://example.com/bug",
			projectId: "proj-cantiara",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}
		const attached = await capture.attach({
			idempotencyKey: crypto.randomUUID(),
			itemId: saved.item.id,
			previewed: true,
			relation: "evidence",
			targetId: "work-1",
		});
		if (attached.status !== "consumed") {
			throw new Error("expected attach to consume");
		}
		binder.editField("work-1", "notes", "later unrelated edit");

		expect(
			await capture.previewUndoMerge({ mergeId: attached.mergeId })
		).toEqual({
			bindsToRemove: [
				{
					fields: {
						originAttachment: "staging-shot",
						originCapturedAt: CAPTURED_AT.toISOString(),
						originLink: "https://example.com/bug",
						originMessage: "Crash on save",
						originSource: "https://example.com/bug",
					},
					relation: "evidence",
					targetId: "work-1",
				},
			],
			mergeId: attached.mergeId,
			restoredItem: saved.item,
		});

		const undone = await capture.undoMerge({
			idempotencyKey: crypto.randomUUID(),
			mergeId: attached.mergeId,
		});
		expect(undone).toEqual({
			inboxItem: saved.item,
			status: "restored",
		});
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([saved.item]);
		expect(binder.get("work-1")).toEqual({
			binds: [],
			fields: { notes: "later unrelated edit" },
			id: "work-1",
			projectId: "proj-cantiara",
			projectName: "Cantiara",
			title: "Login crash",
		});
	});

	const SHOT_BYTES = new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
	]);
	const SHOT_ATTACHMENT = {
		bytes: SHOT_BYTES,
		contentType: "image/png",
		filename: "shot.png",
	};

	it("keeps an encrypted Capture attachment on the Inbox item, not a File Attachment or shared library", async () => {
		const puts: Uint8Array[] = [];
		const capture = inbox({
			stagingStore: createRecordingCaptureStagingStore(
				createPrismaCaptureStagingStore(prisma),
				puts
			),
		});
		const outcome = await capture.save({
			attachment: SHOT_ATTACHMENT,
			idempotencyKey: crypto.randomUUID(),
			text: "Screenshot of the crash",
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(outcome.item.attachment).toEqual({
			filename: "shot.png",
			itemId: outcome.item.id,
			kind: "capture-attachment",
		});
		expect(outcome.item.kind).toBe("capture-inbox-item");
		expect(outcome.mainRecord).toBeNull();
		expect(await capture.attachment(outcome.item.id)).toEqual({
			filename: "shot.png",
			itemId: outcome.item.id,
			kind: "capture-attachment",
		});
		expect(await capture.surfaces(outcome.item.id)).toEqual({
			backlog: false,
			draft: false,
			export: false,
			mainRecord: false,
			publish: false,
			search: false,
			share: false,
		});
		expect(capture.searchHits()).toEqual([]);
		expect(capture.exportRows()).toEqual([]);
		expect(capture.sharedMediaLibrary()).toEqual([]);
		expect(capture.visibleFileAttachments()).toEqual([]);
		expect(puts).toHaveLength(1);
		expect(Buffer.from(puts[0] ?? []).equals(Buffer.from(SHOT_BYTES))).toBe(
			false
		);
	});

	it("shows the convert target scope and leaves File Attachment finalize to that feature", async () => {
		const promotions: Array<{ filename: string; targetScopeKind: string }> = [];
		const capture = inbox({
			fileAttachmentFinalize: (command) => {
				promotions.push({
					filename: command.staging.filename,
					targetScopeKind: command.targetScope.kind,
				});
				return Promise.resolve({
					fileAttachmentId: null,
					status: "promoted",
					visibleAttachment: null,
				});
			},
		});
		const saved = await capture.save({
			attachment: SHOT_ATTACHMENT,
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.previewConvert({
				itemId: saved.item.id,
				targetKind: "work",
			})
		).toMatchObject({
			proposed: {
				kind: "work",
				label: "Work",
				targetScope: {
					heading: "Project Capture Inbox",
					kind: "project",
					projectId: "proj-cantiara",
				},
			},
		});
		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				previewed: true,
				targetKind: "work",
			})
		).toEqual({
			exit: "convert",
			inboxItem: null,
			mainRecord: null,
			recordCreate: {
				handedOff: true,
				recordId: null,
				targetKind: "work",
			},
			status: "consumed",
			visibleAttachment: null,
		});
		expect(promotions).toEqual([
			{ filename: "shot.png", targetScopeKind: "project" },
		]);
		expect(capture.visibleFileAttachments()).toEqual([]);
		expect(await capture.attachment(saved.item.id)).toBeNull();
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([]);
	});

	it("leaves no visible File Attachment and keeps the Inbox item when finalize fails", async () => {
		const capture = inbox({
			fileAttachmentFinalize: () =>
				Promise.resolve({
					status: "failed",
					visibleAttachment: null,
				}),
		});
		const saved = await capture.save({
			attachment: SHOT_ATTACHMENT,
			idempotencyKey: crypto.randomUUID(),
			projectId: "proj-cantiara",
			text: "Crash on save",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
				previewed: true,
				targetKind: "work",
			})
		).toEqual({
			inboxItem: saved.item,
			status: "finalize-failed",
			visibleAttachment: null,
		});
		expect(
			await capture.list({ kind: "project", projectId: "proj-cantiara" })
		).toEqual([saved.item]);
		expect(await capture.attachment(saved.item.id)).toEqual({
			filename: "shot.png",
			itemId: saved.item.id,
			kind: "capture-attachment",
		});
		expect(capture.visibleFileAttachments()).toEqual([]);
		expect(capture.sharedMediaLibrary()).toEqual([]);
	});

	it("deletes the Capture attachment when the Inbox item is deleted", async () => {
		const capture = inbox();
		const saved = await capture.save({
			attachment: SHOT_ATTACHMENT,
			idempotencyKey: crypto.randomUUID(),
			text: "Throw this away",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.deleteItem({
				idempotencyKey: crypto.randomUUID(),
				itemId: saved.item.id,
			})
		).toEqual({
			exit: "delete",
			inboxItem: null,
			status: "consumed",
		});
		expect(await capture.list({ kind: "workspace" })).toEqual([]);
		expect(await capture.attachment(saved.item.id)).toBeNull();
		expect(capture.sharedMediaLibrary()).toEqual([]);
		expect(capture.visibleFileAttachments()).toEqual([]);
	});

	it("shows Workspace Capture Inbox as the convert target scope when Project is empty", async () => {
		const capture = inbox();
		const saved = await capture.save({
			attachment: SHOT_ATTACHMENT,
			idempotencyKey: crypto.randomUUID(),
			text: "A thought before I know the Project",
		});
		if (saved.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(
			await capture.previewConvert({
				itemId: saved.item.id,
				targetKind: "document",
			})
		).toMatchObject({
			proposed: {
				kind: "document",
				label: "Document",
				targetScope: {
					heading: "Workspace Capture Inbox",
					kind: "workspace",
					projectId: null,
				},
			},
		});
	});

	async function saveOrderedCaptures(capture: CaptureInbox) {
		const first = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "First thought",
		});
		capture.advanceTime(new Date("2026-08-26T12:00:01.000Z"));
		const second = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Second thought",
		});
		capture.advanceTime(new Date("2026-08-26T12:00:02.000Z"));
		const third = await capture.save({
			idempotencyKey: crypto.randomUUID(),
			text: "Third thought",
		});
		if (
			first.status !== "saved" ||
			second.status !== "saved" ||
			third.status !== "saved"
		) {
			throw new Error("expected saved captures");
		}
		return {
			first: first.item,
			second: second.item,
			third: third.item,
		};
	}

	it("starts Sequential triage on one item and is not a new queue", async () => {
		const capture = inbox();
		const items = await saveOrderedCaptures(capture);

		expect(await capture.sequentialTriage()).toEqual({
			focused: null,
			mode: "list",
			previousAvailable: false,
		});
		expect(await capture.startSequentialTriage()).toEqual({
			focused: items.first,
			mode: "sequential",
			previousAvailable: false,
		});
		expect(await capture.listAll()).toEqual([
			items.first,
			items.second,
			items.third,
		]);
		expect(capture.writeQueue()).toEqual([]);
	});

	it("does not advance Sequential triage on view, Convert field change, or dismissing a suggestion", async () => {
		const capture = inbox({
			similarRecords: () => [
				{
					basis: { excerpt: "First thought", kind: "text" },
					id: "work-1",
					projectId: "proj-cantiara",
					projectName: "Cantiara",
					title: "Nearby work",
				},
			],
		});
		const items = await saveOrderedCaptures(capture);
		await capture.startSequentialTriage();

		expect(
			await capture.previewConvert({
				itemId: items.first.id,
				targetKind: "work",
			})
		).toMatchObject({ proposed: { kind: "work" } });
		expect(
			await capture.previewConvert({
				itemId: items.first.id,
				targetKind: "document",
			})
		).toMatchObject({ proposed: { kind: "document" } });
		const suggestions = await capture.suggestSimilar({
			itemId: items.first.id,
		});
		expect(suggestions).toMatchObject({
			otherProjects: {
				matches: [{ id: "work-1" }],
			},
		});
		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: items.first.id,
				previewed: false,
				targetKind: "work",
			})
		).toMatchObject({ status: "needs-preview" });
		expect(await capture.sequentialTriage()).toEqual({
			focused: items.first,
			mode: "sequential",
			previousAvailable: false,
		});
		expect(await capture.listAll()).toHaveLength(3);
	});

	it("advances Sequential triage only after Convert, Attach, or Delete", async () => {
		const binder = createRecordBinder([
			{
				fields: {},
				id: "work-1",
				projectId: "proj-cantiara",
				projectName: "Cantiara",
				title: "Login crash",
			},
		]);
		const capture = inbox({ binder });
		const items = await saveOrderedCaptures(capture);
		await capture.startSequentialTriage();

		expect(
			await capture.deleteItem({
				idempotencyKey: crypto.randomUUID(),
				itemId: items.first.id,
			})
		).toMatchObject({ status: "consumed" });
		expect(await capture.sequentialTriage()).toEqual({
			focused: items.second,
			mode: "sequential",
			previousAvailable: false,
		});

		expect(
			await capture.convert({
				idempotencyKey: crypto.randomUUID(),
				itemId: items.second.id,
				previewed: true,
				targetKind: "work",
			})
		).toMatchObject({ status: "consumed" });
		expect(await capture.sequentialTriage()).toEqual({
			focused: items.third,
			mode: "sequential",
			previousAvailable: false,
		});

		expect(
			await capture.attach({
				idempotencyKey: crypto.randomUUID(),
				itemId: items.third.id,
				previewed: true,
				relation: "origin",
				targetId: "work-1",
			})
		).toMatchObject({ status: "consumed" });
		expect(await capture.sequentialTriage()).toEqual({
			focused: null,
			mode: "list",
			previousAvailable: false,
		});
		expect(await capture.listAll()).toEqual([]);
	});

	it("goes back to the previous remaining item and exits Sequential triage to the list", async () => {
		const capture = inbox();
		const items = await saveOrderedCaptures(capture);

		expect(
			await capture.startSequentialTriage({ itemId: items.third.id })
		).toEqual({
			focused: items.third,
			mode: "sequential",
			previousAvailable: true,
		});
		expect(await capture.goBackSequentialTriage()).toEqual({
			focused: items.second,
			mode: "sequential",
			previousAvailable: true,
		});
		expect(await capture.goBackSequentialTriage()).toEqual({
			focused: items.first,
			mode: "sequential",
			previousAvailable: false,
		});
		expect(await capture.goBackSequentialTriage()).toEqual({
			focused: items.first,
			mode: "sequential",
			previousAvailable: false,
		});
		expect(await capture.exitSequentialTriage()).toEqual({
			focused: null,
			mode: "list",
			previousAvailable: false,
		});
		expect(await capture.listAll()).toEqual([
			items.first,
			items.second,
			items.third,
		]);
	});

	it("does not auto-resolve Sequential triage when time advances", async () => {
		const capture = inbox();
		const items = await saveOrderedCaptures(capture);
		await capture.startSequentialTriage();
		capture.advanceTime(NINETY_DAYS_LATER);

		expect(await capture.sequentialTriage()).toEqual({
			focused: items.first,
			mode: "sequential",
			previousAvailable: false,
		});
		expect(await capture.listAll()).toHaveLength(3);
		expect(capture.writeQueue()).toEqual([]);
	});
});
