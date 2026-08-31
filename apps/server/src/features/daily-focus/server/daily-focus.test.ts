/**
 * Daily Focus seam — personal day-scoped membership, add/remove
 * that does not write status / priority / stage / Backlog order,
 * no rollover to the next calendar day, Close focus as a
 * non-mutating calm view, and a second Account cannot see the set.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: non-Kanban view changes do not write status;
 * Close focus does not close Work or write membership).
 */

import { saveAccountPreferences } from "@cantiara/auth";
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	closeWork,
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createDailyFocus } from "./daily-focus";
import {
	DAILY_FOCUS_CLOSE_RITUAL,
	DAILY_FOCUS_CLOSE_WRITES,
	DAILY_FOCUS_COPY,
	DAILY_FOCUS_PLANNING_WRITES,
	dailyFocusCatalog,
	groupCloseFocusWork,
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
			closeFocus: {
				optional: true,
				ritual: DAILY_FOCUS_CLOSE_RITUAL,
				writes: DAILY_FOCUS_CLOSE_WRITES,
			},
			copy: {
				abandoned: "Abandoned",
				add: "Add",
				closeFocus: "Close focus",
				completed: "Completed",
				dailyFocus: "Daily Focus",
				deferred: "Deferred",
				empty: "No Work in Daily Focus for this day.",
				loading: "Loading…",
				openSourceRecord: "Open source record",
				remove: "Remove",
				selectedDay: "Selected day",
				stillOpen: "Still open",
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
		});
		expect(DAILY_FOCUS_COPY.dailyFocus).toBe("Daily Focus");
		expect(DAILY_FOCUS_COPY.closeFocus).toBe("Close focus");
		expect(DAILY_FOCUS_COPY.openSourceRecord).toBe("Open source record");
		expect(JSON.stringify(dailyFocusCatalog())).not.toMatch(FORBIDDEN_SURFACE);
	});

	it("groups reappear-deferred Daily Focus Work from a future source reappear date", () => {
		const deferred = {
			closureResult: null,
			id: "work-deferred",
			key: "PAY-1",
			openSourceRecord: true as const,
			projectId: "project-1",
			projectName: "Payments",
			reappearDate: "2026-09-15",
			status: "Not Started",
			title: "Snoozed intake",
		};
		expect(groupCloseFocusWork([deferred], "2026-08-31")).toEqual({
			abandoned: [],
			completed: [],
			reappearDeferred: [deferred],
			stillOpen: [],
		});
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

	it("Close focus is a non-mutating view of source groups for the selected day", async () => {
		const payments = await openProject("Payments");
		const completedWork = await openWork(payments.id, "Shipped checkout");
		const abandonedWork = await openWork(payments.id, "Dropped experiment");
		const openWorkRow = await openWork(payments.id, "Ranking query");
		const surface = focus();
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: completedWork.id,
		});
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: abandonedWork.id,
		});
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: openWorkRow.id,
		});
		const completedClose = await closeWork(prisma, {
			actorId,
			baseRevision: completedWork.revision,
			idempotencyKey: `close-completed-${actorId}`,
			origin: "human",
			result: "Completed",
			workId: completedWork.id,
		});
		const abandonedClose = await closeWork(prisma, {
			actorId,
			baseRevision: abandonedWork.revision,
			idempotencyKey: `close-abandoned-${actorId}`,
			origin: "human",
			result: "Abandoned",
			workId: abandonedWork.id,
		});
		expect(completedClose.status).toBe("committed");
		expect(abandonedClose.status).toBe("committed");
		if (completedClose.status !== "committed") {
			throw new Error("expected Completed Work");
		}
		if (abandonedClose.status !== "committed") {
			throw new Error("expected Abandoned Work");
		}

		const closeView = await surface.closeView();

		expect(closeView.calendarDay).toBe("2026-08-31");
		expect(closeView.copy.closeFocus).toBe("Close focus");
		expect(closeView.copy.dailyFocus).toBe("Daily Focus");
		expect(closeView.copy.openSourceRecord).toBe("Open source record");
		expect(closeView.writes).toEqual(DAILY_FOCUS_CLOSE_WRITES);
		expect(closeView.ritual).toEqual(DAILY_FOCUS_CLOSE_RITUAL);
		expect(closeView.groups.completed.map((row) => row.id)).toEqual([
			completedWork.id,
		]);
		expect(closeView.groups.abandoned.map((row) => row.id)).toEqual([
			abandonedWork.id,
		]);
		expect(closeView.groups.stillOpen.map((row) => row.id)).toEqual([
			openWorkRow.id,
		]);
		expect(closeView.groups.reappearDeferred).toEqual([]);
		expect(closeView.groups.completed[0]).toMatchObject({
			id: completedWork.id,
			key: completedWork.key,
			openSourceRecord: true,
			projectName: "Payments",
			title: "Shipped checkout",
		});
		expect(JSON.stringify(closeView)).not.toMatch(FORBIDDEN_SURFACE);

		expect(await getWork(prisma, openWorkRow.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(await getWork(prisma, completedWork.id)).toMatchObject({
			closureResult: "Completed",
			revision: completedClose.work.revision,
			status: "Closed",
		});
		expect((await surface.view()).members.map((row) => row.id).sort()).toEqual(
			[completedWork.id, abandonedWork.id, openWorkRow.id].sort()
		);
		expect((await surface.view({ calendarDay: "2026-09-01" })).members).toEqual(
			[]
		);
	});
});
