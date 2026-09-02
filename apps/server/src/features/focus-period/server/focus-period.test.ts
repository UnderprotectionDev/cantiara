/**
 * Focus Period seam — optional 1–8 week working window with purpose
 * and start/end dates; membership add/remove does not write Work
 * workflow status or Project stage; lifecycle is Planned / Active /
 * Closed / Canceled (no sprint). Read-only Dependencies on the same
 * seam derive Active and Resolved blockers in period scope and do
 * not write a relation. Clock test double for start-instant
 * Planned → Active. Closed writes close-scope snapshot and opens the
 * still-open Work bulk decision; Canceled does not. One Work is in at
 * most one active Focus Period; implicit add to a second active period
 * is rejected and Move keeps past memberships and snapshots. Synthetic
 * fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Odak Dönemi: 1–8 week window; membership does not write status;
 * at most one active period per Work; Dependencies create no relation).
 */

import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	addActiveBlockingRelation,
	listWorkBlockers,
	markBlockerResolved,
} from "../../blockers/server/blockers";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createFocusPeriod } from "./focus-period";
import {
	FOCUS_PERIOD_COPY,
	FOCUS_PERIOD_COUNTERPARTS,
	FOCUS_PERIOD_MAX_DAYS,
	FOCUS_PERIOD_MIN_DAYS,
	FOCUS_PERIOD_PLANNING_WRITES,
	FOCUS_PERIOD_STATUS,
	focusPeriodCatalog,
	isFocusPeriodWindow,
} from "./focus-period-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const BEFORE_START = new Date("2026-09-01T12:00:00.000Z");
const START_INSTANT = new Date("2026-09-07T21:00:00.000Z");
const FORBIDDEN_SURFACE =
	/sprint|velocity|cadence|capacity|Milestone|Project Release|Daily Focus/i;
const MERMAID_PATTERN = /mermaid/i;
const GRAPH_LAYOUT_PATTERN = /nodePosition|layoutX|layoutY/;
const WRITE_ACTIONS_PATTERN =
	/Mark blocker resolved|Remove relation|Create relation/;
const COLOR_ONLY_PATTERN = /color-only|hexColor|#(?:[0-9a-f]{3}){1,2}/i;

describe("Focus Period catalog", () => {
	it("exposes English Focus Period, 1–8 week window, and no sprint semantics", () => {
		expect(focusPeriodCatalog()).toEqual({
			copy: FOCUS_PERIOD_COPY,
			counterparts: FOCUS_PERIOD_COUNTERPARTS,
			dependencies: {
				copy: {
					dependencies: "Dependencies",
					openSourceRecord: "Open source record",
				},
				optional: true,
				writable: false,
			},
			kind: "focus-period",
			maxDays: FOCUS_PERIOD_MAX_DAYS,
			minDays: FOCUS_PERIOD_MIN_DAYS,
			optional: true,
			planningWrites: FOCUS_PERIOD_PLANNING_WRITES,
		});
		expect(FOCUS_PERIOD_COPY.focusPeriod).toBe("Focus Period");
		expect(FOCUS_PERIOD_COPY.planned).toBe("Planned");
		expect(FOCUS_PERIOD_COPY.active).toBe("Active");
		expect(FOCUS_PERIOD_COPY.closed).toBe("Closed");
		expect(FOCUS_PERIOD_COPY.canceled).toBe("Canceled");
		expect(FOCUS_PERIOD_COUNTERPARTS).toEqual({
			dailyFocus: false,
			milestone: false,
			projectRelease: false,
		});
		expect(isFocusPeriodWindow("2026-09-01", "2026-09-07")).toBe(true);
		expect(isFocusPeriodWindow("2026-09-01", "2026-10-26")).toBe(true);
		expect(isFocusPeriodWindow("2026-09-01", "2026-09-06")).toBe(false);
		expect(isFocusPeriodWindow("2026-09-01", "2026-10-27")).toBe(false);
		expect(JSON.stringify(focusPeriodCatalog().copy)).not.toMatch(
			FORBIDDEN_SURFACE
		);
		expect(focusPeriodCatalog().dependencies).toMatchObject({
			copy: {
				dependencies: "Dependencies",
				openSourceRecord: "Open source record",
			},
			optional: true,
			writable: false,
		});
	});
});

describe("Focus Period", () => {
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
		const workIds = (
			await prisma.work.findMany({
				select: { id: true },
				where: { project: { workspaceId } },
			})
		).map((row) => row.id);
		if (workIds.length > 0) {
			await prisma.typedRelation.deleteMany({
				where: {
					OR: [{ fromId: { in: workIds } }, { toId: { in: workIds } }],
				},
			});
		}
		await prisma.focusPeriodMembership.deleteMany({
			where: { focusPeriod: { workspaceId } },
		});
		await prisma.focusPeriod.deleteMany({ where: { workspaceId } });
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function surface(now: Date = BEFORE_START) {
		return createFocusPeriod({
			accountId: actorId,
			clock: { now: () => now },
			prisma,
			workspaceId,
		});
	}

	async function openProject(name: string) {
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `create-${name}-${actorId}`,
			origin: "human",
			payload: {
				name,
				starterConfiguration: "Blank Project",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		return created.project;
	}

	async function openWork(projectId: string, title: string) {
		const created = await createWork(prisma, {
			actorId,
			idempotencyKey: `work-${title}-${actorId}`,
			origin: "human",
			payload: { projectId, title },
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Work");
		}
		return created.work;
	}

	async function openPeriod(
		purpose: string,
		startDate = "2026-09-08",
		endDate = "2026-09-21",
		now: Date = BEFORE_START
	) {
		const created = await surface(now).create({
			endDate,
			idempotencyKey: crypto.randomUUID(),
			purpose,
			startDate,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Focus Period");
		}
		return created.period;
	}

	it("rejects a window shorter than 1 week or longer than 8 weeks", async () => {
		const short = await surface().create({
			endDate: "2026-09-06",
			idempotencyKey: crypto.randomUUID(),
			purpose: "Too short",
			startDate: "2026-09-01",
		});
		const long = await surface().create({
			endDate: "2026-10-27",
			idempotencyKey: crypto.randomUUID(),
			purpose: "Too long",
			startDate: "2026-09-01",
		});
		expect(short).toEqual({
			reason: FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks,
			status: "invalid",
		});
		expect(long).toEqual({
			reason: FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks,
			status: "invalid",
		});
		expect(await surface().list()).toEqual([]);
	});

	it("does not close a Planned Focus Period before the start instant", async () => {
		const period = await openPeriod("Not yet a working window");
		const closed = await surface(BEFORE_START).close({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
		});
		expect(closed.status).toBe("not-found");
		expect((await surface(BEFORE_START).get(period.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.planned
		);
	});

	it("creates an optional 1–8 week Focus Period with purpose and dates", async () => {
		const period = await openPeriod(
			"Ship checkout",
			"2026-09-08",
			"2026-09-21"
		);
		expect(period.purpose).toBe("Ship checkout");
		expect(period.startDate).toBe("2026-09-08");
		expect(period.endDate).toBe("2026-09-21");
		expect(period.status).toBe(FOCUS_PERIOD_STATUS.planned);
		expect(period.optional).toBe(true);
		expect(period.planningWrites).toEqual(FOCUS_PERIOD_PLANNING_WRITES);
		expect(period.counterparts).toEqual(FOCUS_PERIOD_COUNTERPARTS);
		expect(period.startScope).toBeNull();
		expect(period.closeScope).toBeNull();
		expect(period.stillOpenWork).toEqual({
			autoRollover: false,
			opened: false,
			stillOpen: [],
		});
		expect(period.copy.focusPeriod).toBe("Focus Period");
		const listed = await surface().list();
		expect(listed.map((row) => row.id)).toEqual([period.id]);
	});

	it("adds Work from different Projects without writing status or stage", async () => {
		const payments = await openProject("Payments");
		const search = await openProject("Search");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(search.id, "Ranking query");
		const period = await openPeriod("Cross-project window");
		const beforeStages = payments.stages.map((stage) => ({
			id: stage.id,
			name: stage.name,
			sortOrder: stage.sortOrder,
			state: stage.state,
		}));
		const beforeList = (await listWork(prisma, payments.id)).map(
			(row) => row.id
		);
		const beforeWork = await getWork(prisma, intake.id);
		expect(beforeWork?.status).toBe("Not Started");

		const focus = surface();
		const addedIntake = await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		const addedRanking = await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: ranking.id,
		});
		expect(addedIntake.status).toBe("committed");
		expect(addedRanking.status).toBe("committed");
		if (addedRanking.status !== "committed") {
			throw new Error("expected committed add");
		}

		expect(addedRanking.period.members.map((row) => row.id).sort()).toEqual(
			[intake.id, ranking.id].sort()
		);
		expect(addedRanking.period.members).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: intake.id,
					projectId: payments.id,
					projectName: "Payments",
					title: "Intake checkout",
				}),
				expect.objectContaining({
					id: ranking.id,
					projectId: search.id,
					projectName: "Search",
					title: "Ranking query",
				}),
			])
		);
		expect(await getWork(prisma, intake.id)).toMatchObject({
			revision: beforeWork?.revision,
			status: "Not Started",
		});
		expect((await listWork(prisma, payments.id)).map((row) => row.id)).toEqual(
			beforeList
		);
		expect(
			(
				await prisma.project.findUnique({
					include: { stages: { orderBy: { sortOrder: "asc" } } },
					where: { id: payments.id },
				})
			)?.stages.map((stage) => ({
				id: stage.id,
				name: stage.name,
				sortOrder: stage.sortOrder,
				state: stage.state,
			}))
		).toEqual(beforeStages);
		expect(addedRanking.period.planningWrites).toEqual({
			stage: false,
			status: false,
		});
	});

	it("does not write status or stage on remove", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod("Remove membership");
		const focus = surface();
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		const beforeWork = await getWork(prisma, intake.id);
		const beforeStages = payments.stages.map((stage) => ({
			id: stage.id,
			name: stage.name,
			sortOrder: stage.sortOrder,
			state: stage.state,
		}));
		const removed = await focus.remove({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		expect(removed.status).toBe("committed");
		if (removed.status !== "committed") {
			throw new Error("expected committed remove");
		}
		expect(removed.period.members).toEqual([]);
		expect(await getWork(prisma, intake.id)).toMatchObject({
			revision: beforeWork?.revision,
			status: "Not Started",
		});
		expect(
			(
				await prisma.project.findUnique({
					include: { stages: { orderBy: { sortOrder: "asc" } } },
					where: { id: payments.id },
				})
			)?.stages.map((stage) => ({
				id: stage.id,
				name: stage.name,
				sortOrder: stage.sortOrder,
				state: stage.state,
			}))
		).toEqual(beforeStages);
	});

	it("becomes Active at the start instant without writing Work status", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod(
			"Start window",
			"2026-09-08",
			"2026-09-21",
			BEFORE_START
		);
		const planned = surface(BEFORE_START);
		await planned.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		expect((await planned.get(period.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.planned
		);
		expect((await planned.get(period.id))?.startScope).toBeNull();

		const active = surface(START_INSTANT);
		const viewed = await active.get(period.id);
		expect(viewed?.status).toBe(FOCUS_PERIOD_STATUS.active);
		expect(viewed?.startScope).toEqual({ workIds: [intake.id] });
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
		expect(viewed?.planningWrites).toEqual(FOCUS_PERIOD_PLANNING_WRITES);
	});

	it("includes Work added at the start instant in the start-scope snapshot", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod(
			"Due window",
			"2026-09-08",
			"2026-09-21",
			START_INSTANT
		);
		expect(period.status).toBe(FOCUS_PERIOD_STATUS.planned);
		expect(period.startScope).toBeNull();
		const added = await surface(START_INSTANT).add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		expect(added.period.status).toBe(FOCUS_PERIOD_STATUS.active);
		expect(added.period.startScope).toEqual({ workIds: [intake.id] });
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
	});

	it("closes with a close-scope snapshot and still-open Work decision without writing status", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod("Close account");
		const planned = surface(BEFORE_START);
		await planned.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		const active = surface(START_INSTANT);
		const closed = await active.close({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
		});
		expect(closed.status).toBe("committed");
		if (closed.status !== "committed") {
			throw new Error("expected committed close");
		}
		expect(closed.period.status).toBe(FOCUS_PERIOD_STATUS.closed);
		expect(closed.period.startScope).toEqual({ workIds: [intake.id] });
		expect(closed.period.closeScope).toEqual({ workIds: [intake.id] });
		expect(closed.period.stillOpenWork.opened).toBe(true);
		expect(closed.period.stillOpenWork.autoRollover).toBe(false);
		expect(closed.period.stillOpenWork.stillOpen.map((row) => row.id)).toEqual([
			intake.id,
		]);
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
		expect(await active.activePeriodIdForWork(intake.id)).toBeNull();
	});

	it("cancels from Planned without close-scope snapshot or still-open Work decision", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod("Cancel planned");
		const focus = surface(BEFORE_START);
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		const canceled = await focus.cancel({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
		});
		expect(canceled.status).toBe("committed");
		if (canceled.status !== "committed") {
			throw new Error("expected committed cancel");
		}
		expect(canceled.period.status).toBe(FOCUS_PERIOD_STATUS.canceled);
		expect(canceled.period.startScope).toBeNull();
		expect(canceled.period.closeScope).toBeNull();
		expect(canceled.period.stillOpenWork).toEqual({
			autoRollover: false,
			opened: false,
			stillOpen: [],
		});
		expect(canceled.period.members.map((row) => row.id)).toEqual([intake.id]);
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
		expect(await focus.activePeriodIdForWork(intake.id)).toBeNull();
	});

	it("cancels from Active keeping start scope and historical membership without still-open Work decision", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const period = await openPeriod("Cancel active");
		await surface(BEFORE_START).add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: intake.id,
		});
		const active = surface(START_INSTANT);
		expect((await active.get(period.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.active
		);
		const canceled = await active.cancel({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
		});
		expect(canceled.status).toBe("committed");
		if (canceled.status !== "committed") {
			throw new Error("expected committed cancel");
		}
		expect(canceled.period.status).toBe(FOCUS_PERIOD_STATUS.canceled);
		expect(canceled.period.startScope).toEqual({ workIds: [intake.id] });
		expect(canceled.period.closeScope).toBeNull();
		expect(canceled.period.stillOpenWork.opened).toBe(false);
		expect(canceled.period.members.map((row) => row.id)).toEqual([intake.id]);
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
		expect(await active.activePeriodIdForWork(intake.id)).toBeNull();
	});

	it("rejects adding Work that is already in another active Focus Period", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const first = await openPeriod("First window");
		const second = await openPeriod("Second window");
		await surface(BEFORE_START).add({
			idempotencyKey: crypto.randomUUID(),
			periodId: first.id,
			workId: intake.id,
		});
		const active = surface(START_INSTANT);
		expect((await active.get(first.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.active
		);
		expect((await active.get(second.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.active
		);
		expect(await active.activePeriodIdForWork(intake.id)).toBe(first.id);
		const added = await active.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: second.id,
			workId: intake.id,
		});
		expect(added).toEqual({
			reason: FOCUS_PERIOD_COPY.alreadyInAnActivePeriod,
			status: "invalid",
		});
		expect(await active.activePeriodIdForWork(intake.id)).toBe(first.id);
		expect((await active.get(first.id))?.members.map((row) => row.id)).toEqual([
			intake.id,
		]);
		expect((await active.get(second.id))?.members.map((row) => row.id)).toEqual(
			[]
		);
	});

	it("keeps closed membership and start-scope snapshot when Move takes Work to another active Focus Period", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const closedPeriod = await openPeriod("Closed window");
		await surface(BEFORE_START).add({
			idempotencyKey: crypto.randomUUID(),
			periodId: closedPeriod.id,
			workId: intake.id,
		});
		const afterClose = surface(START_INSTANT);
		const closed = await afterClose.close({
			idempotencyKey: crypto.randomUUID(),
			periodId: closedPeriod.id,
		});
		expect(closed.status).toBe("committed");
		const live = await openPeriod("Live window");
		const addedToLive = await afterClose.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: live.id,
			workId: intake.id,
		});
		expect(addedToLive.status).toBe("committed");
		if (addedToLive.status !== "committed") {
			throw new Error("expected committed add");
		}
		expect(addedToLive.period.status).toBe(FOCUS_PERIOD_STATUS.active);
		expect(await afterClose.activePeriodIdForWork(intake.id)).toBe(live.id);
		expect(
			(await afterClose.get(closedPeriod.id))?.members.map((row) => row.id)
		).toEqual([intake.id]);
		expect((await afterClose.get(closedPeriod.id))?.startScope).toEqual({
			workIds: [intake.id],
		});
		expect((await afterClose.get(closedPeriod.id))?.closeScope).toEqual({
			workIds: [intake.id],
		});

		const next = await openPeriod("Next window");
		expect((await afterClose.get(next.id))?.status).toBe(
			FOCUS_PERIOD_STATUS.active
		);
		const moved = await afterClose.move({
			idempotencyKey: crypto.randomUUID(),
			periodId: next.id,
			workId: intake.id,
		});
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			throw new Error("expected committed move");
		}
		expect(moved.period.members.map((row) => row.id)).toEqual([intake.id]);
		expect(await afterClose.activePeriodIdForWork(intake.id)).toBe(next.id);
		expect(
			(await afterClose.get(live.id))?.members.map((row) => row.id)
		).toEqual([]);
		expect((await afterClose.get(live.id))?.startScope).toEqual({
			workIds: [intake.id],
		});
		expect(
			(await afterClose.get(closedPeriod.id))?.members.map((row) => row.id)
		).toEqual([intake.id]);
		expect((await afterClose.get(closedPeriod.id))?.startScope).toEqual({
			workIds: [intake.id],
		});
		expect((await afterClose.get(closedPeriod.id))?.closeScope).toEqual({
			workIds: [intake.id],
		});
		expect(await getWork(prisma, intake.id)).toMatchObject({
			status: "Not Started",
		});
	});

	it("offers optional read-only Dependencies with no create or resolve action", async () => {
		const period = await openPeriod("Ship checkout");
		const viewed = await surface().get(period.id);
		expect(viewed?.dependencies.copy.dependencies).toBe("Dependencies");
		expect(viewed?.dependencies.copy.openSourceRecord).toBe(
			"Open source record"
		);
		expect(viewed?.dependencies.optional).toBe(true);
		expect(viewed?.dependencies.writable).toBe(false);
		expect(viewed?.dependencies.actions).toEqual({
			createRelation: false,
			resolveRelation: false,
		});
		expect(viewed?.dependencies.criticalPath).toBe(false);
		expect(viewed?.dependencies.secondPlanningFact).toBe(false);
		expect(viewed?.dependencies.edges).toEqual([]);
		expect(viewed?.dependencies.nodes).toEqual([]);
		expect(viewed?.dependencies.cycles).toEqual([]);
		expect(viewed?.dependencies).not.toHaveProperty("mermaidSource");
		expect(viewed?.dependencies).not.toHaveProperty("manualLayout");
		const serialized = JSON.stringify(viewed?.dependencies);
		expect(serialized).not.toMatch(MERMAID_PATTERN);
		expect(serialized).not.toMatch(GRAPH_LAYOUT_PATTERN);
		expect(serialized).not.toMatch(WRITE_ACTIONS_PATTERN);
	});

	it("derives Dependencies from Active and Resolved blockers in period scope without writing a relation", async () => {
		const payments = await openProject("Payments");
		const auth = await openWork(payments.id, "Auth API");
		const checkout = await openWork(payments.id, "Checkout");
		const pay = await openWork(payments.id, "Pay");
		const outsider = await openWork(payments.id, "Unrelated");
		const period = await openPeriod("Checkout window");
		const focus = surface();
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: auth.id,
		});
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: checkout.id,
		});
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: pay.id,
		});
		const added = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: checkout.id,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed blocking relation");
		}
		await markBlockerResolved(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			relationId: added.relation.id,
			viewerWorkspaceId: workspaceId,
		});
		const active = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: pay.id,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			source: { id: checkout.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (active.status !== "committed") {
			throw new Error("expected committed Active blocking relation");
		}
		await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: outsider.id,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const beforeCheckout = await listWorkBlockers(prisma, checkout.id);
		const beforePay = await listWorkBlockers(prisma, pay.id);
		const viewed = await focus.get(period.id);
		expect(viewed?.dependencies.writable).toBe(false);
		expect(viewed?.dependencies.edges).toEqual([
			{
				direction: "Blocks",
				from: { id: auth.id, kind: "Work" },
				id: added.relation.id,
				state: "Resolved",
				to: { id: checkout.id, kind: "Work" },
			},
			{
				direction: "Blocks",
				from: { id: checkout.id, kind: "Work" },
				id: active.relation.id,
				state: "Active",
				to: { id: pay.id, kind: "Work" },
			},
		]);
		expect(viewed?.dependencies.nodes).toEqual(
			expect.arrayContaining([
				{
					href: `/projects/${payments.id}?work=${encodeURIComponent(auth.id)}#work`,
					id: auth.id,
					kind: "Work",
					label: `${auth.key} Auth API`,
					openSourceRecord: "Open source record",
				},
				{
					href: `/projects/${payments.id}?work=${encodeURIComponent(checkout.id)}#work`,
					id: checkout.id,
					kind: "Work",
					label: `${checkout.key} Checkout`,
					openSourceRecord: "Open source record",
				},
				{
					href: `/projects/${payments.id}?work=${encodeURIComponent(pay.id)}#work`,
					id: pay.id,
					kind: "Work",
					label: `${pay.key} Pay`,
					openSourceRecord: "Open source record",
				},
			])
		);
		expect(viewed?.dependencies.nodes).toHaveLength(3);
		expect(viewed?.dependencies.cycles).toEqual([]);
		expect(await listWorkBlockers(prisma, checkout.id)).toEqual(beforeCheckout);
		expect(await listWorkBlockers(prisma, pay.id)).toEqual(beforePay);
		expect(JSON.stringify(viewed?.dependencies)).not.toMatch(
			WRITE_ACTIONS_PATTERN
		);
	});

	it("explains a safely detected cycle in Dependencies without a color-only signal", async () => {
		const payments = await openProject("Payments");
		const auth = await openWork(payments.id, "Auth API");
		const checkout = await openWork(payments.id, "Checkout");
		const period = await openPeriod("Loop window");
		const focus = surface();
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: auth.id,
		});
		await focus.add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.id,
			workId: checkout.id,
		});
		const first = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: checkout.id,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			source: { id: auth.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const reverse = await addActiveBlockingRelation(prisma, {
			actorId,
			blockedWorkId: auth.id,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			source: { id: checkout.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		if (first.status !== "committed" || reverse.status !== "committed") {
			throw new Error("expected committed cycle");
		}
		const viewed = await focus.get(period.id);
		expect(viewed?.dependencies.cycles).toEqual([
			{
				explanation: "These records wait on each other.",
				relationIds: expect.arrayContaining([
					first.relation.id,
					reverse.relation.id,
				]),
				workIds: [auth.id, checkout.id].sort(),
			},
		]);
		expect(viewed?.dependencies.cycles[0]?.relationIds).toHaveLength(2);
		expect(JSON.stringify(viewed?.dependencies.cycles)).not.toMatch(
			COLOR_ONLY_PATTERN
		);
	});
});
