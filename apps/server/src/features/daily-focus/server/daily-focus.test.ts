/**
 * Daily Focus seam — personal day-scoped membership, add/remove
 * that does not write status / priority / stage / Backlog order,
 * no rollover to the next calendar day, and a second Account
 * cannot see the set. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: non-Kanban view changes do not write status).
 */

import { saveAccountPreferences } from "@cantiara/auth";
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	changeWorkStatus,
	closeWork,
	createWork,
	getWork,
	listWork,
	reopenWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createDailyFocus } from "./daily-focus";
import {
	DAILY_FOCUS_COPY,
	DAILY_FOCUS_PLANNING_WRITES,
	dailyFocusCatalog,
	WHAT_HAPPENED_TODAY_CONTRACT,
	WHAT_HAPPENED_TODAY_KINDS,
	workSourceHref,
} from "./daily-focus-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const TODAY = new Date("2026-08-31T12:00:00.000Z");
const NEXT_DAY = new Date("2026-09-01T12:00:00.000Z");
const FORBIDDEN_SURFACE =
	/Focus Period|sprint|Active Work Set|Calendar event|Daily Note/i;

describe("Daily Focus catalog", () => {
	it("exposes English Daily Focus and does not write planning fields", () => {
		expect(dailyFocusCatalog()).toEqual({
			copy: {
				add: "Add",
				dailyFocus: "Daily Focus",
				empty: "No Work in Daily Focus for this day.",
				loading: "Loading…",
				openSourceRecord: "Open source record",
				remove: "Remove",
				selectedDay: "Selected day",
				whatHappenedToday: "What happened today?",
				work: "Work",
			},
			kind: "daily-focus",
			planningWrites: {
				backlogOrder: false,
				priority: false,
				stage: false,
				status: false,
			},
			shared: false,
			whatHappenedToday: {
				createsDocument: false,
				editable: false,
				kinds: WHAT_HAPPENED_TODAY_KINDS,
				rewritesSourceTimestamps: false,
			},
		});
		expect(DAILY_FOCUS_COPY.dailyFocus).toBe("Daily Focus");
		expect(DAILY_FOCUS_COPY.whatHappenedToday).toBe("What happened today?");
		expect(DAILY_FOCUS_COPY.openSourceRecord).toBe("Open source record");
		expect(WHAT_HAPPENED_TODAY_CONTRACT).toEqual({
			createsDocument: false,
			editable: false,
			rewritesSourceTimestamps: false,
		});
		expect(JSON.stringify(dailyFocusCatalog())).not.toMatch(FORBIDDEN_SURFACE);
	});
});

describe("Daily Focus", () => {
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
		await prisma.dailyFocusMembership.deleteMany({
			where: { accountId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function focus(now: Date = TODAY) {
		return createDailyFocus({
			accountId: actorId,
			clock: { now: () => now },
			prisma,
			workspaceId,
		});
	}

	async function pinLifecycleEvent(
		workId: string,
		kind: "closed" | "reopened",
		createdAt: Date
	) {
		const row = await prisma.workLifecycleEvent.findFirst({
			orderBy: { createdAt: "desc" },
			where: { kind, workId },
		});
		if (!row) {
			throw new Error(`expected ${kind} lifecycle event`);
		}
		return await prisma.workLifecycleEvent.update({
			data: { createdAt },
			where: { id: row.id },
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

	it("holds Work from different Projects for the selected profile day", async () => {
		const payments = await openProject("Payments");
		const search = await openProject("Search");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(search.id, "Ranking query");
		const surface = focus();

		const addedIntake = await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});
		const addedRanking = await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: ranking.id,
		});
		expect(addedIntake.status).toBe("committed");
		expect(addedRanking.status).toBe("committed");

		const view = await surface.view();
		expect(view.calendarDay).toBe("2026-08-31");
		expect(view.copy.dailyFocus).toBe("Daily Focus");
		expect(view.planningWrites).toEqual(DAILY_FOCUS_PLANNING_WRITES);
		expect(view.members.map((row) => row.id).sort()).toEqual(
			[intake.id, ranking.id].sort()
		);
		expect(view.members).toEqual(
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
		expect(view.eligibleWork.map((row) => row.id)).not.toContain(intake.id);
	});

	it("keeps membership personal so a second Account cannot see it", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const added = await focus().add({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});
		expect(added.status).toBe("committed");

		const otherId = crypto.randomUUID();
		await prisma.user.create({
			data: {
				email: `${otherId}@example.com`,
				emailVerified: true,
				id: otherId,
				name: "Other",
			},
		});
		const other = createDailyFocus({
			accountId: otherId,
			clock: { now: () => TODAY },
			prisma,
			workspaceId,
		});
		expect((await other.view()).members).toEqual([]);
		await prisma.user.delete({ where: { id: otherId } });
	});

	it("does not write status, priority, stage, or Backlog order on add or remove", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(payments.id, "Ranking query");
		const beforeWork = await getWork(prisma, intake.id);
		const beforeList = (await listWork(prisma, payments.id)).map(
			(row) => row.id
		);
		const beforeStages = payments.stages.map((stage) => ({
			id: stage.id,
			name: stage.name,
			sortOrder: stage.sortOrder,
			state: stage.state,
		}));
		const beforePriority = await prisma.projectPriorityCriterionValue.count({
			where: { workId: intake.id },
		});
		expect(beforeWork?.status).toBe("Not Started");

		const surface = focus();
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});
		await surface.remove({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});

		expect(await getWork(prisma, intake.id)).toMatchObject({
			revision: beforeWork?.revision,
			status: "Not Started",
		});
		expect((await listWork(prisma, payments.id)).map((row) => row.id)).toEqual(
			beforeList
		);
		expect(beforeList).toEqual([intake.id, ranking.id]);
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
		expect(
			await prisma.projectPriorityCriterionValue.count({
				where: { workId: intake.id },
			})
		).toBe(beforePriority);
		expect((await surface.view()).planningWrites).toEqual({
			backlogOrder: false,
			priority: false,
			stage: false,
			status: false,
		});
	});

	it("does not roll yesterday’s membership into the next calendar day", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const today = focus(TODAY);
		await today.add({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});
		expect((await today.view()).members.map((row) => row.id)).toEqual([
			intake.id,
		]);

		const tomorrow = focus(NEXT_DAY);
		expect((await tomorrow.view()).calendarDay).toBe("2026-09-01");
		expect((await tomorrow.view()).members).toEqual([]);
		expect(
			(await tomorrow.view({ calendarDay: "2026-08-31" })).members.map(
				(row) => row.id
			)
		).toEqual([intake.id]);
	});

	it("uses the profile time zone for the selected calendar day", async () => {
		await saveAccountPreferences(prisma, actorId, {
			appearance: "Dark",
			dateFormat: "locale",
			firstDayOfWeek: "Monday",
			locale: "en-US",
			timeZone: "America/New_York",
		});
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const boundary = new Date("2026-09-01T02:00:00.000Z");
		const surface = focus(boundary);
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: intake.id,
		});
		expect((await surface.view()).calendarDay).toBe("2026-08-31");
		expect((await surface.view()).members.map((row) => row.id)).toEqual([
			intake.id,
		]);
		expect(
			(await focus(boundary).view({ calendarDay: "2026-09-01" })).members
		).toEqual([]);
	});

	it("derives What happened today from source Work events without a Daily Note", async () => {
		const payments = await openProject("Payments");
		const search = await openProject("Search");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(search.id, "Ranking query");
		const parked = await openWork(payments.id, "Parked refund");
		const surface = focus();

		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: intake.revision,
			idempotencyKey: `progress-${intake.id}`,
			origin: "human",
			status: "In Progress",
			workId: intake.id,
		});
		if (progressed.status !== "committed") {
			throw new Error("expected In Progress");
		}
		const completed = await closeWork(prisma, {
			actorId,
			baseRevision: progressed.work.revision,
			idempotencyKey: `close-${intake.id}`,
			origin: "human",
			result: "Completed",
			workId: intake.id,
		});
		if (completed.status !== "committed") {
			throw new Error("expected Completed");
		}
		const abandoned = await closeWork(prisma, {
			actorId,
			baseRevision: ranking.revision,
			idempotencyKey: `abandon-${ranking.id}`,
			origin: "human",
			result: "Abandoned",
			workId: ranking.id,
		});
		if (abandoned.status !== "committed") {
			throw new Error("expected Abandoned");
		}
		const reopened = await reopenWork(prisma, {
			actorId,
			baseRevision: abandoned.work.revision,
			idempotencyKey: `reopen-${ranking.id}`,
			origin: "human",
			reopenConfirmed: true,
			status: "In Progress",
			workId: ranking.id,
		});
		if (reopened.status !== "committed") {
			throw new Error("expected reopened");
		}
		await closeWork(prisma, {
			actorId,
			baseRevision: parked.revision,
			idempotencyKey: `close-${parked.id}`,
			origin: "human",
			result: "Abandoned",
			workId: parked.id,
		});

		const completedAt = new Date("2026-08-31T12:00:00.000Z");
		const abandonedAt = new Date("2026-08-31T13:00:00.000Z");
		const reopenedAt = new Date("2026-08-31T14:00:00.000Z");
		const otherDayAt = new Date("2026-09-01T12:00:00.000Z");
		await pinLifecycleEvent(intake.id, "closed", completedAt);
		await pinLifecycleEvent(ranking.id, "closed", abandonedAt);
		await pinLifecycleEvent(ranking.id, "reopened", reopenedAt);
		await pinLifecycleEvent(parked.id, "closed", otherDayAt);

		const beforeCount = await prisma.workLifecycleEvent.count({
			where: { work: { project: { workspaceId } } },
		});
		const first = await surface.view();
		const second = await surface.view();
		expect(first.whatHappenedToday).toEqual(second.whatHappenedToday);
		expect(
			await prisma.workLifecycleEvent.count({
				where: { work: { project: { workspaceId } } },
			})
		).toBe(beforeCount);
		expect(first.whatHappenedToday.createsDocument).toBe(false);
		expect(first.whatHappenedToday.editable).toBe(false);
		expect(first.whatHappenedToday.rewritesSourceTimestamps).toBe(false);
		expect(first.copy.whatHappenedToday).toBe("What happened today?");
		expect(first.copy.openSourceRecord).toBe("Open source record");
		expect(JSON.stringify(first.whatHappenedToday)).not.toMatch(
			FORBIDDEN_SURFACE
		);
		expect(first.whatHappenedToday.rows.map((row) => row.kind)).toEqual([
			"work-completed",
			"work-abandoned",
			"work-reopened",
		]);
		expect(first.whatHappenedToday.rows).toEqual([
			{
				id: expect.any(String),
				kind: "work-completed",
				occurredAt: completedAt.toISOString(),
				occurredAtDisplay: "31/08/2026, 15:00",
				openSourceRecord: "Open source record",
				projectId: payments.id,
				projectName: "Payments",
				sourceHref: workSourceHref(payments.id, intake.id),
				sourceId: intake.id,
				sourceKey: intake.key,
				sourceKind: "work",
				sourceTitle: "Intake checkout",
			},
			{
				id: expect.any(String),
				kind: "work-abandoned",
				occurredAt: abandonedAt.toISOString(),
				occurredAtDisplay: "31/08/2026, 16:00",
				openSourceRecord: "Open source record",
				projectId: search.id,
				projectName: "Search",
				sourceHref: workSourceHref(search.id, ranking.id),
				sourceId: ranking.id,
				sourceKey: ranking.key,
				sourceKind: "work",
				sourceTitle: "Ranking query",
			},
			{
				id: expect.any(String),
				kind: "work-reopened",
				occurredAt: reopenedAt.toISOString(),
				occurredAtDisplay: "31/08/2026, 17:00",
				openSourceRecord: "Open source record",
				projectId: search.id,
				projectName: "Search",
				sourceHref: workSourceHref(search.id, ranking.id),
				sourceId: ranking.id,
				sourceKey: ranking.key,
				sourceKind: "work",
				sourceTitle: "Ranking query",
			},
		]);
		expect(
			first.whatHappenedToday.rows.map((row) => row.sourceId)
		).not.toContain(parked.id);
	});

	it("recomputes What happened today day bounds when the profile time zone changes", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			idempotencyKey: `close-boundary-${intake.id}`,
			origin: "human",
			result: "Completed",
			workId: intake.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected Completed");
		}
		const occurredAt = new Date("2026-09-01T02:00:00.000Z");
		const event = await pinLifecycleEvent(intake.id, "closed", occurredAt);
		expect(event.createdAt.toISOString()).toBe(occurredAt.toISOString());

		const utcDay = await focus().view({ calendarDay: "2026-08-31" });
		expect(utcDay.whatHappenedToday.rows).toEqual([]);
		expect(
			(await focus().view({ calendarDay: "2026-09-01" })).whatHappenedToday.rows
		).toEqual([
			expect.objectContaining({
				kind: "work-completed",
				occurredAt: occurredAt.toISOString(),
				sourceId: intake.id,
			}),
		]);

		await saveAccountPreferences(prisma, actorId, {
			appearance: "Dark",
			dateFormat: "locale",
			firstDayOfWeek: "Monday",
			locale: "en-US",
			timeZone: "America/New_York",
		});
		const nyDay = await focus().view({ calendarDay: "2026-08-31" });
		expect(nyDay.whatHappenedToday.rows).toEqual([
			expect.objectContaining({
				kind: "work-completed",
				occurredAt: occurredAt.toISOString(),
				occurredAtDisplay: "08/31/2026, 10:00 PM",
				sourceId: intake.id,
			}),
		]);
		expect(
			(await focus().view({ calendarDay: "2026-09-01" })).whatHappenedToday.rows
		).toEqual([]);
		expect(
			(
				await prisma.workLifecycleEvent.findUnique({
					where: { id: event.id },
				})
			)?.createdAt.toISOString()
		).toBe(occurredAt.toISOString());
	});
});
