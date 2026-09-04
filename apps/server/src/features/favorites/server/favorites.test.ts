/**
 * Favorites seam — Hesap-scoped Favori membership on the closed
 * source list; add/remove do not write source Project, type, status,
 * closure, Backlog order, or scope; membership is not Active Working
 * Set, Daily Focus, Backlog, or Focus Period; source is not copied or
 * deleted. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (kişisel bağlam: Favorite add/remove counterpart).
 */

import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listPreparedBacklog } from "../../backlog/server/backlog";
import { createDailyFocus } from "../../daily-focus/server/daily-focus";
import { createDecision } from "../../decisions/server/decisions";
import { createDocument, getDocument } from "../../documents/server/documents";
import { DOCUMENT_SCOPE_KIND } from "../../documents/server/documents-model";
import { createFocusPeriod } from "../../focus-period/server/focus-period";
import { createProject } from "../../project-shell/server/project-shell";
import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import { createSmartCollection } from "../../smart-collections/server/smart-collections";
import {
	createWork,
	getWork,
	updateWorkPlanningDates,
} from "../../work-lifecycle/server/work-lifecycle";
import { createFavorites } from "./favorites";
import {
	FAVORITE_SOURCE_TYPE,
	FAVORITE_SOURCE_TYPES,
	FAVORITES_COPY,
	FAVORITES_COUNTERPARTS,
	FAVORITES_SOURCE_WRITES,
	favoriteSourceHref,
	favoritesCatalog,
} from "./favorites-model";

const DATABASE_URL = localTestDatabaseUrl();

const FORBIDDEN_SURFACE =
	/bookmark queue|Active Working Set|Save for Later|planning membership/i;
const HIDDEN_SOURCE_LEAK = /Hidden|Secret/;

describe("Favorites catalog", () => {
	it("exposes the closed source list, English copy, and no planning counterparts", () => {
		expect(favoritesCatalog()).toEqual({
			copy: FAVORITES_COPY,
			counterparts: FAVORITES_COUNTERPARTS,
			kind: "favorites",
			sourceTypes: FAVORITE_SOURCE_TYPES,
			sourceWrites: FAVORITES_SOURCE_WRITES,
		});
		expect(FAVORITE_SOURCE_TYPES).toEqual([
			"Project",
			"Document",
			"Work",
			"Decision",
			"Smart Collection",
		]);
		expect(FAVORITES_COPY.favorites).toBe("Favorites");
		expect(FAVORITES_COPY.addToFavorites).toBe("Add to Favorites");
		expect(FAVORITES_COPY.removeFromFavorites).toBe("Remove from Favorites");
		expect(FAVORITES_COUNTERPARTS.activeWorkingSet).toBe(false);
		expect(FAVORITES_COUNTERPARTS.dailyFocus).toBe(false);
		expect(FAVORITES_COUNTERPARTS.backlog).toBe(false);
		expect(FAVORITES_COUNTERPARTS.focusPeriod).toBe(false);
		expect(FAVORITES_COUNTERPARTS.secondCopy).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.project).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.type).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.status).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.closure).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.backlogOrder).toBe(false);
		expect(FAVORITES_SOURCE_WRITES.scope).toBe(false);
		expect(JSON.stringify(favoritesCatalog())).not.toMatch(FORBIDDEN_SURFACE);
		expect(FAVORITES_COPY.openSourceRecord).toBe("Open source record");
		expect(FAVORITES_COPY.permanentlyDeleted).toBe("Permanently deleted");
		expect(FAVORITES_COPY.noAccess).toBe("No access");
		expect(FAVORITES_COPY.inTrash).toBe("In Trash");
		expect(FAVORITES_COPY.archived).toBe("Archived");
		expect(FAVORITES_COUNTERPARTS.shellMembershipStore).toBe(false);
		expect(
			favoriteSourceHref({
				projectId: "proj_1",
				sourceId: "work_1",
				sourceType: FAVORITE_SOURCE_TYPE.work,
			})
		).toBe("/projects/proj_1?work=work_1#work");
		expect(
			favoriteSourceHref({
				projectId: null,
				sourceId: "proj_1",
				sourceType: FAVORITE_SOURCE_TYPE.project,
			})
		).toBe("/projects/proj_1#overview");
	});
});

describe("Favorites", () => {
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
		await prisma.favoriteMembership.deleteMany({
			where: { accountId: actorId },
		});
		await prisma.workspace.deleteMany({ where: { ownerId: actorId } });
		await prisma.user.deleteMany({ where: { id: actorId } });
		await prisma.$disconnect();
		await pool.end();
	});

	function surface() {
		return createFavorites({
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
			select: { id: true, name: true, scope: true },
			where: { id: projectId },
		});
		return {
			backlogOrder: backlog.manualOrder,
			closureResult: work?.closureResult ?? null,
			dailyFocusIds: daily.members.map((member) => member.id),
			focusPeriodIds: periods.flatMap((period) =>
				period.members.map((member) => member.id)
			),
			projectId: work?.projectId,
			projectName: project.name,
			projectScope: project.scope,
			status: work?.status,
			type: work?.type,
			workCount: await prisma.work.count({ where: { projectId } }),
		};
	}

	it("adds Work to Favorites and lists the same source id", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			return;
		}
		expect(added.membership).toMatchObject({
			accountId: actorId,
			sourceId: work.id,
			sourceType: "Work",
		});
		expect(added.membership.sourceId).toBe(work.id);
		const listed = await surface().list();
		expect(listed).toEqual([added.membership]);
		expect(listed[0]?.sourceId).toBe(work.id);
		const forSource = await surface().listForSource({
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		expect(forSource).toEqual([added.membership]);
	});

	it("adds Project, Document, Decision, and Smart Collection on the closed list", async () => {
		const project = await openProject("Alpha");
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
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: `decision-${actorId}`,
			origin: "human",
			payload: {
				decision: "Ship weekly.",
				projectId: project.id,
				rationale: "Cadence.",
				title: "Cadence",
			},
		});
		if (decision.status !== "committed") {
			throw new Error("expected committed Decision");
		}
		const collection = await createSmartCollection(prisma, {
			conditions: [
				{ field: "status", operator: "equals", value: "In Progress" },
			],
			name: "Active Work",
			projectId: project.id,
			sourceKind: RECORD_DISCOVERY_COPY.work,
			workspaceId,
		});
		if (collection.status !== "ok") {
			throw new Error("expected stored Smart Collection");
		}
		const favorites = surface();
		const onProject = await favorites.add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: project.id,
			sourceType: FAVORITE_SOURCE_TYPE.project,
		});
		const onDocument = await favorites.add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: document.document.id,
			sourceType: FAVORITE_SOURCE_TYPE.document,
		});
		const onDecision = await favorites.add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: decision.decision.id,
			sourceType: FAVORITE_SOURCE_TYPE.decision,
		});
		const onCollection = await favorites.add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: collection.collection.id,
			sourceType: FAVORITE_SOURCE_TYPE.smartCollection,
		});
		expect(onProject.status).toBe("committed");
		expect(onDocument.status).toBe("committed");
		expect(onDecision.status).toBe("committed");
		expect(onCollection.status).toBe("committed");
		const listed = await favorites.list();
		expect(listed.map((row) => row.sourceType).sort()).toEqual([
			"Decision",
			"Document",
			"Project",
			"Smart Collection",
		]);
	});

	it("removes Favorites membership without deleting the source", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed Favorite");
		}
		const removed = await surface().remove({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		expect(removed.status).toBe("committed");
		expect(await surface().list()).toEqual([]);
		expect(await getWork(prisma, work.id)).toMatchObject({
			id: work.id,
			title: "Ship",
		});
	});

	it("does not treat a missing Work as a Favorite write", async () => {
		const missing = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: crypto.randomUUID(),
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		expect(missing.status).toBe("not-found");
	});

	it("rejects an unsupported type and does not copy Work", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const beforeCount = await prisma.work.count({
			where: { projectId: project.id },
		});
		const unsupported = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: "Milestone" as never,
		});
		expect(unsupported.status).toBe("invalid");
		if (unsupported.status === "invalid") {
			expect(unsupported.reason).toBe(FAVORITES_COPY.unsupportedSource);
		}
		expect(await prisma.work.count({ where: { projectId: project.id } })).toBe(
			beforeCount
		);
	});

	it("does not write Work Project, type, status, closure, Backlog order, or scope", async () => {
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
		const before = await snapshotWorkPlanning(work.id, project.id);
		expect(before.status).toBe("Not Started");
		expect(before.type).toBe("Task");
		expect(before.projectId).toBe(project.id);
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed Favorite");
		}
		expect(await snapshotWorkPlanning(work.id, project.id)).toEqual(before);
		await surface().remove({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		expect(await snapshotWorkPlanning(work.id, project.id)).toEqual(before);
		expect(favoritesCatalog().sourceWrites).toEqual({
			backlogOrder: false,
			closure: false,
			project: false,
			scope: false,
			status: false,
			type: false,
		});
	});

	it("does not produce Daily Focus, Backlog, or Focus Period membership", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const beforeDaily = await createDailyFocus({
			accountId: actorId,
			prisma,
			workspaceId,
		}).view();
		const beforeBacklog = await listPreparedBacklog(prisma, project.id);
		const beforePeriods = await createFocusPeriod({
			accountId: actorId,
			prisma,
			workspaceId,
		}).list();
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed Favorite");
		}
		const daily = await createDailyFocus({
			accountId: actorId,
			prisma,
			workspaceId,
		}).view();
		const backlog = await listPreparedBacklog(prisma, project.id);
		const periods = await createFocusPeriod({
			accountId: actorId,
			prisma,
			workspaceId,
		}).list();
		expect(daily.members).toEqual(beforeDaily.members);
		expect(backlog.manualOrder).toEqual(beforeBacklog.manualOrder);
		expect(periods).toEqual(beforePeriods);
		expect(beforeDaily.members.map((member) => member.id)).toEqual([]);
		expect(beforePeriods).toEqual([]);
		expect(FAVORITES_COUNTERPARTS.activeWorkingSet).toBe(false);
		expect(FAVORITES_COUNTERPARTS.dailyFocus).toBe(false);
		expect(FAVORITES_COUNTERPARTS.backlog).toBe(false);
		expect(FAVORITES_COUNTERPARTS.focusPeriod).toBe(false);
	});

	it("does not write Document type or Project scope", async () => {
		const project = await openProject("Alpha");
		const document = await createDocument(prisma, {
			actorId,
			idempotencyKey: `doc-type-${actorId}`,
			origin: "human",
			payload: {
				scope: {
					kind: DOCUMENT_SCOPE_KIND.project,
					projectId: project.id,
				},
				title: "Spec",
				type: "Spec",
			},
			workspaceId,
		});
		if (document.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const beforeProject = await prisma.project.findUniqueOrThrow({
			select: { scope: true },
			where: { id: project.id },
		});
		const beforeDoc = await getDocument(prisma, document.document.id);
		await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: document.document.id,
			sourceType: FAVORITE_SOURCE_TYPE.document,
		});
		await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: project.id,
			sourceType: FAVORITE_SOURCE_TYPE.project,
		});
		expect(await getDocument(prisma, document.document.id)).toMatchObject({
			id: document.document.id,
			type: beforeDoc?.type,
		});
		expect(
			await prisma.project.findUniqueOrThrow({
				select: { scope: true },
				where: { id: project.id },
			})
		).toEqual(beforeProject);
	});

	it("opens the same source record from Favorites without a second copy", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed Favorite");
		}
		const beforeCount = await prisma.work.count({
			where: { projectId: project.id },
		});
		const opened = await surface().openList();
		expect(opened.title).toBe("Favorites");
		expect(opened.copy.openSourceRecord).toBe("Open source record");
		expect(opened.membershipWrite).toBe(false);
		expect(opened.secondCopy).toBe(false);
		expect(opened.rows).toHaveLength(1);
		expect(opened.rows[0]).toMatchObject({
			id: added.membership.id,
			openTarget: {
				href: `/projects/${project.id}?work=${encodeURIComponent(work.id)}#work`,
				kind: "record",
				openSourceRecord: "Open source record",
			},
			sourceId: work.id,
			sourceType: "Work",
			title: "Ship",
		});
		expect(opened.rows[0]?.id).not.toBe(work.id);
		expect(await surface().openSource(added.membership.id)).toEqual(
			opened.rows[0]
		);
		expect(await prisma.work.count({ where: { projectId: project.id } })).toBe(
			beforeCount
		);
		expect(await getWork(prisma, work.id)).toMatchObject({
			id: work.id,
			title: "Ship",
		});
	});

	it("shows a broken reference for a deleted source and does not open another Work", async () => {
		const project = await openProject("Alpha");
		const gone = await openWork(project.id, "Gone");
		const kept = await openWork(project.id, "Kept");
		const addedGone = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: gone.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		const addedKept = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: kept.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (addedGone.status !== "committed" || addedKept.status !== "committed") {
			throw new Error("expected committed Favorites");
		}
		await prisma.work.delete({ where: { id: gone.id } });
		const opened = await surface().openList();
		const goneRow = opened.rows.find((row) => row.sourceId === gone.id);
		const keptRow = opened.rows.find((row) => row.sourceId === kept.id);
		expect(goneRow?.title).toBeNull();
		expect(goneRow?.openTarget).toEqual({
			href: null,
			kind: "broken-reference",
			openSourceRecord: null,
			reason: FAVORITES_COPY.permanentlyDeleted,
		});
		expect(keptRow?.openTarget).toMatchObject({
			href: `/projects/${project.id}?work=${encodeURIComponent(kept.id)}#work`,
			kind: "record",
		});
		expect(await surface().openSource(addedGone.membership.id)).toEqual(
			goneRow
		);
		expect(opened.rows.map((row) => row.sourceId).sort()).toEqual(
			[gone.id, kept.id].sort()
		);
	});

	it("shows No access for an inaccessible source without leaking its title", async () => {
		const otherUser = await prisma.user.create({
			data: {
				email: `${crypto.randomUUID()}@example.com`,
				emailVerified: true,
				id: crypto.randomUUID(),
				name: "Other",
			},
		});
		const otherWorkspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Other",
				ownerId: otherUser.id,
			},
		});
		const otherProject = await createProject(prisma, {
			actorId: otherUser.id,
			idempotencyKey: `other-${actorId}`,
			origin: "human",
			payload: {
				name: "Secret",
				starterConfiguration: "Blank Project",
			},
			workspaceId: otherWorkspace.id,
		});
		if (otherProject.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const otherWork = await createWork(prisma, {
			actorId: otherUser.id,
			idempotencyKey: `other-work-${actorId}`,
			origin: "human",
			payload: { projectId: otherProject.project.id, title: "Hidden" },
		});
		if (otherWork.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const membershipId = crypto.randomUUID();
		await prisma.favoriteMembership.create({
			data: {
				accountId: actorId,
				id: membershipId,
				sourceId: otherWork.work.id,
				sourceType: FAVORITE_SOURCE_TYPE.work,
			},
		});
		const opened = await surface().openList();
		expect(opened.rows).toEqual([
			expect.objectContaining({
				id: membershipId,
				openTarget: {
					href: null,
					kind: "broken-reference",
					openSourceRecord: null,
					reason: FAVORITES_COPY.noAccess,
				},
				sourceId: otherWork.work.id,
				sourceType: "Work",
				title: null,
			}),
		]);
		expect(JSON.stringify(opened.rows)).not.toMatch(HIDDEN_SOURCE_LEAK);
		await prisma.favoriteMembership.delete({ where: { id: membershipId } });
		await prisma.workspace.deleteMany({ where: { ownerId: otherUser.id } });
		await prisma.user.deleteMany({ where: { id: otherUser.id } });
	});

	it("keeps Open source record on a trashed source and does not write membership when the shell opens the list", async () => {
		const project = await openProject("Alpha");
		const work = await openWork(project.id, "Ship");
		const added = await surface().add({
			idempotencyKey: crypto.randomUUID(),
			sourceId: work.id,
			sourceType: FAVORITE_SOURCE_TYPE.work,
		});
		if (added.status !== "committed") {
			throw new Error("expected committed Favorite");
		}
		await prisma.work.update({
			data: { trashedAt: new Date("2026-09-04T12:00:00.000Z") },
			where: { id: work.id },
		});
		const before = await surface().list();
		const opened = await surface().openList();
		expect(opened.membershipWrite).toBe(false);
		expect(opened.rows[0]?.title).toBe("Ship");
		expect(opened.rows[0]?.openTarget).toEqual({
			href: `/projects/${project.id}?work=${encodeURIComponent(work.id)}#work`,
			kind: "broken-reference",
			openSourceRecord: "Open source record",
			reason: FAVORITES_COPY.inTrash,
		});
		expect(await surface().list()).toEqual(before);
		expect(await surface().openSource(added.membership.id)).toEqual(
			opened.rows[0]
		);
	});
});
