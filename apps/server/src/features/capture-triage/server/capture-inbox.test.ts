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
	CAPTURE_INBOX_COPY,
	CAPTURE_SURFACE_EXCLUSION,
	type CaptureInbox,
	createCaptureInbox,
	miniTemplateCatalog,
	type WorkCreateCommand,
} from "./capture-inbox";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const CAPTURED_AT = new Date("2026-08-26T12:00:00.000Z");
const NINETY_DAYS_LATER = new Date("2026-11-24T12:00:00.000Z");
const ACTOR_ID = "founder-1";

describe("Capture Inbox", () => {
	let prisma: PrismaClient;
	let pool: Pool;
	let workspaceId: string;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.captureWriteReceipt.deleteMany();
		await prisma.captureInboxItem.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
		const user = await prisma.user.create({
			data: {
				email: "founder@example.com",
				emailVerified: true,
				id: ACTOR_ID,
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
		await prisma.$disconnect();
		await pool.end();
	});

	function inbox(
		overrides: {
			connected?: boolean;
			workCreate?: (command: WorkCreateCommand) => Promise<{
				handedOff: true;
				workKey: null;
			}>;
		} = {}
	): CaptureInbox {
		return createCaptureInbox({
			actorId: ACTOR_ID,
			clock: { now: () => CAPTURED_AT },
			connected: overrides.connected,
			prisma,
			workCreate: overrides.workCreate,
			workspaceId,
		});
	}

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
		expect(CAPTURE_INBOX_COPY.createBug).toBe("Create Bug");
	});

	it("saves freeform text to the Workspace Capture Inbox without a main record", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: "freeform-1",
			text: "A thought before I know what it is",
		});

		expect(outcome).toEqual({
			item: {
				body: "A thought before I know what it is",
				capturedAt: CAPTURED_AT,
				fields: {},
				id: expect.any(String),
				kind: "capture-inbox-item",
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
			idempotencyKey: "bug-empty",
			template: "bug-capture",
		});

		expect(outcome).toEqual({
			item: {
				body: "",
				capturedAt: CAPTURED_AT,
				fields: {},
				id: expect.any(String),
				kind: "capture-inbox-item",
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
			idempotencyKey: "bug-filled",
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
			idempotencyKey: "project-note",
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

	it("calls Work create for Create Bug and leaves no Inbox item or Work key", async () => {
		const commands: WorkCreateCommand[] = [];
		const capture = inbox({
			workCreate: (command) => {
				commands.push(command);
				return Promise.resolve({ handedOff: true, workKey: null });
			},
		});
		const outcome = await capture.createBug({
			fields: { observedBehavior: "Crash on save" },
			idempotencyKey: "create-bug-1",
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
				actorId: ACTOR_ID,
				fields: { observedBehavior: "Crash on save" },
				idempotencyKey: "create-bug-1",
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

	it("keeps a capture out of search, share, publish, export, Backlog, Draft, and bookmark", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: "surfaces-1",
			text: "Do not leak this",
		});
		if (outcome.status !== "saved") {
			throw new Error("expected a saved capture");
		}

		expect(await capture.surfaces(outcome.item.id)).toEqual(
			CAPTURE_SURFACE_EXCLUSION
		);
		expect(capture.searchHits()).toEqual([]);
		expect(outcome.item.kind).toBe("capture-inbox-item");
		expect(outcome.mainRecord).toBeNull();
	});

	it("does not delete a pending capture when time advances", async () => {
		const capture = inbox();
		const outcome = await capture.save({
			idempotencyKey: "linger-1",
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
			idempotencyKey: "online-1",
			text: "Landed",
		});
		const offline = inbox({ connected: false });
		const refused = await offline.save({
			idempotencyKey: "offline-1",
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
});
