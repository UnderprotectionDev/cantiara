/**
 * Backlog seam — prepared membership of active, non-archive,
 * non-trash Work, including unplanned Work; view, pick-up, and
 * placement on another planning surface do not write status,
 * closure, or project stage. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Günlük planlama: view change other than Kanban does not write
 * status).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
	listWorkLifecycleHistory,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	listPreparedBacklog,
	placeOnPlanningSurface,
	projectStagesForWork,
	takeUpFromBacklog,
} from "./backlog";
import {
	BACKLOG_COPY,
	backlogCatalog,
	PLANNING_SURFACE,
	PREPARED_MEMBERSHIP,
} from "./backlog-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"; // pragma: allowlist secret

const FOLDER_SPRINT_PATTERN = /folder|sprint|staticList|tagAsBacklog/i;

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
		expect(BACKLOG_COPY.backlog).toBe("Backlog");
		expect(catalog.membership).toBe("derived");
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
});
