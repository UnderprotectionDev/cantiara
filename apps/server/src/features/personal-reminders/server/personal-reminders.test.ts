/**
 * Personal Reminders seam — Hesap-scoped Hatırlatma on the closed
 * source list; origin reference is not ownership; create/cancel do
 * not write source life or planning membership; no sourceless or
 * dateless queue; a due Work Target date does not mint a reminder.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (kişisel bağlam: later attention is source-linked, not a plan change).
 */

import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listPreparedBacklog } from "../../backlog/server/backlog";
import { createDailyFocus } from "../../daily-focus/server/daily-focus";
import { createDocument } from "../../documents/server/documents";
import { DOCUMENT_SCOPE_KIND } from "../../documents/server/documents-model";
import { createFocusPeriod } from "../../focus-period/server/focus-period";
import { createProject } from "../../project-shell/server/project-shell";
import { createMilestone } from "../../roadmap-horizon/server/roadmap-horizon";
import {
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import { createPersonalReminders } from "./personal-reminders";
import {
	PERSONAL_REMINDER_ACTION,
	PERSONAL_REMINDER_LIFE,
	PERSONAL_REMINDER_SOURCE_TYPE,
	PERSONAL_REMINDER_SOURCE_TYPES,
	PERSONAL_REMINDERS_COPY,
	PERSONAL_REMINDERS_COUNTERPARTS,
	PERSONAL_REMINDERS_PLANNING_WRITES,
	personalRemindersCatalog,
} from "./personal-reminders-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FIRE_AT = "2026-09-10T15:00:00.000Z";
const FORBIDDEN_SURFACE =
	/Save for Later|standalone reminder|due-date|Target date|Yeniden görünme/i;

describe("Personal Reminders catalog", () => {
	it("exposes the closed source list, Hesap copy, and no queue counterparts", () => {
		expect(personalRemindersCatalog()).toEqual({
			actions: [
				PERSONAL_REMINDERS_COPY.remindMe,
				PERSONAL_REMINDERS_COPY.reviewLater,
			],
			copy: PERSONAL_REMINDERS_COPY,
			counterparts: PERSONAL_REMINDERS_COUNTERPARTS,
			kind: "personal-reminders",
			lives: [
				PERSONAL_REMINDERS_COPY.planned,
				PERSONAL_REMINDERS_COPY.cancelled,
			],
			planningWrites: PERSONAL_REMINDERS_PLANNING_WRITES,
			sourceTypes: PERSONAL_REMINDER_SOURCE_TYPES,
		});
		expect(PERSONAL_REMINDER_SOURCE_TYPES).toEqual([
			"Project",
			"Document",
			"Work",
			"Decision",
			"Risk",
			"Design",
			"Source",
			"Milestone",
			"Project Release",
			"Production Incident",
			"Test Gap",
		]);
		expect(PERSONAL_REMINDERS_COPY.remindMe).toBe("Remind me");
		expect(PERSONAL_REMINDERS_COPY.reviewLater).toBe("Review Later");
		expect(PERSONAL_REMINDERS_COPY.planned).toBe("Planned");
		expect(PERSONAL_REMINDERS_COPY.cancelled).toBe("Cancelled");
		expect(PERSONAL_REMINDERS_COUNTERPARTS.standaloneReminder).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.datelessQueue).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.saveForLaterQueue).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.dueDateSignal).toBe(false);
		expect(JSON.stringify(personalRemindersCatalog())).not.toMatch(
			FORBIDDEN_SURFACE
		);
	});
});

describe("Personal Reminders", () => {
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
		await prisma.personalReminder.deleteMany({
			where: { accountId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function surface() {
		return createPersonalReminders({
			accountId: actorId,
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

	async function snapshotWorkPlanning(workId: string, projectId: string) {
		const work = await getWork(prisma, workId);
		const row = await prisma.work.findUniqueOrThrow({
			select: { horizon: true },
			where: { id: workId },
		});
		const backlog = await listPreparedBacklog(prisma, projectId);
		const daily = await createDailyFocus({
			accountId: actorId,
			prisma,
			workspaceId,
		}).view();
		const periods = await createFocusPeriod({
			accountId: actorId,
			prisma,
			workspaceId,
		}).list();
		const project = await prisma.project.findUniqueOrThrow({
			include: { stages: { orderBy: { sortOrder: "asc" } } },
			where: { id: projectId },
		});
		return {
			backlogOrder: backlog.manualOrder,
			closureResult: work?.closureResult ?? null,
			dailyFocusIds: daily.members.map((member) => member.id),
			focusPeriodIds: periods.flatMap((period) =>
				period.members.map((member) => member.id)
			),
			horizon: row.horizon,
			plannedStart: work?.plannedStart ?? null,
			reappearDate: work?.reappearDate ?? null,
			stages: project.stages.map((stage) => ({
				id: stage.id,
				state: stage.state,
			})),
			status: work?.status,
			targetDate: work?.targetDate ?? null,
		};
	}

	it("puts a Planned Hesap-scoped reminder on Work with origin reference", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.reminder).toMatchObject({
			accountId: actorId,
			createdByAction: "Remind me",
			fireAt: FIRE_AT,
			life: "Planned",
			sourceId: work.id,
			sourceType: "Work",
		});
		expect(created.reminder).not.toHaveProperty("projectId");
		const listed = await surface().list();
		expect(listed).toEqual([created.reminder]);
		expect(listed[0]?.accountId).toBe(actorId);
	});

	it("stores Review Later as the creating action and lists Document, Project, and Milestone origins", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const document = await createDocument(prisma, {
			actorId,
			idempotencyKey: `doc-${actorId}`,
			origin: "human",
			payload: {
				scope: {
					kind: DOCUMENT_SCOPE_KIND.project,
					projectId: project.id,
				},
				title: "Spec",
			},
			workspaceId,
		});
		if (document.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const milestone = await createMilestone(prisma, {
			actorId,
			idempotencyKey: `ms-${actorId}`,
			projectId: project.id,
			title: "Launch",
		});
		if (milestone.status !== "committed") {
			throw new Error("expected committed Milestone");
		}
		const reminders = surface();
		const onWork = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		const onDocument = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: document.document.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.document,
		});
		const onProject = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: project.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.project,
		});
		const onMilestone = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: milestone.milestone.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.milestone,
		});
		expect(onWork.status).toBe("committed");
		expect(onDocument.status).toBe("committed");
		expect(onProject.status).toBe("committed");
		expect(onMilestone.status).toBe("committed");
		if (onWork.status !== "committed") {
			return;
		}
		expect(onWork.reminder.createdByAction).toBe("Review Later");
		const listed = await reminders.list();
		expect(listed.map((row) => row.sourceType).sort()).toEqual([
			"Document",
			"Milestone",
			"Project",
			"Work",
		]);
	});

	it("cancels a Planned reminder with an open action and keeps life Cancelled", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		const cancelled = await surface().cancel({
			idempotencyKey: crypto.randomUUID(),
			reminderId: created.reminder.id,
		});
		expect(cancelled.status).toBe("committed");
		if (cancelled.status !== "committed") {
			return;
		}
		expect(cancelled.reminder.life).toBe(PERSONAL_REMINDER_LIFE.cancelled);
		const listed = await surface().listForSource({
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		expect(listed.map((row) => row.life)).toEqual(["Cancelled"]);
	});

	it("does not treat a missing Work as a reminder write", async () => {
		const missing = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: crypto.randomUUID(),
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		expect(missing.status).toBe("not-found");
	});

	it("does not write Work status, Target date, Yeniden görünme tarihi, or planning membership", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `dates-${actorId}`,
			origin: "human",
			plannedStart: "2026-09-08",
			reappearDate: "2026-09-20",
			targetDate: "2026-09-15",
			workId: work.id,
		});
		await createDailyFocus({
			accountId: actorId,
			prisma,
			workspaceId,
		}).add({
			idempotencyKey: crypto.randomUUID(),
			workId: work.id,
		});
		const period = await createFocusPeriod({
			accountId: actorId,
			prisma,
			workspaceId,
		}).create({
			endDate: "2026-09-21",
			idempotencyKey: crypto.randomUUID(),
			purpose: "Ship window",
			startDate: "2026-09-08",
		});
		if (period.status !== "committed") {
			throw new Error("expected committed Focus Period");
		}
		await createFocusPeriod({
			accountId: actorId,
			prisma,
			workspaceId,
		}).add({
			idempotencyKey: crypto.randomUUID(),
			periodId: period.period.id,
			workId: work.id,
		});
		const before = await snapshotWorkPlanning(work.id, project.id);
		expect(before.targetDate).toBe("2026-09-15");
		expect(before.reappearDate).toBe("2026-09-20");
		expect(before.dailyFocusIds).toEqual([work.id]);
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		await surface().cancel({
			idempotencyKey: crypto.randomUUID(),
			reminderId: created.reminder.id,
		});
		expect(await snapshotWorkPlanning(work.id, project.id)).toEqual(before);
	});

	it("does not mint a Hatırlatma from a due Work Target date", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `due-${actorId}`,
			origin: "human",
			plannedStart: null,
			reappearDate: null,
			targetDate: "2020-01-01",
			workId: work.id,
		});
		expect(await surface().list()).toEqual([]);
		expect(
			await surface().listForSource({
				sourceId: work.id,
				sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
			})
		).toEqual([]);
		expect(personalRemindersCatalog().counterparts.dueDateSignal).toBe(false);
	});

	it("rejects a sourceless reminder, a dateless reminder, and an unsupported type", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const noSource = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: "",
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		const noTime = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: "",
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		const unsupported = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: "Capture Inbox" as never,
		});
		expect(noSource).toMatchObject({
			reason: PERSONAL_REMINDERS_COPY.sourceRequired,
			status: "invalid",
		});
		expect(noTime).toMatchObject({
			reason: PERSONAL_REMINDERS_COPY.timeRequired,
			status: "invalid",
		});
		expect(unsupported).toMatchObject({
			reason: PERSONAL_REMINDERS_COPY.unsupportedSource,
			status: "invalid",
		});
		expect(await reminders.list()).toEqual([]);
	});

	it("keeps origin on this Hesap and does not treat another account as owner", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		const otherActor = crypto.randomUUID();
		await prisma.user.create({
			data: {
				email: `${otherActor}@example.com`,
				emailVerified: true,
				id: otherActor,
				name: "Other",
			},
		});
		const otherWorkspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Other",
				ownerId: otherActor,
			},
		});
		const other = createPersonalReminders({
			accountId: otherActor,
			prisma,
			workspaceId: otherWorkspace.id,
		});
		expect(await other.list()).toEqual([]);
		const steal = await other.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		expect(steal.status).toBe("not-found");
		await prisma.personalReminder.deleteMany({
			where: { accountId: otherActor },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: otherActor } });
		await prisma.user.deleteMany({ where: { id: otherActor } });
	});
});
