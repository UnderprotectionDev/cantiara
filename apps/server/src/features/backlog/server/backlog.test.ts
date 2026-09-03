/**
 * Backlog seam — prepared membership of active, non-archive,
 * non-trash Work, including unplanned Work; view, pick-up, and
 * placement on another planning surface do not write status,
 * closure, or project stage. One persistent Manual order survives
 * alternate presentations and does not write Kanban, ordinary
 * collection, or Prioritization session rank. Future Reappear date
 * splits default Backlog into Deferred without writing status;
 * advancing the clock restores the saved Manual order position.
 * Project Reappear date notification is off by default and mints
 * one `reappear-date` Action Required signal when the date arrives.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: view change other than Kanban does not write
 * status; future Reappear date is Deferred; notification default
 * off and per-Project opt-in; change history).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDailyFocus } from "../../daily-focus/server/daily-focus";
import { loadKanbanBoard } from "../../kanban/server/kanban";
import {
	createPrioritizationSession,
	createPriorityCriterion,
	getPrioritizationSession,
	listPriorityCriteria,
	listWorkPriorityValues,
	reorderPrioritizationSession,
	setPriorityCriterionValue,
} from "../../priority/server/priority";
import {
	configureProject,
	createProject,
	getProject,
} from "../../project-shell/server/project-shell";
import {
	archiveWork,
	changeWorkStatus,
	createWork,
	getWork,
	listWork,
	listWorkLifecycleHistory,
} from "../../work-lifecycle/server/work-lifecycle";
import { ACTION_REQUIRED_SIGNAL_IDS } from "../../workspace-overview/server/workspace-overview";
import {
	listPreparedBacklog,
	placeOnPlanningSurface,
	projectStagesForWork,
	reorderManualOrder,
	saveBacklogPresentation,
	setReappearDate,
	setReappearNotification,
	takeUpFromBacklog,
} from "./backlog";
import {
	BACKLOG_COPY,
	BACKLOG_SORT,
	BACKLOG_WRITES,
	backlogCatalog,
	PLANNING_SURFACE,
	PREPARED_MEMBERSHIP,
	REAPPEAR_DATE_SIGNAL_ID,
	REAPPEAR_DATE_SIGNAL_SECTION,
	REAPPEAR_SIGNAL_WRITES,
} from "./backlog-model";

const DATABASE_URL = localTestDatabaseUrl();

const FOLDER_SPRINT_PATTERN = /folder|sprint|staticList|tagAsBacklog/i;
const CROSS_SURFACE_WRITE_PATTERN =
	/ordinaryCollectionRank":true|kanbanPosition":true|folder|sprint/i;

async function seedWorkspace(prisma: PrismaClient) {
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
	return { actorId: user.id, workspaceId: workspace.id };
}

async function resetSharedTables(prisma: PrismaClient) {
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: "create-payments",
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
	return { actorId, project: created.project, workspaceId };
}

function createCommand(
	input: {
		idempotencyKey?: string;
		projectId: string;
		title?: string;
		type?: string;
	},
	actorId: string
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey ?? "create-work",
		origin: "human" as const,
		payload: {
			projectId: input.projectId,
			title: input.title,
			type: input.type,
		},
	};
}

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	input: { idempotencyKey: string; projectId: string; title: string }
) {
	const created = await createWork(prisma, createCommand(input, actorId));
	if (created.status !== "committed") {
		throw new Error("expected committed Work");
	}
	return created.work;
}

describe("Backlog", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("uses English UI Backlog and derived membership, not a folder or sprint", () => {
		const catalog = backlogCatalog();
		expect(catalog.copy.backlog).toBe("Backlog");
		expect(catalog.copy.manualOrder).toBe("Manual order");
		expect(catalog.copy.deferred).toBe("Deferred");
		expect(catalog.copy.reappearDate).toBe("Reappear date");
		expect(catalog.copy.notifyOnReappearDate).toBe("Notify on Reappear date");
		expect(catalog.reappearNotification.optedIn).toBe(false);
		expect(BACKLOG_COPY.backlog).toBe("Backlog");
		expect(BACKLOG_COPY.manualOrder).toBe("Manual order");
		expect(BACKLOG_COPY.deferred).toBe("Deferred");
		expect(BACKLOG_COPY.reappearDate).toBe("Reappear date");
		expect(BACKLOG_COPY.notifyOnReappearDate).toBe("Notify on Reappear date");
		expect(catalog.membership).toBe("derived");
		expect(catalog.sorts).toEqual([
			BACKLOG_SORT.manualOrder,
			BACKLOG_SORT.priority,
			BACKLOG_SORT.date,
			BACKLOG_SORT.field,
		]);
		expect(catalog.writes).toEqual(BACKLOG_WRITES);
		expect(JSON.stringify(catalog)).not.toMatch(FOLDER_SPRINT_PATTERN);
	});

	it("shows unplanned active Work without a stored membership list", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			(await listPreparedBacklog(prisma, project.id)).items.map(
				(item) => item.id
			)
		).toEqual([]);
		const unplanned = await committedWork(prisma, actorId, {
			idempotencyKey: "unplanned-intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const started = await committedWork(prisma, actorId, {
			idempotencyKey: "started-payout",
			projectId: project.id,
			title: "Payout retry",
		});
		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: started.revision,
			idempotencyKey: "start-payout",
			origin: "human",
			status: "In Progress",
			workId: started.id,
		});
		if (progressed.status !== "committed") {
			throw new Error("expected status write on Work, not Backlog");
		}
		const backlog = await listPreparedBacklog(prisma, project.id);
		expect(backlog.copy.backlog).toBe("Backlog");
		expect(backlog.membership).toBe(PREPARED_MEMBERSHIP);
		expect(backlog.items.map((item) => item.id)).toEqual([
			unplanned.id,
			started.id,
		]);
		expect(backlog.items.map((item) => item.status)).toEqual([
			"Not Started",
			"In Progress",
		]);
		expect(JSON.stringify(backlog)).not.toMatch(FOLDER_SPRINT_PATTERN);
	});

	it("keeps archived and Trash Work out of the prepared set", async () => {
		const { actorId, project } = await openPayments(prisma);
		const living = await committedWork(prisma, actorId, {
			idempotencyKey: "living",
			projectId: project.id,
			title: "Living",
		});
		const archived = await committedWork(prisma, actorId, {
			idempotencyKey: "archived",
			projectId: project.id,
			title: "Archived intake",
		});
		const trashed = await committedWork(prisma, actorId, {
			idempotencyKey: "trashed",
			projectId: project.id,
			title: "Trashed intake",
		});
		const archivedOutcome = await archiveWork(prisma, {
			actorId,
			baseRevision: archived.revision,
			idempotencyKey: "archive-intake",
			origin: "human",
			workId: archived.id,
		});
		expect(archivedOutcome.status).toBe("committed");
		await prisma.work.update({
			data: { trashedAt: new Date() },
			where: { id: trashed.id },
		});
		const backlog = await listPreparedBacklog(prisma, project.id);
		expect(backlog.items.map((item) => item.id)).toEqual([living.id]);
		expect(backlog.items.map((item) => item.title)).toEqual(["Living"]);
	});

	it("does not write status, closure, or project stage on view, pick-up, or placement", async () => {
		const { actorId, project } = await openPayments(prisma);
		const staged = await configureProject(prisma, {
			actorId,
			baseRevision: project.revision,
			change: { action: "add-stage", name: "Discovery" },
			idempotencyKey: "add-discovery",
			origin: "human",
			projectId: project.id,
		});
		if (staged.status !== "committed") {
			throw new Error("expected Discovery stage");
		}
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "intake",
			projectId: project.id,
			title: "Intake checkout",
		});
		const stagesBefore = await projectStagesForWork(prisma, work.id);
		const historyBefore = await listWorkLifecycleHistory(prisma, work.id);
		const viewed = await listPreparedBacklog(prisma, work.projectId);
		expect(viewed.items.map((item) => item.id)).toEqual([work.id]);
		expect(await getWork(prisma, work.id)).toMatchObject({
			closureResult: null,
			revision: work.revision,
			status: "Not Started",
		});
		const pickedUp = await takeUpFromBacklog(prisma, {
			onto: PLANNING_SURFACE.dailyFocus,
			workId: work.id,
		});
		expect(pickedUp).toMatchObject({
			membership: { surface: PLANNING_SURFACE.dailyFocus },
			status: "committed",
			work: {
				closureResult: null,
				id: work.id,
				status: "Not Started",
			},
		});
		const placed = await placeOnPlanningSurface(prisma, {
			surface: PLANNING_SURFACE.focusPeriod,
			workId: work.id,
		});
		expect(placed).toMatchObject({
			membership: { surface: PLANNING_SURFACE.focusPeriod },
			status: "committed",
			work: {
				closureResult: null,
				id: work.id,
				status: "Not Started",
			},
		});
		expect(await getWork(prisma, work.id)).toMatchObject({
			closureResult: null,
			revision: work.revision,
			status: "Not Started",
		});
		expect(await listWorkLifecycleHistory(prisma, work.id)).toEqual(
			historyBefore
		);
		expect(await projectStagesForWork(prisma, work.id)).toEqual(stagesBefore);
		expect(await getProject(prisma, project.id)).toMatchObject({
			stages: stagesBefore,
		});
		const stillPrepared = await listPreparedBacklog(prisma, work.projectId);
		expect(stillPrepared.items.map((item) => item.id)).toEqual([work.id]);
	});

	it("persists Manual order drag as the Project's single take-up rank", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "first-intake",
			projectId: project.id,
			title: "Zulu intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "second-payout",
			projectId: project.id,
			title: "Alpha payout",
		});
		const before = await listPreparedBacklog(prisma, project.id);
		expect(before.items.map((item) => item.id)).toEqual([first.id, second.id]);
		expect(before.manualOrder).toEqual([first.id, second.id]);
		expect(before.presentation).toEqual({
			kind: "saved",
			sort: BACKLOG_SORT.manualOrder,
		});
		const reordered = await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [second.id, first.id],
		});
		expect(reordered).toMatchObject({
			status: "committed",
			writes: BACKLOG_WRITES,
		});
		if (reordered.status !== "committed") {
			throw new Error("expected committed Manual order");
		}
		expect(reordered.backlog.items.map((item) => item.id)).toEqual([
			second.id,
			first.id,
		]);
		expect(reordered.backlog.manualOrder).toEqual([second.id, first.id]);
		expect(reordered.backlog.presentation.sort).toBe(BACKLOG_SORT.manualOrder);
		const again = await listPreparedBacklog(prisma, project.id);
		expect(again.items.map((item) => item.id)).toEqual([second.id, first.id]);
		expect(again.manualOrder).toEqual([second.id, first.id]);
		expect(await getWork(prisma, first.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(await getWork(prisma, second.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(await listWork(prisma, project.id)).toMatchObject([
			{ id: first.id },
			{ id: second.id },
		]);
	});

	it("keeps stored Manual order when an alternate presentation is selected", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "first-intake",
			projectId: project.id,
			title: "Alpha intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "second-payout",
			projectId: project.id,
			title: "Zulu payout",
		});
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "urgency",
			origin: "human",
			payload: { name: "Urgency", projectId: project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "rank-first",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: first.id,
			},
		});
		const stored = await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [second.id, first.id],
		});
		expect(stored.status).toBe("committed");
		const priority = await listPreparedBacklog(prisma, project.id, {
			sort: BACKLOG_SORT.priority,
		});
		expect(priority.presentation).toEqual({
			kind: "temporary",
			sort: BACKLOG_SORT.priority,
		});
		expect(priority.items.map((item) => item.id)).toEqual([
			first.id,
			second.id,
		]);
		expect(priority.manualOrder).toEqual([second.id, first.id]);
		const byField = await listPreparedBacklog(prisma, project.id, {
			sort: BACKLOG_SORT.field,
		});
		expect(byField.presentation).toEqual({
			kind: "temporary",
			sort: BACKLOG_SORT.field,
		});
		expect(byField.items.map((item) => item.id)).toEqual([first.id, second.id]);
		expect(byField.items.map((item) => item.title)).toEqual([
			"Alpha intake",
			"Zulu payout",
		]);
		expect(byField.manualOrder).toEqual([second.id, first.id]);
		const byDate = await listPreparedBacklog(prisma, project.id, {
			sort: BACKLOG_SORT.date,
		});
		expect(byDate.presentation).toEqual({
			kind: "temporary",
			sort: BACKLOG_SORT.date,
		});
		expect(byDate.items.map((item) => item.id)).toEqual([first.id, second.id]);
		expect(byDate.manualOrder).toEqual([second.id, first.id]);
		const restored = await listPreparedBacklog(prisma, project.id, {
			sort: BACKLOG_SORT.manualOrder,
		});
		expect(restored.presentation.sort).toBe(BACKLOG_SORT.manualOrder);
		expect(restored.items.map((item) => item.id)).toEqual([
			second.id,
			first.id,
		]);
		expect(restored.manualOrder).toEqual([second.id, first.id]);
		const saved = await saveBacklogPresentation(prisma, {
			projectId: project.id,
			sort: BACKLOG_SORT.field,
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected saved presentation");
		}
		expect(saved.backlog.presentation).toEqual({
			kind: "saved",
			sort: BACKLOG_SORT.field,
		});
		expect(saved.backlog.items.map((item) => item.title)).toEqual([
			"Alpha intake",
			"Zulu payout",
		]);
		expect(saved.backlog.manualOrder).toEqual([second.id, first.id]);
		const listedSaved = await listPreparedBacklog(prisma, project.id);
		expect(listedSaved.presentation).toEqual({
			kind: "saved",
			sort: BACKLOG_SORT.field,
		});
		expect(listedSaved.items.map((item) => item.title)).toEqual([
			"Alpha intake",
			"Zulu payout",
		]);
		expect(listedSaved.manualOrder).toEqual([second.id, first.id]);
		await saveBacklogPresentation(prisma, {
			projectId: project.id,
			sort: BACKLOG_SORT.manualOrder,
		});
		const backToManual = await listPreparedBacklog(prisma, project.id);
		expect(backToManual.presentation.sort).toBe(BACKLOG_SORT.manualOrder);
		expect(backToManual.items.map((item) => item.id)).toEqual([
			second.id,
			first.id,
		]);
	});

	it("does not write Kanban position, ordinary collection rank, or session rank", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "first-intake",
			projectId: project.id,
			title: "Zulu intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "second-payout",
			projectId: project.id,
			title: "Alpha payout",
		});
		const opened = await createPrioritizationSession(prisma, {
			actorId,
			idempotencyKey: "session-open",
			origin: "human",
			payload: {
				name: "August rank",
				projectId: project.id,
				workIds: [first.id, second.id],
			},
		});
		if (opened.status !== "committed") {
			throw new Error("expected committed session");
		}
		expect(opened.session.comparison.sessionOrder).toEqual([
			first.id,
			second.id,
		]);
		const reordered = await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [second.id, first.id],
		});
		expect(reordered).toMatchObject({
			status: "committed",
			writes: BACKLOG_WRITES,
		});
		const board = await loadKanbanBoard(prisma, project.id);
		const notStarted = board.columns.find(
			(column) => column.status === "Not Started"
		);
		expect(notStarted?.cards.map((card) => card.workId)).toEqual([
			first.id,
			second.id,
		]);
		const session = await getPrioritizationSession(prisma, opened.session.id);
		expect(session?.comparison.sessionOrder).toEqual([first.id, second.id]);
		expect(session?.comparison.backlogOrder).toEqual([second.id, first.id]);
		expect(session?.writes.backlogOrder).toBe(false);
		const sessionReorder = await reorderPrioritizationSession(prisma, {
			actorId,
			baseRevision: opened.session.revision,
			idempotencyKey: "session-reorder",
			origin: "human",
			payload: {
				sessionId: opened.session.id,
				workIds: [second.id, first.id],
			},
		});
		expect(sessionReorder.status).toBe("committed");
		const backlog = await listPreparedBacklog(prisma, project.id);
		expect(backlog.manualOrder).toEqual([second.id, first.id]);
		expect(backlog.items.map((item) => item.id)).toEqual([second.id, first.id]);
		expect(backlog.writes).toEqual(BACKLOG_WRITES);
		expect(JSON.stringify(backlog)).not.toMatch(CROSS_SURFACE_WRITE_PATTERN);
	});

	it("puts a future Reappear date in Deferred without writing status, priority, or stage", async () => {
		const { actorId, project } = await openPayments(prisma);
		const staged = await configureProject(prisma, {
			actorId,
			baseRevision: project.revision,
			change: { action: "add-stage", name: "Discovery" },
			idempotencyKey: "add-discovery-date",
			origin: "human",
			projectId: project.id,
		});
		if (staged.status !== "committed") {
			throw new Error("expected Discovery stage");
		}
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "urgency-date",
			origin: "human",
			payload: { name: "Urgency", projectId: project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected committed criterion");
		}
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "first-intake-date",
			projectId: project.id,
			title: "Zulu intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "second-payout-date",
			projectId: project.id,
			title: "Alpha payout",
		});
		await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "rank-second-date",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: second.id,
			},
		});
		const stored = await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [first.id, second.id],
		});
		expect(stored.status).toBe("committed");
		const stagesBefore = await projectStagesForWork(prisma, second.id);
		const historyBefore = await listWorkLifecycleHistory(prisma, second.id);
		const criteriaBefore = await listPriorityCriteria(prisma, project.id);
		const valuesBefore = await listWorkPriorityValues(
			prisma,
			project.id,
			second.id
		);
		const clock = { now: () => new Date("2026-08-31T12:00:00.000Z") };
		const dated = await setReappearDate(prisma, {
			projectId: project.id,
			reappearDate: "2026-12-01",
			workId: second.id,
		});
		expect(dated).toMatchObject({
			status: "committed",
			writes: {
				dailyFocusMembership: false,
				priority: false,
				projectStage: false,
				status: false,
			},
		});
		if (dated.status !== "committed") {
			throw new Error("expected committed Reappear date");
		}
		const deferred = await listPreparedBacklog(prisma, project.id, { clock });
		expect(deferred.copy.deferred).toBe("Deferred");
		expect(deferred.copy.reappearDate).toBe("Reappear date");
		expect(deferred.items.map((item) => item.id)).toEqual([first.id]);
		expect(deferred.deferred.map((item) => item.id)).toEqual([second.id]);
		expect(deferred.deferred.map((item) => item.reappearDate)).toEqual([
			"2026-12-01",
		]);
		expect(deferred.manualOrder).toEqual([first.id, second.id]);
		expect(await getWork(prisma, second.id)).toMatchObject({
			closureResult: null,
			reappearDate: "2026-12-01",
			status: "Not Started",
		});
		expect(await listWorkLifecycleHistory(prisma, second.id)).toEqual(
			historyBefore
		);
		expect(await projectStagesForWork(prisma, second.id)).toEqual(stagesBefore);
		expect(await listPriorityCriteria(prisma, project.id)).toEqual(
			criteriaBefore
		);
		expect(await listWorkPriorityValues(prisma, project.id, second.id)).toEqual(
			valuesBefore
		);
		expect(JSON.stringify(deferred)).not.toMatch(FOLDER_SPRINT_PATTERN);
	});

	it("restores saved Manual order when the Reappear date arrives, without Daily Focus membership", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "first-restore",
			projectId: project.id,
			title: "Zulu intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "second-restore",
			projectId: project.id,
			title: "Alpha payout",
		});
		const third = await committedWork(prisma, actorId, {
			idempotencyKey: "third-restore",
			projectId: project.id,
			title: "Bravo settle",
		});
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [first.id, second.id, third.id],
		});
		await setReappearDate(prisma, {
			projectId: project.id,
			reappearDate: "2026-12-01",
			workId: second.id,
		});
		const before = { now: () => new Date("2026-08-31T12:00:00.000Z") };
		const beforeArrival = await listPreparedBacklog(prisma, project.id, {
			clock: before,
		});
		expect(beforeArrival.items.map((item) => item.id)).toEqual([
			first.id,
			third.id,
		]);
		expect(beforeArrival.deferred.map((item) => item.id)).toEqual([second.id]);
		expect(beforeArrival.manualOrder).toEqual([first.id, second.id, third.id]);
		const moved = await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [third.id, first.id],
		});
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			throw new Error("expected committed Manual order");
		}
		expect(moved.backlog.manualOrder).toEqual([third.id, second.id, first.id]);
		const arrived = await listPreparedBacklog(prisma, project.id, {
			clock: { now: () => new Date("2026-12-01T08:00:00.000Z") },
		});
		expect(arrived.items.map((item) => item.id)).toEqual([
			third.id,
			second.id,
			first.id,
		]);
		expect(arrived.deferred).toEqual([]);
		expect(arrived.manualOrder).toEqual([third.id, second.id, first.id]);
		expect(await getWork(prisma, second.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		const focus = createDailyFocus({
			accountId: actorId,
			clock: { now: () => new Date("2026-12-01T08:00:00.000Z") },
			prisma,
			workspaceId,
		});
		const view = await focus.view();
		expect(view.members.map((item) => item.id)).toEqual([]);
		expect(view.eligibleWork.map((item) => item.id)).toContain(second.id);
		const stillPrepared = await listPreparedBacklog(prisma, project.id, {
			clock: { now: () => new Date("2026-12-01T08:00:00.000Z") },
		});
		expect(stillPrepared.items.map((item) => item.id)).toContain(second.id);
	});

	it("mints one reappear-date Action Required signal only after Project opt-in, without writing status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await committedWork(prisma, actorId, {
			idempotencyKey: "signal-first",
			projectId: project.id,
			title: "Zulu intake",
		});
		const second = await committedWork(prisma, actorId, {
			idempotencyKey: "signal-second",
			projectId: project.id,
			title: "Alpha payout",
		});
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [first.id, second.id],
		});
		await setReappearDate(prisma, {
			projectId: project.id,
			reappearDate: "2026-08-31",
			workId: second.id,
		});
		const arrived = { now: () => new Date("2026-08-31T12:00:00.000Z") };
		const catalog = backlogCatalog();
		expect(catalog.copy.notifyOnReappearDate).toBe("Notify on Reappear date");
		expect(catalog.reappearNotification.optedIn).toBe(false);
		expect(ACTION_REQUIRED_SIGNAL_IDS).toContain(REAPPEAR_DATE_SIGNAL_ID);
		expect(REAPPEAR_DATE_SIGNAL_SECTION).toBe("Action Required");
		const off = await listPreparedBacklog(prisma, project.id, {
			clock: arrived,
		});
		expect(off.reappearNotification.optedIn).toBe(false);
		expect(off.signals).toEqual([]);
		expect(off.items.map((item) => item.id)).toEqual([first.id, second.id]);
		expect(off.manualOrder).toEqual([first.id, second.id]);
		expect(await getWork(prisma, second.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		const valuesBefore = await listWorkPriorityValues(
			prisma,
			project.id,
			second.id
		);
		const opted = await setReappearNotification(prisma, {
			optedIn: true,
			projectId: project.id,
		});
		expect(opted).toMatchObject({
			status: "committed",
			writes: REAPPEAR_SIGNAL_WRITES,
		});
		if (opted.status !== "committed") {
			throw new Error("expected committed Reappear date notification");
		}
		expect(opted.backlog.reappearNotification.optedIn).toBe(true);
		const on = await listPreparedBacklog(prisma, project.id, {
			clock: arrived,
		});
		const expectedSignal = {
			section: REAPPEAR_DATE_SIGNAL_SECTION,
			signalId: REAPPEAR_DATE_SIGNAL_ID,
			source: { id: second.id, kind: "Work" },
			workId: second.id,
		};
		expect(on.signals).toEqual([expectedSignal]);
		expect(on.reappearNotification.optedIn).toBe(true);
		expect(on.manualOrder).toEqual([first.id, second.id]);
		expect(on.items.map((item) => item.id)).toEqual([first.id, second.id]);
		expect(await getWork(prisma, second.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(await listWorkPriorityValues(prisma, project.id, second.id)).toEqual(
			valuesBefore
		);
		const again = await listPreparedBacklog(prisma, project.id, {
			clock: arrived,
		});
		expect(again.signals).toEqual([expectedSignal]);
		const future = await listPreparedBacklog(prisma, project.id, {
			clock: { now: () => new Date("2026-08-30T12:00:00.000Z") },
		});
		expect(future.signals).toEqual([]);
		expect(future.deferred.map((item) => item.id)).toEqual([second.id]);
	});

	it("lists and saves Backlog when bun --hot kept a client without presentation delegates", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "hot-client",
			projectId: project.id,
			title: "Intake",
		});
		const stale = withoutBacklogPresentation(prisma);
		const listed = await listPreparedBacklog(stale, project.id);
		expect(listed.presentation.sort).toBe(BACKLOG_SORT.manualOrder);
		expect(listed.items.map((item) => item.id)).toEqual([work.id]);
		const dated = await setReappearDate(stale, {
			projectId: project.id,
			reappearDate: "2026-12-01",
			workId: work.id,
		});
		expect(dated.status).toBe("committed");
		const deferred = await listPreparedBacklog(stale, project.id, {
			clock: { now: () => new Date("2026-08-31T12:00:00.000Z") },
		});
		expect(deferred.deferred.map((item) => item.id)).toEqual([work.id]);
		const saved = await saveBacklogPresentation(stale, {
			projectId: project.id,
			sort: BACKLOG_SORT.field,
		});
		expect(saved.status).toBe("committed");
		expect((await listPreparedBacklog(stale, project.id)).presentation).toEqual(
			{
				kind: "saved",
				sort: BACKLOG_SORT.field,
			}
		);
	});

	it("saves Reappear date when bun --hot kept a client that rejects the Work field", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "hot-reappear",
			projectId: project.id,
			title: "Intake",
		});
		const dated = await setReappearDate(withoutReappearDateWrite(prisma), {
			projectId: project.id,
			reappearDate: "2026-12-01",
			workId: work.id,
		});
		expect(dated.status).toBe("committed");
		const deferred = await listPreparedBacklog(prisma, project.id, {
			clock: { now: () => new Date("2026-08-31T12:00:00.000Z") },
		});
		expect(deferred.deferred.map((item) => item.id)).toEqual([work.id]);
	});
});

function withoutBacklogPresentation(prisma: PrismaClient): PrismaClient {
	return new Proxy(prisma, {
		get(target, property, receiver) {
			if (
				property === "projectBacklogPresentation" ||
				property === "projectBacklogManualOrderItem"
			) {
				return;
			}
			const value = Reflect.get(target, property, receiver);
			if (typeof value === "function") {
				return value.bind(target);
			}
			return value;
		},
	}) as PrismaClient;
}

function withoutReappearDateWrite(prisma: PrismaClient): PrismaClient {
	return new Proxy(prisma, {
		get(target, property, receiver) {
			if (property === "work") {
				return new Proxy(target.work, {
					get(workTarget, workProperty, workReceiver) {
						if (workProperty === "update") {
							return () => {
								throw new Error("Unknown argument `reappearDate`");
							};
						}
						const value = Reflect.get(workTarget, workProperty, workReceiver);
						if (typeof value === "function") {
							return value.bind(workTarget);
						}
						return value;
					},
				});
			}
			const value = Reflect.get(target, property, receiver);
			if (typeof value === "function") {
				return value.bind(target);
			}
			return value;
		},
	}) as PrismaClient;
}
