/**
 * Return to Work seam — current-record return cards with why-shown,
 * optional Next concrete step on the Project or Work source, and no
 * auto-write from status / priority / date / planning / stage.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (kişisel bağlam: session set is not this summary).
 */

import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { reorderManualOrder } from "../../backlog/server/backlog";
import {
	createPriorityCriterion,
	setPriorityCriterionValue,
} from "../../priority/server/priority";
import {
	configureProject,
	createProject,
	getProject,
} from "../../project-shell/server/project-shell";
import {
	listSmartCollections,
	viewSmartCollection,
} from "../../smart-collections/server/smart-collections";
import {
	applyPlanningMembership,
	changeWorkStatus,
	closeWork,
	createWork,
	getWork,
	listWork,
	updateWorkPlanningDates,
	updateWorkTitle,
} from "../../work-lifecycle/server/work-lifecycle";
import { createReturnToWork } from "./return-to-work";
import {
	CARD_REASON,
	LONG_IN_THE_SAME_STATUS_CONTRACT,
	NEXT_CONCRETE_STEP_CONTRACT,
	RETURN_TO_WORK_COPY,
	RETURN_TO_WORK_RESTORES,
	RETURN_TO_WORK_SESSION,
	returnToWorkCatalog,
	selectReturnCards,
} from "./return-to-work-model";

/**
 * Phase 1 loop for CANT-56914D28: `noteVisibleOpen` must not throw
 * `returnToWorkVisibleOpen.upsert` when the Prisma delegate is missing
 * (stale `getPrismaClient` cache after generate). Fresh-client DB tests
 * below cannot catch this — they construct Prisma after generate.
 */
describe("Return to Work — missing Prisma delegate (CANT-56914D28)", () => {
	it("does not throw evaluating returnToWorkVisibleOpen.upsert", async () => {
		const prisma = {
			project: {
				findFirst: async () => ({ id: "proj_stale_client" }),
			},
			returnToWorkVisibleOpen: undefined,
		} as unknown as PrismaClient;
		const returnToWork = createReturnToWork({
			accountId: "acc_stale_client",
			clock: { now: () => TODAY },
			prisma,
			workspaceId: "ws_stale_client",
		});
		await expect(
			returnToWork.noteVisibleOpen({ projectId: "proj_stale_client" })
		).resolves.toEqual({ status: "committed" });
	});
});

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const TODAY = new Date("2026-09-03T12:00:00.000Z");
const FORBIDDEN_SURFACE =
	/Active Working Set|sprint|recent-tabs|stuck verdict|mandatory agenda/;

describe("Return to Work catalog", () => {
	it("exposes English Return to Work and does not restore recent-context", () => {
		expect(returnToWorkCatalog()).toEqual({
			copy: RETURN_TO_WORK_COPY,
			kind: "return-to-work",
			longInTheSameStatus: LONG_IN_THE_SAME_STATUS_CONTRACT,
			nextConcreteStep: NEXT_CONCRETE_STEP_CONTRACT,
			restores: RETURN_TO_WORK_RESTORES,
			session: RETURN_TO_WORK_SESSION,
			snapshot: { storedCardSnapshot: false },
		});
		expect(RETURN_TO_WORK_COPY.returnToWork).toBe("Return to Work");
		expect(RETURN_TO_WORK_COPY.nextConcreteStep).toBe("Next concrete step");
		expect(RETURN_TO_WORK_COPY.openSourceRecord).toBe("Open source record");
		expect(RETURN_TO_WORK_COPY.longInTheSameStatus).toBe(
			"Long in the same status"
		);
		expect(JSON.stringify(returnToWorkCatalog())).not.toMatch(
			FORBIDDEN_SURFACE
		);
		expect(returnToWorkCatalog().longInTheSameStatus).toEqual(
			LONG_IN_THE_SAME_STATUS_CONTRACT
		);
		expect(returnToWorkCatalog().longInTheSameStatus.stuckVerdict).toBe(false);
		expect(returnToWorkCatalog().longInTheSameStatus.healthScore).toBe(false);
		expect(returnToWorkCatalog().longInTheSameStatus.performanceScore).toBe(
			false
		);
		expect(
			returnToWorkCatalog().longInTheSameStatus.defaultAttentionSignal
		).toBe(false);
	});

	it("selects current records with a closed why-shown list", () => {
		const cards = selectReturnCards(
			[
				{
					editedAt: "2026-09-03T11:00:00.000Z",
					href: "/projects/p?work=old#work",
					id: "old",
					key: "PAY-1",
					kind: "work",
					openRisk: false,
					pendingGitHubDevelopmentSignal: false,
					title: "Old title",
					upcomingDate: null,
					viewedAt: null,
				},
				{
					editedAt: "2026-09-03T12:00:00.000Z",
					href: "/projects/p?work=new#work",
					id: "new",
					key: "PAY-2",
					kind: "work",
					openRisk: false,
					pendingGitHubDevelopmentSignal: false,
					title: "Current title",
					upcomingDate: null,
					viewedAt: null,
				},
				{
					editedAt: "2026-09-01T12:00:00.000Z",
					href: "/projects/p?work=dated#work",
					id: "dated",
					key: "PAY-3",
					kind: "work",
					openRisk: false,
					pendingGitHubDevelopmentSignal: false,
					title: "Dated work",
					upcomingDate: "2026-09-10",
					viewedAt: null,
				},
				{
					editedAt: "2026-09-02T12:00:00.000Z",
					href: "/projects/p?work=seen#work",
					id: "seen",
					key: "PAY-4",
					kind: "work",
					openRisk: false,
					pendingGitHubDevelopmentSignal: false,
					title: "Seen work",
					upcomingDate: null,
					viewedAt: "2026-09-03T10:00:00.000Z",
				},
				{
					editedAt: "2026-09-02T08:00:00.000Z",
					href: "/projects/p?work=risk#work",
					id: "risk",
					key: "PAY-5",
					kind: "risk",
					openRisk: true,
					pendingGitHubDevelopmentSignal: false,
					title: "Open Risk",
					upcomingDate: null,
					viewedAt: null,
				},
				{
					editedAt: "2026-09-02T09:00:00.000Z",
					href: "/projects/p?work=gh#work",
					id: "gh",
					key: "PAY-6",
					kind: "github-development-signal",
					openRisk: false,
					pendingGitHubDevelopmentSignal: true,
					title: "Pending PR",
					upcomingDate: null,
					viewedAt: null,
				},
			],
			{ contextId: "project-1", today: "2026-09-03" }
		);
		expect(cards.map((card) => [card.id, card.whyShown, card.title])).toEqual([
			["gh", CARD_REASON.pendingGitHubDevelopmentSignal, "Pending PR"],
			["risk", CARD_REASON.openRisk, "Open Risk"],
			["dated", CARD_REASON.upcomingDate, "Dated work"],
			["seen", CARD_REASON.recentlyViewed, "Seen work"],
			["new", CARD_REASON.recentlyEdited, "Current title"],
		]);
		expect(
			cards.every((card) => card.openSourceRecord === "Open source record")
		).toBe(true);
		expect(cards.find((card) => card.title === "Old title")).toBeUndefined();
	});

	it("selects Long in the same status over recently edited when that reason is present", () => {
		const cards = selectReturnCards(
			[
				{
					editedAt: "2026-09-03T11:00:00.000Z",
					href: "/projects/p?work=stale#work",
					id: "stale",
					key: "PAY-9",
					kind: "work",
					longInTheSameStatus: true,
					openRisk: false,
					pendingGitHubDevelopmentSignal: false,
					title: "Stale work",
					upcomingDate: null,
					viewedAt: null,
				},
			],
			{ contextId: "project-1", today: "2026-09-03" }
		);
		expect(cards).toEqual([
			expect.objectContaining({
				id: "stale",
				openSourceRecord: "Open source record",
				whyShown: CARD_REASON.longInTheSameStatus,
			}),
		]);
	});
});

describe("Return to Work", () => {
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
		await prisma.mutationReceipt.deleteMany({ where: { actorId } });
		await prisma.returnToWorkVisibleOpen.deleteMany({
			where: { accountId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function surface(now: Date = TODAY) {
		return createReturnToWork({
			accountId: actorId,
			clock: { now: () => now },
			prisma,
			workspaceId,
		});
	}

	async function openProject(name: string, starter = "Blank Project") {
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `create-${name}-${actorId}`,
			origin: "human",
			payload: {
				name,
				starterConfiguration: starter,
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

	it("reads current Work titles rather than a stored card snapshot", async () => {
		const project = await openProject("Payments");
		const intake = await openWork(project.id, "Intake checkout");
		await prisma.work.update({
			data: { updatedAt: new Date("2026-09-03T11:00:00.000Z") },
			where: { id: intake.id },
		});
		const first = await surface().summary({ projectId: project.id });
		expect(first?.snapshot.storedCardSnapshot).toBe(false);
		expect(first?.cards).toEqual([
			expect.objectContaining({
				id: intake.id,
				openSourceRecord: "Open source record",
				title: "Intake checkout",
				whyShown: CARD_REASON.recentlyEdited,
			}),
		]);
		const beforeCount = (await listWork(prisma, project.id)).length;
		const renamed = await updateWorkTitle(prisma, {
			actorId,
			baseRevision: intake.revision,
			idempotencyKey: "rename-intake",
			origin: "human",
			title: "Intake live",
			workId: intake.id,
		});
		expect(renamed.status).toBe("committed");
		const second = await surface().summary({ projectId: project.id });
		expect(second?.cards).toEqual([
			expect.objectContaining({
				id: intake.id,
				title: "Intake live",
				whyShown: CARD_REASON.recentlyEdited,
			}),
		]);
		expect((await listWork(prisma, project.id)).length).toBe(beforeCount);
		expect(second?.session).toEqual(RETURN_TO_WORK_SESSION);
		expect(second?.restores).toEqual(RETURN_TO_WORK_RESTORES);
	});

	it("explains last viewed, upcoming date, and Open source record", async () => {
		const project = await openProject("Payments");
		const edited = await openWork(project.id, "Edited work");
		const viewed = await openWork(project.id, "Viewed work");
		const dated = await openWork(project.id, "Dated work");
		await prisma.work.update({
			data: { updatedAt: new Date("2026-09-03T08:00:00.000Z") },
			where: { id: edited.id },
		});
		await prisma.work.update({
			data: { updatedAt: new Date("2026-09-03T09:00:00.000Z") },
			where: { id: viewed.id },
		});
		const datedDates = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: dated.revision,
			idempotencyKey: "date-dated",
			origin: "human",
			plannedStart: null,
			reappearDate: null,
			targetDate: "2026-09-10",
			workId: dated.id,
		});
		expect(datedDates.status).toBe("committed");
		const noted = await surface().noteVisibleOpen({ workId: viewed.id });
		expect(noted.status).toBe("committed");
		const view = await surface().summary({ projectId: project.id });
		expect(view?.cards.map((card) => [card.title, card.whyShown])).toEqual([
			["Dated work", CARD_REASON.upcomingDate],
			["Viewed work", CARD_REASON.recentlyViewed],
			["Edited work", CARD_REASON.recentlyEdited],
		]);
		expect(view?.cards.every((card) => card.href.includes("#work"))).toBe(true);
	});

	it("shows sibling current Work when returning to a Work", async () => {
		const project = await openProject("Payments");
		const focus = await openWork(project.id, "Focus work");
		const sibling = await openWork(project.id, "Sibling work");
		await prisma.work.update({
			data: { updatedAt: new Date("2026-09-03T11:00:00.000Z") },
			where: { id: focus.id },
		});
		await prisma.work.update({
			data: { updatedAt: new Date("2026-09-03T12:00:00.000Z") },
			where: { id: sibling.id },
		});
		const view = await surface().summary({
			projectId: project.id,
			workId: focus.id,
		});
		expect(view?.cards).toEqual([
			expect.objectContaining({
				title: "Sibling work",
				whyShown: CARD_REASON.recentlyEdited,
			}),
		]);
	});

	it("stores Next concrete step on the source and keeps previous values in history", async () => {
		const project = await openProject("Payments");
		const work = await openWork(project.id, "Intake checkout");
		const first = await surface().setNextConcreteStep({
			idempotencyKey: "step-1",
			text: "Ship the login",
			workId: work.id,
		});
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			throw new Error("expected committed step");
		}
		expect(first.summary.nextConcreteStep).toEqual(
			expect.objectContaining({
				openSourceRecord: "Open source record",
				text: "Ship the login",
			})
		);
		expect(first.summary.nextConcreteStepHistory).toEqual([]);
		const replaced = await surface().setNextConcreteStep({
			idempotencyKey: "step-2",
			text: "Write the spec",
			workId: work.id,
		});
		expect(replaced.status).toBe("committed");
		if (replaced.status !== "committed") {
			throw new Error("expected committed replace");
		}
		expect(replaced.summary.nextConcreteStep?.text).toBe("Write the spec");
		expect(
			replaced.summary.nextConcreteStepHistory.map((row) => row.text)
		).toEqual(["Ship the login"]);
		expect(NEXT_CONCRETE_STEP_CONTRACT).toEqual({
			autoWriteFrom: {
				date: false,
				planningMembership: false,
				priority: false,
				stage: false,
				status: false,
			},
			checklist: false,
			dailyFocus: false,
			guessesFromEvents: false,
			recordType: false,
			reminder: false,
			secondList: false,
		});
	});

	it("does not rewrite Next concrete step from status, dates, planning, priority, or stage", async () => {
		const project = await openProject("Payments", "Solo SaaS");
		const work = await openWork(project.id, "Intake checkout");
		const saved = await surface().setNextConcreteStep({
			idempotencyKey: "keep-step",
			text: "Ship the login",
			workId: work.id,
		});
		expect(saved.status).toBe("committed");
		const afterSave = await prisma.work.findUniqueOrThrow({
			where: { id: work.id },
		});
		const status = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: afterSave.revision,
			idempotencyKey: "to-progress",
			origin: "human",
			status: "In Progress",
			workId: work.id,
		});
		expect(status.status).toBe("committed");
		if (status.status !== "committed") {
			throw new Error("expected status");
		}
		const dated = await updateWorkPlanningDates(prisma, {
			actorId,
			baseRevision: status.work.revision,
			idempotencyKey: "dates",
			origin: "human",
			plannedStart: "2026-09-04",
			reappearDate: null,
			targetDate: "2026-09-20",
			workId: work.id,
		});
		expect(dated.status).toBe("committed");
		const membership = await applyPlanningMembership(prisma, {
			desiredStatus: "In Progress",
			surface: "Board",
			workId: work.id,
		});
		expect(membership.status).toBe("committed");
		await reorderManualOrder(prisma, {
			projectId: project.id,
			workIds: [work.id],
		});
		const criterion = await createPriorityCriterion(prisma, {
			actorId,
			idempotencyKey: "urgency",
			origin: "human",
			payload: { name: "Urgency", projectId: project.id },
		});
		if (criterion.status !== "committed") {
			throw new Error("expected criterion");
		}
		const priority = await setPriorityCriterionValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "high",
			origin: "human",
			payload: {
				criterionId: criterion.definition.id,
				rank: "High",
				workId: work.id,
			},
		});
		expect(priority.status).toBe("committed");
		const discovery = project.stages.find(
			(stage) => stage.name === "Discovery"
		);
		if (!discovery) {
			throw new Error("expected Discovery");
		}
		const currentProject = await getProject(prisma, project.id);
		if (!currentProject) {
			throw new Error("expected Project");
		}
		const staged = await configureProject(prisma, {
			actorId,
			baseRevision: currentProject.revision,
			change: {
				action: "set-stage-state",
				stageId: discovery.id,
				state: "Active",
			},
			idempotencyKey: "activate-discovery",
			origin: "human",
			projectId: project.id,
		});
		expect(staged.status).toBe("committed");
		const view = await surface().summary({
			projectId: project.id,
			workId: work.id,
		});
		expect(view?.nextConcreteStep?.text).toBe("Ship the login");
		expect(view?.session.writesStatus).toBe(false);
	});

	it("saves Next concrete step on the Project source", async () => {
		const project = await openProject("Payments");
		const saved = await surface().setNextConcreteStep({
			idempotencyKey: "project-step",
			projectId: project.id,
			text: "Reopen the board",
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected project step");
		}
		expect(saved.summary.nextConcreteStep?.text).toBe("Reopen the board");
		expect(saved.summary.context.kind).toBe("project");
	});

	it("saves Next concrete step when Prisma rejects nextConcreteStep as unknown (CANT-BD652F27)", async () => {
		const project = await openProject("Payments");
		const stale = prisma.$extends({
			query: {
				project: {
					update({ args, query }) {
						if (
							typeof args.data === "object" &&
							args.data !== null &&
							"nextConcreteStep" in args.data
						) {
							throw new Error(
								"Unknown argument `nextConcreteStep`. Available options are marked with ?."
							);
						}
						return query(args);
					},
				},
				work: {
					update({ args, query }) {
						if (
							typeof args.data === "object" &&
							args.data !== null &&
							"nextConcreteStep" in args.data
						) {
							throw new Error(
								"Unknown argument `nextConcreteStep`. Available options are marked with ?."
							);
						}
						return query(args);
					},
				},
			},
		});
		const returnToWork = createReturnToWork({
			accountId: actorId,
			clock: { now: () => TODAY },
			prisma: stale as unknown as PrismaClient,
			workspaceId,
		});
		const saved = await returnToWork.setNextConcreteStep({
			idempotencyKey: "stale-client-step",
			projectId: project.id,
			text: "Gel",
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected committed step");
		}
		expect(saved.summary.nextConcreteStep?.text).toBe("Gel");
	});

	it("does not mint Long in the same status without a Project threshold", async () => {
		const project = await openProject("Payments");
		const work = await openWork(project.id, "Aged intake");
		await prisma.work.update({
			data: {
				createdAt: new Date("2026-08-01T12:00:00.000Z"),
				updatedAt: new Date("2026-08-01T12:00:00.000Z"),
			},
			where: { id: work.id },
		});
		const view = await surface().summary({ projectId: project.id });
		expect(view?.statusAgeThresholdDays).toBeNull();
		expect(view?.preparedSmartCollection).toBeNull();
		expect(
			view?.cards.some(
				(card) => card.whyShown === CARD_REASON.longInTheSameStatus
			)
		).toBe(false);
		expect(view?.longInTheSameStatus).toEqual(LONG_IN_THE_SAME_STATUS_CONTRACT);
		expect(view?.cards[0]?.whyShown).toBe(CARD_REASON.recentlyEdited);
		expect(await listSmartCollections(prisma, workspaceId)).toEqual([]);
	});

	it("marks active Work past the threshold as Long in the same status without writing status or a default signal", async () => {
		const project = await openProject("Payments");
		const aged = await openWork(project.id, "Aged intake");
		const fresh = await openWork(project.id, "Fresh intake");
		await prisma.work.update({
			data: {
				createdAt: new Date("2026-08-01T12:00:00.000Z"),
				updatedAt: new Date("2026-08-01T12:00:00.000Z"),
			},
			where: { id: aged.id },
		});
		const before = await getWork(prisma, aged.id);
		if (!before) {
			throw new Error("expected Work");
		}
		const saved = await surface().setStatusAgeThresholdDays({
			projectId: project.id,
			thresholdDays: 7,
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected committed threshold");
		}
		expect(saved.summary.statusAgeThresholdDays).toBe(7);
		expect(saved.summary.cards.find((card) => card.id === aged.id)).toEqual(
			expect.objectContaining({
				id: aged.id,
				openSourceRecord: "Open source record",
				title: "Aged intake",
				whyShown: CARD_REASON.longInTheSameStatus,
			})
		);
		expect(
			saved.summary.cards.find((card) => card.id === fresh.id)?.whyShown
		).not.toBe(CARD_REASON.longInTheSameStatus);
		expect(saved.summary.preparedSmartCollection).toEqual({
			members: [
				expect.objectContaining({
					because: CARD_REASON.longInTheSameStatus,
					id: aged.id,
					title: "Aged intake",
				}),
			],
			name: RETURN_TO_WORK_COPY.longInTheSameStatus,
		});
		expect(saved.summary.longInTheSameStatus).toEqual(
			LONG_IN_THE_SAME_STATUS_CONTRACT
		);
		expect(saved.summary.longInTheSameStatus.defaultAttentionSignal).toBe(
			false
		);
		expect(saved.summary.longInTheSameStatus.stuckVerdict).toBe(false);
		expect(saved.summary.longInTheSameStatus.healthScore).toBe(false);
		const after = await getWork(prisma, aged.id);
		expect(after).toMatchObject({
			closureResult: before.closureResult,
			status: before.status,
		});
		const membership = await applyPlanningMembership(prisma, {
			desiredStatus: before.status,
			surface: "Board",
			workId: aged.id,
		});
		expect(membership.status).toBe("committed");
		const afterMembership = await getWork(prisma, aged.id);
		expect(afterMembership?.status).toBe(before.status);
		const collections = await listSmartCollections(prisma, workspaceId);
		expect(collections).toEqual([
			expect.objectContaining({
				name: RETURN_TO_WORK_COPY.longInTheSameStatus,
				projectId: project.id,
				sourceKind: "Work",
			}),
		]);
		const collectionId = collections[0]?.id;
		if (!collectionId) {
			throw new Error("expected prepared Smart Collection");
		}
		const prepared = await viewSmartCollection(
			prisma,
			workspaceId,
			collectionId
		);
		expect(prepared?.membership.members.map((member) => member.id)).toEqual([
			aged.id,
		]);
		expect(prepared?.membership.members[0]?.because).toEqual([
			{
				field: "status",
				label: CARD_REASON.longInTheSameStatus,
			},
		]);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision:
				afterMembership?.revision ?? after?.revision ?? before.revision,
			idempotencyKey: "close-aged",
			origin: "human",
			result: "Completed",
			workId: aged.id,
		});
		expect(closed.status).toBe("committed");
		const afterClose = await surface().summary({ projectId: project.id });
		expect(
			afterClose?.cards.find((card) => card.id === aged.id)?.whyShown
		).not.toBe(CARD_REASON.longInTheSameStatus);
		expect(
			afterClose?.preparedSmartCollection?.members.some(
				(member) => member.id === aged.id
			)
		).toBe(false);
	});
});
