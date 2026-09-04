/**
 * Smart Collections seam — period-deduped `smart-collection-entry`
 * production with a condition fixture and a signal-sink double.
 * Display belongs to 71; this ticket only produces the registered
 * Information flow identity. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki: subscription production; Dikkat sinyalleri display).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	changeWorkStatus,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { INFORMATION_FLOW_SIGNAL_IDS } from "../../workspace-overview/server/workspace-overview";
import {
	createSmartCollection,
	subscribeSmartCollection,
	viewSmartCollection,
} from "./smart-collections";
import {
	type CollectionRecord,
	type MembershipCondition,
	type MembershipMember,
	SMART_COLLECTIONS_COPY,
	smartCollectionsCatalog,
} from "./smart-collections-model";
import {
	asRegisteredCollectionSignal,
	MemorySignalSink,
	produceSubscriptionSignals,
	SMART_COLLECTION_ENTRY_SIGNAL_ID,
	SMART_COLLECTION_ENTRY_SIGNAL_SECTION,
	seedOpenMembershipPeriods,
} from "./smart-collections-subscription";

const STATUS_IN_PROGRESS: MembershipCondition = {
	field: "status",
	operator: "equals",
	value: "In Progress",
};

function workRecord(
	partial: Partial<CollectionRecord> & Pick<CollectionRecord, "id" | "title">
): CollectionRecord {
	return {
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: "project-atlas",
		status: "Not Started",
		tagIds: [],
		type: "Task",
		...partial,
	};
}

function memberFrom(
	record: CollectionRecord,
	becauseLabel: string
): MembershipMember {
	return {
		because: [{ field: "status", label: becauseLabel }],
		id: record.id,
		kind: record.kind,
		projectId: record.projectId,
		title: record.title,
	};
}

describe("Smart Collections subscription catalog", () => {
	it("uses Subscribe copy, registered Information flow identity, and no email digest", () => {
		const catalog = smartCollectionsCatalog();
		expect(catalog.copy.subscribe).toBe("Subscribe");
		expect(catalog.copy.notifyOnLeave).toBe("Notify on leave");
		expect(catalog.copy.turnOnSubscribeFirst).toBe("Turn on Subscribe first.");
		expect(SMART_COLLECTIONS_COPY.subscribe).toBe("Subscribe");
		expect(catalog.counterparts.emailDigest).toBe(false);
		expect(catalog.counterparts.notificationCenterShell).toBe(false);
		expect(INFORMATION_FLOW_SIGNAL_IDS).toContain(
			SMART_COLLECTION_ENTRY_SIGNAL_ID
		);
		expect(SMART_COLLECTION_ENTRY_SIGNAL_ID).toBe("smart-collection-entry");
		expect(SMART_COLLECTION_ENTRY_SIGNAL_SECTION).toBe("Information flow");
	});

	it("refuses an unregistered signal kind instead of minting a new identity", () => {
		expect(asRegisteredCollectionSignal("collection-left")).toEqual({
			reason: "unregistered-kind",
			status: "refused",
		});
		expect(asRegisteredCollectionSignal("smart-collection-exit")).toEqual({
			reason: "unregistered-kind",
			status: "refused",
		});
		expect(
			asRegisteredCollectionSignal(SMART_COLLECTION_ENTRY_SIGNAL_ID)
		).toEqual({
			section: SMART_COLLECTION_ENTRY_SIGNAL_SECTION,
			signalId: SMART_COLLECTION_ENTRY_SIGNAL_ID,
			status: "ok",
		});
	});
});

describe("Smart Collections period-deduped subscription signal", () => {
	it("emits exactly one smart-collection-entry on first entry; flapping the same period does not multiply", () => {
		const login = workRecord({
			id: "work-login",
			status: "In Progress",
			title: "Ship login",
		});
		const member = memberFrom(login, "Status is In Progress");
		const sink = new MemorySignalSink();

		const first = produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: [],
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		expect(first.status).toBe("ok");
		expect(sink.emissions).toEqual([
			{
				parenting: false,
				phase: "enter",
				reason: "Status is In Progress",
				section: "Information flow",
				signalId: "smart-collection-entry",
				source: { id: "work-login", kind: RECORD_DISCOVERY_COPY.work },
				sourceFieldWrites: false,
			},
		]);
		const { periods } = first;

		const flap = produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods,
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		expect(sink.emissions).toHaveLength(1);
		expect(flap.periods).toEqual(periods);
	});

	it("does not emit a leave signal when exit opt-in is off", () => {
		const login = workRecord({
			id: "work-login",
			status: "In Progress",
			title: "Ship login",
		});
		const member = memberFrom(login, "Status is In Progress");
		const sink = new MemorySignalSink();
		const entered = produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: [],
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		const left = workRecord({
			id: "work-login",
			status: "Not Started",
			title: "Ship login",
		});
		produceSubscriptionSignals({
			catalog: [left],
			conditions: [STATUS_IN_PROGRESS],
			members: [],
			periods: entered.periods,
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		expect(sink.emissions.map((signal) => signal.phase)).toEqual(["enter"]);
	});

	it("emits one leave signal per membership period when exit is opted in, with an explainable leave reason on the same identity", () => {
		const login = workRecord({
			id: "work-login",
			status: "In Progress",
			title: "Ship login",
		});
		const member = memberFrom(login, "Status is In Progress");
		const sink = new MemorySignalSink();
		const entered = produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: [],
			sink,
			subscription: { onEntry: true, onExit: true },
		});
		const left = workRecord({
			id: "work-login",
			status: "Not Started",
			title: "Ship login",
		});
		const afterLeave = produceSubscriptionSignals({
			catalog: [left],
			conditions: [STATUS_IN_PROGRESS],
			members: [],
			periods: entered.periods,
			sink,
			subscription: { onEntry: true, onExit: true },
		});
		expect(sink.emissions).toHaveLength(2);
		expect(sink.emissions[1]).toEqual({
			parenting: false,
			phase: "leave",
			reason: "Status is no longer In Progress",
			section: "Information flow",
			signalId: "smart-collection-entry",
			source: { id: "work-login", kind: RECORD_DISCOVERY_COPY.work },
			sourceFieldWrites: false,
		});

		produceSubscriptionSignals({
			catalog: [left],
			conditions: [STATUS_IN_PROGRESS],
			members: [],
			periods: afterLeave.periods,
			sink,
			subscription: { onEntry: true, onExit: true },
		});
		expect(sink.emissions).toHaveLength(2);
	});

	it("treats a later re-entry as a new membership period", () => {
		const login = workRecord({
			id: "work-login",
			status: "In Progress",
			title: "Ship login",
		});
		const member = memberFrom(login, "Status is In Progress");
		const sink = new MemorySignalSink();
		const firstEnter = produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: [],
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		const left = workRecord({
			id: "work-login",
			status: "Not Started",
			title: "Ship login",
		});
		const afterLeave = produceSubscriptionSignals({
			catalog: [left],
			conditions: [STATUS_IN_PROGRESS],
			members: [],
			periods: firstEnter.periods,
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: afterLeave.periods,
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		expect(sink.emissions.map((signal) => signal.phase)).toEqual([
			"enter",
			"enter",
		]);
	});

	it("does not backfill entry signals for members already in when subscription starts", () => {
		const login = workRecord({
			id: "work-login",
			status: "In Progress",
			title: "Ship login",
		});
		const member = memberFrom(login, "Status is In Progress");
		const sink = new MemorySignalSink();
		const seeded = seedOpenMembershipPeriods([member], []);
		produceSubscriptionSignals({
			catalog: [login],
			conditions: [STATUS_IN_PROGRESS],
			members: [member],
			periods: seeded,
			sink,
			subscription: { onEntry: true, onExit: false },
		});
		expect(sink.emissions).toEqual([]);
	});
});

describe("Smart Collections stored subscription production", () => {
	const DATABASE_URL = localTestDatabaseUrl();
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
	});

	it("produces one stored smart-collection-entry without parenting or writing source fields", async () => {
		const user = await prisma.user.create({
			data: {
				email: `founder-${crypto.randomUUID()}@example.com`,
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Founder",
			},
		});
		const workspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Workspace",
				ownerId: user.id,
			},
		});
		const createdProject = await createProject(prisma, {
			actorId: user.id,
			idempotencyKey: "create-atlas",
			origin: "human",
			payload: {
				name: "Atlas",
				starterConfiguration: "Blank Project",
			},
			workspaceId: workspace.id,
		});
		expect(createdProject.status).toBe("committed");
		if (createdProject.status !== "committed") {
			return;
		}
		const login = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "work-login",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Ship login",
				type: "Task",
			},
		});
		expect(login.status).toBe("committed");
		if (login.status !== "committed") {
			return;
		}
		const stored = await createSmartCollection(prisma, {
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: createdProject.project.id,
			sourceKind: RECORD_DISCOVERY_COPY.work,
			workspaceId: workspace.id,
		});
		expect(stored.status).toBe("ok");
		if (stored.status !== "ok") {
			return;
		}
		expect(stored.collection.subscribeOnEntry).toBe(false);
		expect(stored.collection.subscribeOnExit).toBe(false);
		const idleView = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(idleView?.signals).toEqual([]);
		expect(
			await prisma.smartCollectionMembershipPeriod.count({
				where: { collectionId: stored.collection.id },
			})
		).toBe(0);
		const subscribed = await subscribeSmartCollection(prisma, {
			collectionId: stored.collection.id,
			onEntry: true,
			onExit: false,
			workspaceId: workspace.id,
		});
		expect(subscribed.status).toBe("ok");
		if (subscribed.status !== "ok") {
			return;
		}
		expect(subscribed.signals).toEqual([]);

		const progressed = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: login.work.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: "In Progress",
			workId: login.work.id,
		});
		expect(progressed.status).toBe("committed");
		if (progressed.status !== "committed") {
			return;
		}

		const view = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(view?.signals).toEqual([
			{
				parenting: false,
				phase: "enter",
				reason: "Status is In Progress",
				section: "Information flow",
				signalId: "smart-collection-entry",
				source: {
					id: login.work.id,
					kind: RECORD_DISCOVERY_COPY.work,
				},
				sourceFieldWrites: false,
			},
		]);
		const periodIds = await prisma.smartCollectionMembershipPeriod.findMany({
			orderBy: { id: "asc" },
			select: { id: true },
			where: { collectionId: stored.collection.id },
		});
		const again = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(again?.signals).toHaveLength(1);
		expect(
			await prisma.smartCollectionMembershipPeriod.findMany({
				orderBy: { id: "asc" },
				select: { id: true },
				where: { collectionId: stored.collection.id },
			})
		).toEqual(periodIds);

		const left = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: progressed.work.revision,
			idempotencyKey: "to-not-started",
			origin: "human",
			status: "Not Started",
			workId: login.work.id,
		});
		expect(left.status).toBe("committed");
		if (left.status !== "committed") {
			return;
		}
		const afterLeave = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(afterLeave?.signals).toHaveLength(1);

		const reentered = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: left.work.revision,
			idempotencyKey: "to-in-progress-again",
			origin: "human",
			status: "In Progress",
			workId: login.work.id,
		});
		expect(reentered.status).toBe("committed");
		if (reentered.status !== "committed") {
			return;
		}
		const afterReentry = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(afterReentry?.signals.map((signal) => signal.phase)).toEqual([
			"enter",
			"enter",
		]);

		const work = await prisma.work.findUniqueOrThrow({
			where: { id: login.work.id },
		});
		expect(work.status).toBe("In Progress");
		expect(work.title).toBe("Ship login");
		expect(work).not.toHaveProperty("smartCollectionId");
		expect(work).not.toHaveProperty("parentId");
		expect("smartCollectionMember" in prisma).toBe(false);
		expect(JSON.stringify(view)).not.toContain("email digest");
	});
});
