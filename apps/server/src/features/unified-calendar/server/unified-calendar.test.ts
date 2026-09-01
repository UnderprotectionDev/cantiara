/**
 * Unified Calendar seam — Day, Week, and Month present the same
 * dated Work records with Planned start, Target date, and Reappear
 * date kept as separate kinds. Week/month show a start+target range;
 * Day shows only that day's positions. Planned start does not hide
 * Work, auto-start it, or write workflow status. Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: non-Kanban view changes do not write status).
 */

import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	changeWorkStatus,
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import { createUnifiedCalendar } from "./unified-calendar";
import {
	CALENDAR_COUNTERPARTS,
	CALENDAR_EVENT_RECORD,
	DATE_KINDS,
	PLANNED_START_EFFECTS,
	presentCalendarWindow,
	UNIFIED_CALENDAR_COPY,
	unifiedCalendarCatalog,
} from "./unified-calendar-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const TODAY = new Date("2026-08-31T12:00:00.000Z");
const FORBIDDEN_SURFACE =
	/Focus Period|Active Work Set|ICS|iCal|Google Calendar|Outlook/i;

const SPAN_WORK = {
	id: "work-span",
	key: "PAY-1",
	plannedStart: "2026-08-31",
	projectId: "project-1",
	projectName: "Payments",
	reappearDate: "2026-09-02",
	targetDate: "2026-09-04",
	title: "Checkout span",
};

describe("Unified Calendar catalog", () => {
	it("exposes English Calendar views and keeps date kinds separate", () => {
		expect(unifiedCalendarCatalog()).toEqual({
			copy: UNIFIED_CALENDAR_COPY,
			counterparts: CALENDAR_COUNTERPARTS,
			dateKinds: DATE_KINDS,
			eventRecord: CALENDAR_EVENT_RECORD,
			kind: "unified-calendar",
			plannedStart: PLANNED_START_EFFECTS,
			views: ["Day", "Week", "Month"],
		});
		expect(UNIFIED_CALENDAR_COPY.calendar).toBe("Calendar");
		expect(UNIFIED_CALENDAR_COPY.day).toBe("Day");
		expect(UNIFIED_CALENDAR_COPY.week).toBe("Week");
		expect(UNIFIED_CALENDAR_COPY.month).toBe("Month");
		expect(UNIFIED_CALENDAR_COPY.plannedStart).toBe("Planned start");
		expect(UNIFIED_CALENDAR_COPY.targetDate).toBe("Target date");
		expect(UNIFIED_CALENDAR_COPY.reappearDate).toBe("Reappear date");
		expect(DATE_KINDS).toEqual([
			"Planned start",
			"Target date",
			"Reappear date",
		]);
		expect(CALENDAR_EVENT_RECORD).toBe(false);
		expect(PLANNED_START_EFFECTS).toEqual({
			autoStarts: false,
			hidesWork: false,
			writesStatus: false,
		});
		expect(JSON.stringify(unifiedCalendarCatalog().copy)).not.toMatch(
			FORBIDDEN_SURFACE
		);
	});

	it("keeps kinds unmixed and uses a range only for start+target in week and month", () => {
		const week = presentCalendarWindow({
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Week",
			works: [SPAN_WORK],
		});
		expect(week.ranges).toEqual([
			{
				end: { date: "2026-09-04", kind: "Target date" },
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				start: { date: "2026-08-31", kind: "Planned start" },
				title: SPAN_WORK.title,
			},
		]);
		expect(week.positions).toEqual([
			{
				date: "2026-09-02",
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				kind: "Reappear date",
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				title: SPAN_WORK.title,
			},
		]);
		expect(week.positions.map((row) => row.kind)).not.toContain(
			"Planned start"
		);
		expect(week.positions.map((row) => row.kind)).not.toContain("Target date");

		const day = presentCalendarWindow({
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Day",
			works: [SPAN_WORK],
		});
		expect(day.ranges).toEqual([]);
		expect(day.positions).toEqual([
			{
				date: "2026-09-02",
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				kind: "Reappear date",
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				title: SPAN_WORK.title,
			},
		]);

		const midpointDay = presentCalendarWindow({
			calendarDay: "2026-09-01",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Day",
			works: [SPAN_WORK],
		});
		expect(midpointDay.ranges).toEqual([]);
		expect(midpointDay.positions).toEqual([]);
	});
});

describe("Unified Calendar", () => {
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
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function calendar() {
		return createUnifiedCalendar({
			accountId: actorId,
			clock: { now: () => TODAY },
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

	async function setDates(
		work: { id: string; revision: number },
		dates: {
			plannedStart?: string | null;
			reappearDate?: string | null;
			targetDate?: string | null;
		}
	) {
		const updated = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `dates-${work.id}-${actorId}`,
			origin: "human",
			plannedStart: dates.plannedStart ?? null,
			reappearDate: dates.reappearDate ?? null,
			targetDate: dates.targetDate ?? null,
			workId: work.id,
		});
		if (updated.status !== "committed") {
			throw new Error("expected committed dates");
		}
		return updated.work;
	}

	it("shows the same dated Work across Day, Week, and Month without mixing kinds or creating an Event record", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		await setDates(intake, {
			plannedStart: "2026-08-31",
			reappearDate: "2026-09-02",
			targetDate: "2026-09-04",
		});
		const surface = calendar();
		const week = await surface.view({
			calendarDay: "2026-09-02",
			view: "Week",
		});
		expect(week.copy.calendar).toBe("Calendar");
		expect(week.eventRecord).toBe(false);
		expect(week.counterparts).toEqual(CALENDAR_COUNTERPARTS);
		expect(week.plannedStart).toEqual(PLANNED_START_EFFECTS);
		expect(week.view).toBe("Week");
		expect(week.ranges).toEqual([
			expect.objectContaining({
				end: { date: "2026-09-04", kind: "Target date" },
				id: intake.id,
				start: { date: "2026-08-31", kind: "Planned start" },
			}),
		]);
		expect(week.positions).toEqual([
			expect.objectContaining({
				date: "2026-09-02",
				id: intake.id,
				kind: "Reappear date",
			}),
		]);

		const day = await surface.view({
			calendarDay: "2026-09-02",
			view: "Day",
		});
		expect(day.ranges).toEqual([]);
		expect(day.positions.map((row) => row.kind).sort()).toEqual([
			"Reappear date",
		]);
		expect(day.eventRecord).toBe(false);

		const month = await surface.view({
			calendarDay: "2026-09-02",
			view: "Month",
		});
		expect(month.ranges).toHaveLength(1);
		expect(month.positions.map((row) => row.kind)).toEqual(["Reappear date"]);
	});

	it("scopes to all Projects or one selected Project", async () => {
		const payments = await openProject("Payments");
		const search = await openProject("Search");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(search.id, "Ranking query");
		await setDates(intake, { targetDate: "2026-08-31" });
		await setDates(ranking, { targetDate: "2026-08-31" });
		const surface = calendar();
		const all = await surface.view({
			calendarDay: "2026-08-31",
			view: "Day",
		});
		expect(all.projectId).toBeNull();
		expect(all.positions.map((row) => row.id).sort()).toEqual(
			[intake.id, ranking.id].sort()
		);
		const scoped = await surface.view({
			calendarDay: "2026-08-31",
			projectId: payments.id,
			view: "Day",
		});
		expect(scoped.projectId).toBe(payments.id);
		expect(scoped.positions.map((row) => row.id)).toEqual([intake.id]);
	});

	it("does not hide Work, auto-start it, or write status when Planned start is present", async () => {
		const payments = await openProject("Payments");
		const intake = await openWork(payments.id, "Intake checkout");
		expect(intake.status).toBe("Not Started");
		await setDates(intake, { plannedStart: "2026-08-31" });
		const before = await getWork(prisma, intake.id);
		const view = await calendar().view({
			calendarDay: "2026-08-31",
			view: "Day",
		});
		expect(view.positions).toEqual([
			expect.objectContaining({
				id: intake.id,
				kind: "Planned start",
			}),
		]);
		expect(view.plannedStart.writesStatus).toBe(false);
		expect(view.plannedStart.hidesWork).toBe(false);
		expect(view.plannedStart.autoStarts).toBe(false);
		const after = await getWork(prisma, intake.id);
		expect(after?.status).toBe(before?.status);
		expect(after?.status).toBe("Not Started");
		const progressed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: after?.revision ?? 1,
			idempotencyKey: `status-${intake.id}`,
			origin: "human",
			status: "In Progress",
			workId: intake.id,
		});
		expect(progressed).toMatchObject({
			status: "committed",
			work: { id: intake.id, status: "In Progress" },
		});
		const stillVisible = await calendar().view({
			calendarDay: "2026-08-31",
			view: "Day",
		});
		expect(stillVisible.positions.map((row) => row.id)).toContain(intake.id);
	});
});
