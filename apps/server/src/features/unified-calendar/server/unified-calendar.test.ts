/**
 * Unified Calendar seam — Day, Week, Month, and Agenda present the same
 * dated Work records with Planned start, Target date, and Reappear
 * date kept as separate kinds. Week/month show a start+target range;
 * Day shows only that day's positions. Agenda is a chronological dense
 * list of the same kinds, not an Event record or Agenda membership.
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
	presentCalendarDays,
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
			views: ["Day", "Week", "Month", "Agenda"],
		});
		expect(UNIFIED_CALENDAR_COPY.calendar).toBe("Calendar");
		expect(UNIFIED_CALENDAR_COPY.day).toBe("Day");
		expect(UNIFIED_CALENDAR_COPY.week).toBe("Week");
		expect(UNIFIED_CALENDAR_COPY.month).toBe("Month");
		expect(UNIFIED_CALENDAR_COPY.agenda).toBe("Agenda");
		expect(UNIFIED_CALENDAR_COPY.openSourceRecord).toBe("Open source record");
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

	it("keeps start-only and start+reappear as positions, never a range", () => {
		const weekWindow = {
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Week" as const,
		};
		const startOnly = presentCalendarWindow({
			...weekWindow,
			works: [{ ...SPAN_WORK, reappearDate: null, targetDate: null }],
		});
		expect(startOnly.ranges).toEqual([]);
		expect(startOnly.positions).toEqual([
			{
				date: "2026-08-31",
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				kind: "Planned start",
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				title: SPAN_WORK.title,
			},
		]);

		const startAndReappear = presentCalendarWindow({
			...weekWindow,
			works: [{ ...SPAN_WORK, targetDate: null }],
		});
		expect(startAndReappear.ranges).toEqual([]);
		expect(
			startAndReappear.positions
				.map((row) => row.kind)
				.toSorted((left, right) => left.localeCompare(right))
		).toEqual(["Planned start", "Reappear date"]);
	});

	it("places a week range on each spanned day and keeps Day as positions only", () => {
		const week = presentCalendarDays({
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Week",
			works: [SPAN_WORK],
		});
		expect(week.map((day) => day.date)).toEqual([
			"2026-08-31",
			"2026-09-01",
			"2026-09-02",
			"2026-09-03",
			"2026-09-04",
			"2026-09-05",
			"2026-09-06",
		]);
		const spanned = week.filter((day) =>
			day.ranges.some((range) => range.id === SPAN_WORK.id)
		);
		expect(spanned.map((day) => day.date)).toEqual([
			"2026-08-31",
			"2026-09-01",
			"2026-09-02",
			"2026-09-03",
			"2026-09-04",
		]);
		expect(week.find((day) => day.date === "2026-09-01")?.positions).toEqual(
			[]
		);
		expect(week.find((day) => day.date === "2026-09-02")?.positions).toEqual([
			expect.objectContaining({ kind: "Reappear date" }),
		]);

		const plannedStartDay = presentCalendarDays({
			calendarDay: "2026-08-31",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Day",
			works: [SPAN_WORK],
		});
		expect(plannedStartDay).toEqual([
			{
				date: "2026-08-31",
				positions: [
					expect.objectContaining({
						date: "2026-08-31",
						kind: "Planned start",
					}),
				],
				ranges: [],
			},
		]);

		const targetDay = presentCalendarDays({
			calendarDay: "2026-09-04",
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
			view: "Day",
			works: [SPAN_WORK],
		});
		expect(targetDay[0]?.ranges).toEqual([]);
		expect(targetDay[0]?.positions.map((row) => row.kind)).toEqual([
			"Target date",
		]);
	});

	it("presents Agenda as a chronological dense list of the same kinds, not a range or Event", () => {
		const agenda = presentCalendarWindow({
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-30",
			rangeStart: "2026-09-01",
			view: "Agenda",
			works: [SPAN_WORK],
		});
		expect(agenda.ranges).toEqual([]);
		expect(agenda.positions).toEqual([
			{
				date: "2026-09-02",
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				kind: "Reappear date",
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				title: SPAN_WORK.title,
			},
			{
				date: "2026-09-04",
				id: SPAN_WORK.id,
				key: SPAN_WORK.key,
				kind: "Target date",
				projectId: SPAN_WORK.projectId,
				projectName: SPAN_WORK.projectName,
				title: SPAN_WORK.title,
			},
		]);
		expect(agenda.positions.every((row) => row.id === SPAN_WORK.id)).toBe(true);

		const dense = presentCalendarDays({
			calendarDay: "2026-09-02",
			rangeEnd: "2026-09-30",
			rangeStart: "2026-09-01",
			view: "Agenda",
			works: [SPAN_WORK],
		});
		expect(dense.map((day) => day.date)).toEqual(["2026-09-02", "2026-09-04"]);
		expect(dense.every((day) => day.ranges.length === 0)).toBe(true);
	});

	it("keeps the same date-kind filter on Week and Agenda", () => {
		const window = {
			calendarDay: "2026-09-02",
			dateKinds: ["Reappear date"] as const,
			rangeEnd: "2026-09-06",
			rangeStart: "2026-08-31",
		};
		const week = presentCalendarWindow({
			...window,
			view: "Week",
			works: [SPAN_WORK],
		});
		const agenda = presentCalendarWindow({
			...window,
			view: "Agenda",
			works: [SPAN_WORK],
		});
		expect(week.ranges).toEqual([]);
		expect(week.positions).toEqual([
			expect.objectContaining({
				date: "2026-09-02",
				id: SPAN_WORK.id,
				kind: "Reappear date",
			}),
		]);
		expect(agenda.ranges).toEqual([]);
		expect(agenda.positions).toEqual(week.positions);
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
		expect(
			week.days
				.filter((slice) => slice.ranges.some((range) => range.id === intake.id))
				.map((slice) => slice.date)
		).toEqual([
			"2026-08-31",
			"2026-09-01",
			"2026-09-02",
			"2026-09-03",
			"2026-09-04",
		]);
		const startDay = await surface.view({
			calendarDay: "2026-08-31",
			view: "Day",
		});
		expect(startDay.days).toEqual([
			expect.objectContaining({
				date: "2026-08-31",
				ranges: [],
			}),
		]);
		expect(startDay.days[0]?.positions.map((row) => row.kind)).toEqual([
			"Planned start",
		]);
		expect(startDay.ranges).toEqual([]);
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

	it("shows Agenda as the same scoped Work positions with Open source record, without an Event or Agenda membership", async () => {
		const payments = await openProject("Payments");
		const search = await openProject("Search");
		const intake = await openWork(payments.id, "Intake checkout");
		const ranking = await openWork(search.id, "Ranking query");
		await setDates(intake, {
			plannedStart: "2026-08-31",
			reappearDate: "2026-09-02",
			targetDate: "2026-09-04",
		});
		await setDates(ranking, { targetDate: "2026-09-03" });
		const surface = calendar();
		const month = await surface.view({
			calendarDay: "2026-09-02",
			projectId: payments.id,
			view: "Month",
		});
		const agenda = await surface.view({
			calendarDay: "2026-09-02",
			projectId: payments.id,
			view: "Agenda",
		});
		const filtered = await surface.view({
			calendarDay: "2026-09-02",
			dateKinds: ["Reappear date"],
			projectId: payments.id,
			view: "Agenda",
		});
		expect(agenda.view).toBe("Agenda");
		expect(agenda.eventRecord).toBe(false);
		expect(agenda.agenda.membership).toBe(false);
		expect(agenda.agenda.newDateField).toBe(false);
		expect(agenda.copy.openSourceRecord).toBe("Open source record");
		expect(agenda.ranges).toEqual([]);
		expect(agenda.positions.map((row) => row.id)).toEqual([
			intake.id,
			intake.id,
		]);
		expect(agenda.positions.map((row) => row.kind)).toEqual([
			"Reappear date",
			"Target date",
		]);
		expect(month.projectId).toBe(payments.id);
		expect(new Set(month.ranges.map((row) => row.id))).toEqual(
			new Set([intake.id])
		);
		expect(filtered.positions).toEqual([
			expect.objectContaining({
				id: intake.id,
				kind: "Reappear date",
			}),
		]);
		const worksAfter = await prisma.work.findMany({
			where: { project: { workspaceId } },
		});
		expect(worksAfter.map((row) => row.id).sort()).toEqual(
			[intake.id, ranking.id].sort()
		);
	});
});
