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
	createWork,
	getWork,
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createDailyFocus } from "./daily-focus";
import {
	CANDIDATE_COUNTERPARTS,
	CANDIDATE_REASON,
	DAILY_FOCUS_COPY,
	DAILY_FOCUS_PLANNING_WRITES,
	dailyFocusCatalog,
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
			candidateCounterparts: CANDIDATE_COUNTERPARTS,
			copy: {
				accept: "Accept",
				add: "Add",
				candidates: "Candidates",
				dailyFocus: "Daily Focus",
				empty: "No Work in Daily Focus for this day.",
				loading: "Loading…",
				reappearDateArrived: "Reappear date has arrived",
				reject: "Reject",
				remove: "Remove",
				selectedDay: "Selected day",
				targetDateNear: "Target date is near",
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
		expect(DAILY_FOCUS_COPY.candidates).toBe("Candidates");
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
		await prisma.dailyFocusCandidateRejection.deleteMany({
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

	it("explains Candidates by Target date or Reappear date without making them members", async () => {
		const payments = await openProject("Payments");
		const near = await openWork(payments.id, "Near target");
		const arrived = await openWork(payments.id, "Reappear today");
		const later = await openWork(payments.id, "Far target");
		const futureReappear = await openWork(payments.id, "Reappear later");
		await prisma.work.update({
			data: { targetDate: "2026-09-03" },
			where: { id: near.id },
		});
		await prisma.work.update({
			data: { reappearDate: "2026-08-31" },
			where: { id: arrived.id },
		});
		await prisma.work.update({
			data: { targetDate: "2026-09-20" },
			where: { id: later.id },
		});
		await prisma.work.update({
			data: { reappearDate: "2026-09-10" },
			where: { id: futureReappear.id },
		});
		const view = await focus().view();
		expect(view.copy.candidates).toBe("Candidates");
		expect(view.candidateCounterparts).toEqual(CANDIDATE_COUNTERPARTS);
		expect(view.members).toEqual([]);
		expect(view.candidates).toEqual([
			expect.objectContaining({
				id: arrived.id,
				reason: CANDIDATE_REASON.reappearDate,
				title: "Reappear today",
			}),
			expect.objectContaining({
				id: near.id,
				reason: CANDIDATE_REASON.targetDate,
				title: "Near target",
			}),
		]);
		expect(view.candidates.map((row) => row.id)).not.toContain(later.id);
		expect(view.candidates.map((row) => row.id)).not.toContain(
			futureReappear.id
		);
		expect(view.candidates.every((row) => row.reason.length > 0)).toBe(true);
	});

	it("lists Candidates when the Prisma client has no rejection delegate", async () => {
		const payments = await openProject("Payments");
		const near = await openWork(payments.id, "Near without delegate");
		await prisma.work.update({
			data: { targetDate: "2026-08-31" },
			where: { id: near.id },
		});
		const withoutRejection = new Proxy(prisma, {
			get(target, prop, receiver) {
				if (prop === "dailyFocusCandidateRejection") {
					return;
				}
				if (prop === "$transaction") {
					return (fn: (tx: typeof prisma) => unknown, options?: unknown) =>
						target.$transaction(async (tx) => {
							const inner = new Proxy(tx, {
								get(innerTarget, innerProp, innerReceiver) {
									if (innerProp === "dailyFocusCandidateRejection") {
										return;
									}
									return Reflect.get(innerTarget, innerProp, innerReceiver);
								},
							});
							return await fn(inner as typeof prisma);
						}, options as never);
				}
				return Reflect.get(target, prop, receiver);
			},
		}) as typeof prisma;
		const surface = createDailyFocus({
			accountId: actorId,
			clock: { now: () => TODAY },
			prisma: withoutRejection,
			workspaceId,
		});
		const view = await surface.view();
		expect(view.candidates).toEqual([
			expect.objectContaining({
				id: near.id,
				reason: CANDIDATE_REASON.targetDate,
			}),
		]);
	});

	it("accepts a candidate into the selected day and rejects without membership or status write", async () => {
		const payments = await openProject("Payments");
		const acceptWork = await openWork(payments.id, "Accept me");
		const rejectWork = await openWork(payments.id, "Reject me");
		await prisma.work.update({
			data: { targetDate: "2026-08-31" },
			where: { id: acceptWork.id },
		});
		await prisma.work.update({
			data: { reappearDate: "2026-08-30" },
			where: { id: rejectWork.id },
		});
		const beforeAccept = await getWork(prisma, acceptWork.id);
		const beforeReject = await getWork(prisma, rejectWork.id);
		const beforePriority = await prisma.projectPriorityCriterionValue.count({
			where: { workId: { in: [acceptWork.id, rejectWork.id] } },
		});
		const beforeStages = payments.stages.map((stage) => ({
			id: stage.id,
			name: stage.name,
			sortOrder: stage.sortOrder,
			state: stage.state,
		}));
		const beforeList = (await listWork(prisma, payments.id)).map(
			(row) => row.id
		);
		const surface = focus();

		const accepted = await surface.accept({
			idempotencyKey: crypto.randomUUID(),
			workId: acceptWork.id,
		});
		const rejected = await surface.reject({
			idempotencyKey: crypto.randomUUID(),
			workId: rejectWork.id,
		});
		expect(accepted.status).toBe("committed");
		expect(rejected.status).toBe("committed");

		const view = await surface.view();
		expect(view.members.map((row) => row.id)).toEqual([acceptWork.id]);
		expect(view.candidates.map((row) => row.id)).not.toContain(acceptWork.id);
		expect(view.candidates.map((row) => row.id)).not.toContain(rejectWork.id);
		expect(view.planningWrites).toEqual(DAILY_FOCUS_PLANNING_WRITES);
		expect(view.candidateCounterparts).toEqual({
			backlogMembership: false,
			calendarEvent: false,
			focusPeriod: false,
		});
		expect(await getWork(prisma, acceptWork.id)).toMatchObject({
			revision: beforeAccept?.revision,
			status: "Not Started",
		});
		expect(await getWork(prisma, rejectWork.id)).toMatchObject({
			revision: beforeReject?.revision,
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
		expect(
			await prisma.projectPriorityCriterionValue.count({
				where: { workId: { in: [acceptWork.id, rejectWork.id] } },
			})
		).toBe(beforePriority);
		expect(JSON.stringify(view)).not.toMatch(FORBIDDEN_SURFACE);
	});

	it("keeps Candidates to a small set and skips Work already in the day", async () => {
		const payments = await openProject("Payments");
		const titles = ["One", "Two", "Three", "Four", "Five", "Six", "Already in"];
		const works = await Promise.all(
			titles.map((title) => openWork(payments.id, title))
		);
		await Promise.all(
			works.map((work, index) =>
				prisma.work.update({
					data: { targetDate: `2026-09-0${(index % 5) + 1}` },
					where: { id: work.id },
				})
			)
		);
		const [, , , , , , member] = works;
		if (!member) {
			throw new Error("expected seventh Work");
		}
		const surface = focus();
		await surface.add({
			idempotencyKey: crypto.randomUUID(),
			workId: member.id,
		});
		const view = await surface.view();
		expect(view.candidates).toHaveLength(5);
		expect(view.candidates.map((row) => row.id)).not.toContain(member.id);
		expect(view.members.map((row) => row.id)).toEqual([member.id]);
	});
});
