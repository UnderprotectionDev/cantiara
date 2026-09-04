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
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listPreparedBacklog } from "../../backlog/server/backlog";
import { createDailyFocus } from "../../daily-focus/server/daily-focus";
import {
	createDecision,
	withdrawDecision,
} from "../../decisions/server/decisions";
import {
	createDocument,
	updateDocument,
} from "../../documents/server/documents";
import { listHeadingSections } from "../../documents/server/documents-live";
import { DOCUMENT_SCOPE_KIND } from "../../documents/server/documents-model";
import { createFocusPeriod } from "../../focus-period/server/focus-period";
import { createProject } from "../../project-shell/server/project-shell";
import { createMilestone } from "../../roadmap-horizon/server/roadmap-horizon";
import {
	closeWork,
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import { createPersonalReminders } from "./personal-reminders";
import {
	PERSONAL_REMINDER_ACTION,
	PERSONAL_REMINDER_CONDITION,
	PERSONAL_REMINDER_LIFE,
	PERSONAL_REMINDER_SOURCE_TYPE,
	PERSONAL_REMINDER_SOURCE_TYPES,
	PERSONAL_REMINDERS_COPY,
	PERSONAL_REMINDERS_COUNTERPARTS,
	PERSONAL_REMINDERS_PLANNING_WRITES,
	personalRemindersCatalog,
} from "./personal-reminders-model";

const DATABASE_URL = localTestDatabaseUrl();

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
			conditions: [
				PERSONAL_REMINDERS_COPY.inAnyCase,
				PERSONAL_REMINDERS_COPY.onlyIfStillOpen,
			],
			copy: PERSONAL_REMINDERS_COPY,
			counterparts: PERSONAL_REMINDERS_COUNTERPARTS,
			kind: "personal-reminders",
			lives: [
				PERSONAL_REMINDERS_COPY.planned,
				PERSONAL_REMINDERS_COPY.triggered,
				PERSONAL_REMINDERS_COPY.cancelled,
			],
			planningWrites: PERSONAL_REMINDERS_PLANNING_WRITES,
			signalIds: ["personal-reminder", "review-later"],
			sourceTypes: PERSONAL_REMINDER_SOURCE_TYPES,
			stillOpenSourceTypes: ["Work", "Decision", "Milestone"],
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
		expect(PERSONAL_REMINDERS_COPY.triggered).toBe("Triggered");
		expect(PERSONAL_REMINDERS_COPY.cancelled).toBe("Cancelled");
		expect(PERSONAL_REMINDERS_COPY.dismiss).toBe("Dismiss");
		expect(PERSONAL_REMINDERS_COPY.inAnyCase).toBe("In any case");
		expect(PERSONAL_REMINDERS_COPY.onlyIfStillOpen).toBe("Only if still open");
		expect(PERSONAL_REMINDERS_COPY.missingSection).toBe(
			"This section is missing."
		);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.standaloneReminder).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.datelessQueue).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.saveForLaterQueue).toBe(false);
		expect(PERSONAL_REMINDERS_COUNTERPARTS.dueDateSignal).toBe(false);
		expect(JSON.stringify(personalRemindersCatalog())).not.toMatch(
			FORBIDDEN_SURFACE
		);
		expect(personalRemindersCatalog().signalIds).not.toContain("due-date");
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
			documentSectionId: null,
			fireAt: FIRE_AT,
			life: "Planned",
			openTarget: { kind: "record" },
			sourceId: work.id,
			sourceType: "Work",
			stillOpenCondition: "In any case",
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

	it("binds Review Later on a Document to a stable heading id across rename and move", async () => {
		const project = await openProject("Alpha");
		const createdDoc = await createDocument(prisma, {
			actorId,
			idempotencyKey: `doc-section-${actorId}`,
			origin: "human",
			payload: {
				body: "# Risks\n\nWatch this.\n\n# Later\n\nOther.",
				scope: {
					kind: DOCUMENT_SCOPE_KIND.project,
					projectId: project.id,
				},
				title: "Spec",
			},
			workspaceId,
		});
		if (createdDoc.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const [risks, later] = listHeadingSections(createdDoc.document.body);
		if (!(risks && later)) {
			throw new Error("expected two heading sections");
		}
		const risksId = risks.sectionId;
		const laterId = later.sectionId;
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			documentSectionId: risksId,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: createdDoc.document.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.document,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			return;
		}
		expect(created.reminder.createdByAction).toBe("Review Later");
		expect(created.reminder.documentSectionId).toBe(risksId);
		expect(created.reminder.openTarget).toEqual({
			heading: "Risks",
			kind: "document-section",
			sectionId: risksId,
		});
		const renamed = await updateDocument(prisma, {
			actorId,
			baseRevision: createdDoc.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: `# Threats {#${risksId}}\n\nWatch this.\n\n# Later {#${laterId}}\n\nOther.`,
				documentId: createdDoc.document.id,
			},
			workspaceId,
		});
		if (renamed.status !== "committed") {
			throw new Error("expected renamed Document");
		}
		const afterRename = await surface().get(created.reminder.id);
		expect(afterRename?.openTarget).toEqual({
			heading: "Threats",
			kind: "document-section",
			sectionId: risksId,
		});
		const moved = await updateDocument(prisma, {
			actorId,
			baseRevision: renamed.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: `# Later {#${laterId}}\n\nOther.\n\n# Threats {#${risksId}}\n\nWatch this.`,
				documentId: createdDoc.document.id,
			},
			workspaceId,
		});
		if (moved.status !== "committed") {
			throw new Error("expected moved Document");
		}
		const afterMove = await surface().get(created.reminder.id);
		expect(afterMove?.openTarget).toEqual({
			heading: "Threats",
			kind: "document-section",
			sectionId: risksId,
		});
		expect(afterMove?.openTarget).not.toMatchObject({ sectionId: laterId });
	});

	it("opens the Document and explains a missing section instead of retargeting", async () => {
		const project = await openProject("Alpha");
		const createdDoc = await createDocument(prisma, {
			actorId,
			idempotencyKey: `doc-missing-${actorId}`,
			origin: "human",
			payload: {
				body: "# Risks\n\nWatch this.\n\n# Later\n\nOther.",
				scope: {
					kind: DOCUMENT_SCOPE_KIND.project,
					projectId: project.id,
				},
				title: "Spec",
			},
			workspaceId,
		});
		if (createdDoc.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const [risks, later] = listHeadingSections(createdDoc.document.body);
		if (!(risks && later)) {
			throw new Error("expected two heading sections");
		}
		const risksId = risks.sectionId;
		const laterId = later.sectionId;
		const created = await surface().create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			documentSectionId: risksId,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: createdDoc.document.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.document,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		const deleted = await updateDocument(prisma, {
			actorId,
			baseRevision: createdDoc.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: `# Later {#${laterId}}\n\nOther.`,
				documentId: createdDoc.document.id,
			},
			workspaceId,
		});
		if (deleted.status !== "committed") {
			throw new Error("expected Document without Risks");
		}
		const listed = await surface().listForSource({
			sourceId: createdDoc.document.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.document,
		});
		expect(listed[0]?.openTarget).toEqual({
			explanation: PERSONAL_REMINDERS_COPY.missingSection,
			kind: "missing-section",
			sectionId: risksId,
		});
		expect(listed[0]?.openTarget).not.toMatchObject({
			kind: "document-section",
			sectionId: laterId,
		});
		const opened = await surface().openTarget(created.reminder.id);
		expect(opened).toEqual({
			documentId: createdDoc.document.id,
			explanation: PERSONAL_REMINDERS_COPY.missingSection,
			kind: "missing-section",
			sectionId: risksId,
		});
	});

	it("defaults In any case and reads Only if still open from the source life", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const unconditional = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (unconditional.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		expect(unconditional.reminder.stillOpenCondition).toBe("In any case");
		const stillOpen = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
			stillOpenCondition: PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
		});
		if (stillOpen.status !== "committed") {
			throw new Error("expected committed still-open reminder");
		}
		expect(
			await reminders.evaluateCondition(unconditional.reminder.id)
		).toEqual({
			condition: "In any case",
			holds: true,
			reason: null,
			sourceLife: "open",
			status: "evaluated",
		});
		expect(await reminders.evaluateCondition(stillOpen.reminder.id)).toEqual({
			condition: "Only if still open",
			holds: true,
			reason: null,
			sourceLife: "open",
			status: "evaluated",
		});
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `close-${actorId}`,
			origin: "human",
			result: "Completed",
			workId: work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		expect(
			await reminders.evaluateCondition(unconditional.reminder.id)
		).toEqual({
			condition: "In any case",
			holds: true,
			reason: null,
			sourceLife: "resolved",
			status: "evaluated",
		});
		expect(await reminders.evaluateCondition(stillOpen.reminder.id)).toEqual({
			condition: "Only if still open",
			holds: false,
			reason: PERSONAL_REMINDERS_COPY.sourceNoLongerOpen,
			sourceLife: "resolved",
			status: "evaluated",
		});
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: `decision-${actorId}`,
			origin: "human",
			payload: {
				decision: "Ship now",
				projectId: project.id,
				rationale: "Window",
				title: "Go",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected committed Decision");
		}
		const onDecision = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: decision.decision.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.decision,
			stillOpenCondition: PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
		});
		if (onDecision.status !== "committed") {
			throw new Error("expected committed Decision reminder");
		}
		expect(
			await reminders.evaluateCondition(onDecision.reminder.id)
		).toMatchObject({
			holds: true,
			sourceLife: "open",
			status: "evaluated",
		});
		const withdrawn = await withdrawDecision(prisma, {
			actorId,
			baseRevision: decision.decision.revision,
			idempotencyKey: `withdraw-${actorId}`,
			origin: "human",
			payload: { decisionId: decision.decision.id },
		});
		if (withdrawn.status !== "committed") {
			throw new Error("expected withdrawn Decision");
		}
		expect(await reminders.evaluateCondition(onDecision.reminder.id)).toEqual({
			condition: "Only if still open",
			holds: false,
			reason: PERSONAL_REMINDERS_COPY.sourceNoLongerOpen,
			sourceLife: "resolved",
			status: "evaluated",
		});
		const document = await createDocument(prisma, {
			actorId,
			idempotencyKey: `doc-condition-${actorId}`,
			origin: "human",
			payload: {
				scope: {
					kind: DOCUMENT_SCOPE_KIND.project,
					projectId: project.id,
				},
				title: "Notes",
			},
			workspaceId,
		});
		if (document.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const onDocument = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: document.document.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.document,
			stillOpenCondition: PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
		});
		expect(onDocument).toMatchObject({
			reason: PERSONAL_REMINDERS_COPY.stillOpenNeedsDefinedLife,
			status: "invalid",
		});
	});

	it("lets Reassess impact create the same Review Later and creates nothing without a date", async () => {
		const reminders = surface();
		const skipped = await reminders.createFromReassessImpact({
			fireAt: null,
			idempotencyKey: crypto.randomUUID(),
			projectReleaseId: crypto.randomUUID(),
		});
		expect(skipped).toEqual({ status: "skipped" });
		expect(await reminders.list()).toEqual([]);
		const missing = await reminders.createFromReassessImpact({
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			projectReleaseId: crypto.randomUUID(),
		});
		expect(missing.status).toBe("not-found");
		expect(await reminders.list()).toEqual([]);
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const dated = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (dated.status !== "committed") {
			throw new Error("expected committed Review Later");
		}
		expect(dated.reminder.createdByAction).toBe("Review Later");
		expect(personalRemindersCatalog().counterparts.dueDateSignal).toBe(false);
		const after = await snapshotWorkPlanning(work.id, project.id);
		expect(after.targetDate).toBeNull();
		expect(after.reappearDate).toBeNull();
	});
});

describe("Personal Reminders fire", () => {
	let actorId: string;
	let prisma: PrismaClient;
	let pool: Pool;
	let workspaceId: string;
	let now: Date;
	let scheduler: {
		cancel: (reminderId: string) => Promise<void>;
		dueIds: (instant: Date) => Promise<string[]>;
		schedule: (reminderId: string, fireAt: Date) => Promise<void>;
		scheduled: Map<string, Date>;
	};

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		actorId = crypto.randomUUID();
		now = new Date("2026-09-10T15:00:00.000Z");
		const scheduled = new Map<string, Date>();
		scheduler = {
			cancel: (reminderId) => {
				scheduled.delete(reminderId);
				return Promise.resolve();
			},
			dueIds: (instant) =>
				Promise.resolve(
					[...scheduled.entries()]
						.filter(([, fireAt]) => fireAt.getTime() <= instant.getTime())
						.map(([id]) => id)
				),
			schedule: (reminderId, fireAt) => {
				scheduled.set(reminderId, fireAt);
				return Promise.resolve();
			},
			scheduled,
		};
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
			clock: { now: () => now },
			prisma,
			scheduler,
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
			workCount: await prisma.work.count({ where: { projectId } }),
		};
	}

	it("fires Remind me as personal-reminder and Review Later as review-later, never both", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const remind = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		const review = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (remind.status !== "committed" || review.status !== "committed") {
			throw new Error("expected committed reminders");
		}
		expect(scheduler.scheduled.has(remind.reminder.id)).toBe(true);
		now = new Date("2026-09-10T14:59:59.000Z");
		await reminders.fireDue();
		expect(await reminders.listSignals()).toEqual([]);
		now = new Date("2026-09-10T15:00:00.000Z");
		await reminders.fireDue();
		const signals = await reminders.listSignals();
		expect(signals.map((signal) => signal.signalId).sort()).toEqual([
			"personal-reminder",
			"review-later",
		]);
		expect(signals).toHaveLength(2);
		expect(
			signals.find((signal) => signal.reminderId === remind.reminder.id)
				?.signalId
		).toBe("personal-reminder");
		expect(
			signals.find((signal) => signal.reminderId === review.reminder.id)
				?.signalId
		).toBe("review-later");
		expect(signals.map((signal) => signal.signalId)).not.toContain("due-date");
		expect((await reminders.get(remind.reminder.id))?.life).toBe("Triggered");
		expect((await reminders.get(review.reminder.id))?.life).toBe("Triggered");
		const opened = await reminders.openTarget(review.reminder.id);
		expect(opened).toMatchObject({
			kind: "record",
			sourceId: work.id,
			sourceType: "Work",
		});
		const due = await reminders.listDue();
		expect(due.map((row) => row.id)).toEqual([review.reminder.id]);
		expect(due[0]?.openTarget).toEqual({ kind: "record" });
		await reminders.fireDue();
		expect(await reminders.listSignals()).toHaveLength(2);
	});

	it("does not mint due-date or a Hatırlatma from a due Work Target date", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `due-fire-${actorId}`,
			origin: "human",
			plannedStart: null,
			reappearDate: null,
			targetDate: "2020-01-01",
			workId: work.id,
		});
		await surface().fireDue();
		expect(await surface().list()).toEqual([]);
		expect(await surface().listSignals()).toEqual([]);
		expect(await snapshotWorkPlanning(work.id, project.id)).toMatchObject({
			targetDate: "2020-01-01",
		});
	});

	it("suppresses Only if still open when the source is resolved and records why", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const created = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
			stillOpenCondition: PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: `close-fire-${actorId}`,
			origin: "human",
			result: "Completed",
			workId: work.id,
		});
		if (closed.status !== "committed") {
			throw new Error("expected closed Work");
		}
		await reminders.fireDue();
		expect(await reminders.listSignals()).toEqual([]);
		expect((await reminders.get(created.reminder.id))?.life).toBe("Planned");
		expect(await reminders.history(created.reminder.id)).toEqual([
			expect.objectContaining({
				kind: "suppressed",
				reason: PERSONAL_REMINDERS_COPY.sourceNoLongerOpen,
				signalId: null,
				sourceLife: "resolved",
			}),
		]);
	});

	it("emits a source-linked unevaluable signal instead of dropping the row", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const created = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
			stillOpenCondition: PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		await prisma.work.delete({ where: { id: work.id } });
		await reminders.fireDue();
		const listed = await reminders.list();
		expect(listed).toHaveLength(1);
		expect(listed[0]?.life).toBe("Triggered");
		expect(listed[0]?.openTarget).toEqual({
			kind: "broken-reference",
			reason: PERSONAL_REMINDERS_COPY.permanentlyDeleted,
		});
		const signals = await reminders.listSignals();
		expect(signals).toEqual([
			{
				dismissed: false,
				reason: PERSONAL_REMINDERS_COPY.couldNotEvaluate,
				reminderId: created.reminder.id,
				signalId: "personal-reminder",
				sourceId: work.id,
				sourceType: "Work",
			},
		]);
		expect(await reminders.openTarget(created.reminder.id)).toEqual({
			kind: "broken-reference",
			reason: PERSONAL_REMINDERS_COPY.permanentlyDeleted,
			sourceId: work.id,
			sourceType: "Work",
		});
	});

	it("does not fire toward an archived Project", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const created = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		await prisma.project.update({
			data: { archivedAt: new Date("2026-09-10T12:00:00.000Z") },
			where: { id: project.id },
		});
		await reminders.fireDue();
		expect(await reminders.listSignals()).toEqual([]);
		expect((await reminders.get(created.reminder.id))?.life).toBe("Planned");
		expect(await reminders.history(created.reminder.id)).toEqual([
			expect.objectContaining({
				kind: "archive-stopped",
				reason: PERSONAL_REMINDERS_COPY.archivedProject,
				signalId: null,
				sourceLife: null,
			}),
		]);
	});

	it("dismisses and reschedules without writing Work, copies, or planning membership", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const reminders = surface();
		const created = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.reviewLater,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed reminder");
		}
		await reminders.fireDue();
		const before = await snapshotWorkPlanning(work.id, project.id);
		const dismissed = await reminders.dismiss({
			idempotencyKey: crypto.randomUUID(),
			reminderId: created.reminder.id,
		});
		expect(dismissed.status).toBe("committed");
		if (dismissed.status !== "committed") {
			return;
		}
		expect(dismissed.reminder.life).toBe("Triggered");
		expect(await reminders.listSignals()).toEqual([]);
		expect(await reminders.listDue()).toEqual([]);
		expect(await snapshotWorkPlanning(work.id, project.id)).toEqual(before);
		const again = await reminders.create({
			createdByAction: PERSONAL_REMINDER_ACTION.remindMe,
			fireAt: FIRE_AT,
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: PERSONAL_REMINDER_SOURCE_TYPE.work,
		});
		if (again.status !== "committed") {
			throw new Error("expected second reminder");
		}
		await reminders.fireDue();
		const nextFire = "2026-09-11T09:00:00.000Z";
		const moved = await reminders.reschedule({
			fireAt: nextFire,
			idempotencyKey: crypto.randomUUID(),
			reminderId: again.reminder.id,
		});
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			return;
		}
		expect(moved.reminder.life).toBe("Planned");
		expect(moved.reminder.fireAt).toBe(nextFire);
		expect(scheduler.scheduled.get(again.reminder.id)?.toISOString()).toBe(
			nextFire
		);
		expect(await reminders.listSignals()).toEqual([]);
		expect((await getWork(prisma, work.id))?.status).toBe(before.status);
		expect(await snapshotWorkPlanning(work.id, project.id)).toEqual(before);
	});
});
