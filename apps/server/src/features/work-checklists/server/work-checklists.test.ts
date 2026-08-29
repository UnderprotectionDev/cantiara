/**
 * Work Checklists seam — light items are text plus a done
 * mark on Work. They are not main records, do not close Work,
 * and are not Feature included-Work, a Test Scenario, or a
 * Handoff package. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş yaşam döngüsü: owned checklist component).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	applyPlanningMembership,
	createWork,
	getWork,
	getWorkByKey,
	getWorkScope,
	includeWork,
	listWork,
	listWorkLifecycleHistory,
	relateWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	addChecklistItem,
	convertChecklistItem,
	getWorkChecklist,
	previewConvertChecklistItem,
	removeChecklistItem,
	reorderChecklistItems,
	setChecklistItemCompleted,
	updateChecklistItem,
} from "./work-checklists";
import { WORK_CHECKLISTS_COPY } from "./work-checklists-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const FORBIDDEN_PRODUCT =
	/subtask|epic|Test Scenario|Handoff|checklist-as-Work/i;
const HIERARCHY_PATTERN = /epic|subtask|parentId|parentWork|parent\/child/i;
const ITEM_WORKFLOW_FIELDS =
	/status|closureResult|priority|dueDate|plannedStart|planningMembership|relation/;

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
	await prisma.typedRelation.deleteMany();
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

async function committedWork(
	prisma: PrismaClient,
	actorId: string,
	input: {
		idempotencyKey: string;
		projectId: string;
		title: string;
		type?: string;
	}
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
			type: input.type,
		},
	});
	if (created.status !== "committed") {
		throw new Error(`expected committed Work, got ${created.status}`);
	}
	return created.work;
}

function expectLightItem(item: {
	completed: boolean;
	id: string;
	title: string;
}) {
	expect(Object.keys(item).sort()).toEqual(["completed", "id", "title"]);
	expect(JSON.stringify(item)).not.toMatch(ITEM_WORKFLOW_FIELDS);
}

describe("Work Checklists", () => {
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

	it("keeps an empty Checklist valid and adds, edits, reorders, checks, and removes items", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const empty = await getWorkChecklist(prisma, work.id);
		expect(empty).toMatchObject({
			items: [],
			work: {
				closureResult: null,
				id: work.id,
				key: "PAY-1",
				status: "Not Started",
			},
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-draft",
			origin: "human",
			title: "Draft copy",
			workId: work.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		expect(added.checklist.items).toHaveLength(1);
		expectLightItem(added.checklist.items[0]);
		expect(added.checklist.items[0]).toMatchObject({
			completed: false,
			title: "Draft copy",
		});
		const second = await addChecklistItem(prisma, {
			actorId,
			baseRevision: added.checklist.work.revision,
			idempotencyKey: "add-review",
			origin: "human",
			title: "Review copy",
			workId: work.id,
		});
		expect(second.status).toBe("committed");
		if (second.status !== "committed") {
			throw new Error("expected committed second add");
		}
		expect(second.checklist.items.map((item) => item.title)).toEqual([
			"Draft copy",
			"Review copy",
		]);
		const renamed = await updateChecklistItem(prisma, {
			actorId,
			baseRevision: second.checklist.work.revision,
			idempotencyKey: "rename-draft",
			itemId: second.checklist.items[0].id,
			origin: "human",
			title: "Write draft",
			workId: work.id,
		});
		expect(renamed.status).toBe("committed");
		if (renamed.status !== "committed") {
			throw new Error("expected committed rename");
		}
		const reordered = await reorderChecklistItems(prisma, {
			actorId,
			baseRevision: renamed.checklist.work.revision,
			idempotencyKey: "reorder",
			orderedItemIds: [
				renamed.checklist.items[1].id,
				renamed.checklist.items[0].id,
			],
			origin: "human",
			workId: work.id,
		});
		expect(reordered.status).toBe("committed");
		if (reordered.status !== "committed") {
			throw new Error("expected committed reorder");
		}
		expect(reordered.checklist.items.map((item) => item.title)).toEqual([
			"Review copy",
			"Write draft",
		]);
		const checked = await setChecklistItemCompleted(prisma, {
			actorId,
			baseRevision: reordered.checklist.work.revision,
			completed: true,
			idempotencyKey: "check-review",
			itemId: reordered.checklist.items[0].id,
			origin: "human",
			workId: work.id,
		});
		expect(checked.status).toBe("committed");
		if (checked.status !== "committed") {
			throw new Error("expected committed check");
		}
		expect(checked.checklist.items[0].completed).toBe(true);
		const removed = await removeChecklistItem(prisma, {
			actorId,
			baseRevision: checked.checklist.work.revision,
			idempotencyKey: "remove-review",
			itemId: checked.checklist.items[0].id,
			origin: "human",
			workId: work.id,
		});
		expect(removed.status).toBe("committed");
		if (removed.status !== "committed") {
			throw new Error("expected committed remove");
		}
		expect(removed.checklist.items.map((item) => item.title)).toEqual([
			"Write draft",
		]);
		expect(JSON.stringify(WORK_CHECKLISTS_COPY)).not.toMatch(FORBIDDEN_PRODUCT);
		expect(JSON.stringify(removed.checklist)).not.toMatch(FORBIDDEN_PRODUCT);
	});

	it("does not treat an item as Work in list, key lookup, relations, or planning", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-draft",
			origin: "human",
			title: "Draft copy",
			workId: work.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		const itemId = added.checklist.items[0].id;
		const listed = await listWork(prisma, project.id);
		expect(listed.map((row) => row.id)).toEqual([work.id]);
		expect(listed.map((row) => row.title)).toEqual(["Intake"]);
		expect(await getWork(prisma, itemId)).toBeNull();
		expect(await getWorkByKey(prisma, project.id, "Draft copy")).toBeNull();
		const related = await committedWork(prisma, actorId, {
			idempotencyKey: "task-other",
			projectId: project.id,
			title: "Other",
		});
		const linked = await relateWork(prisma, {
			actorId,
			baseRevision: related.revision,
			fromWorkId: itemId,
			idempotencyKey: "relate-item",
			origin: "human",
			toWorkId: related.id,
		});
		expect(linked.status).toBe("rejected");
		const planned = await applyPlanningMembership(prisma, {
			actorId,
			surface: "Backlog",
			workId: itemId,
		});
		expect(planned.status).toBe("rejected");
		expect(listed[0].key).not.toBe(itemId);
	});

	it("does not close Work or write status when every item is completed", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const first = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-one",
			origin: "human",
			title: "One",
			workId: work.id,
		});
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			throw new Error("expected committed add");
		}
		const second = await addChecklistItem(prisma, {
			actorId,
			baseRevision: first.checklist.work.revision,
			idempotencyKey: "add-two",
			origin: "human",
			title: "Two",
			workId: work.id,
		});
		expect(second.status).toBe("committed");
		if (second.status !== "committed") {
			throw new Error("expected committed second add");
		}
		const checkFirst = await setChecklistItemCompleted(prisma, {
			actorId,
			baseRevision: second.checklist.work.revision,
			completed: true,
			idempotencyKey: "check-one",
			itemId: second.checklist.items[0].id,
			origin: "human",
			workId: work.id,
		});
		expect(checkFirst.status).toBe("committed");
		if (checkFirst.status !== "committed") {
			throw new Error("expected committed first check");
		}
		const checkSecond = await setChecklistItemCompleted(prisma, {
			actorId,
			baseRevision: checkFirst.checklist.work.revision,
			completed: true,
			idempotencyKey: "check-two",
			itemId: checkFirst.checklist.items[1].id,
			origin: "human",
			workId: work.id,
		});
		expect(checkSecond.status).toBe("committed");
		if (checkSecond.status !== "committed") {
			throw new Error("expected committed second check");
		}
		expect(checkSecond.checklist.items.every((item) => item.completed)).toBe(
			true
		);
		expect(checkSecond.checklist.work).toMatchObject({
			closureResult: null,
			id: work.id,
			status: "Not Started",
		});
		const live = await getWork(prisma, work.id);
		expect(live).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
		expect(await listWorkLifecycleHistory(prisma, work.id)).toEqual([]);
	});

	it("does not model Feature included-Work as Checklist items", async () => {
		const { actorId, project } = await openPayments(prisma);
		const feature = await committedWork(prisma, actorId, {
			idempotencyKey: "feature-checkout",
			projectId: project.id,
			title: "Checkout",
			type: "Feature",
		});
		const intake = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake checkout",
			type: "Task",
		});
		const included = await includeWork(prisma, {
			actorId,
			baseRevision: intake.revision,
			featureId: feature.id,
			idempotencyKey: "include-intake",
			origin: "human",
			workId: intake.id,
		});
		expect(included).toMatchObject({
			status: "committed",
			work: { id: intake.id, type: "Task" },
		});
		const checklist = await getWorkChecklist(prisma, feature.id);
		expect(checklist?.items).toEqual([]);
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: feature.revision,
			idempotencyKey: "add-on-feature",
			origin: "human",
			title: "Ship notes",
			workId: feature.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		const scope = await getWorkScope(prisma, feature.id);
		expect(scope?.includedWork.map((row) => row.id)).toEqual([intake.id]);
		expect(added.checklist.items.map((item) => item.id)).not.toContain(
			intake.id
		);
		const listed = await listWork(prisma, project.id);
		expect(listed.map((row) => row.id).sort()).toEqual(
			[feature.id, intake.id].sort()
		);
	});

	it("previews Convert to independent Work without writing", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-draft",
			origin: "human",
			title: "Draft copy",
			workId: work.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		const receiptsBefore = await prisma.mutationReceipt.count();
		const preview = await previewConvertChecklistItem(prisma, {
			itemId: added.checklist.items[0].id,
			workId: work.id,
		});
		expect(preview).toMatchObject({
			preview: {
				origin: { id: work.id, key: "PAY-1" },
				originLocation: {
					componentId: added.checklist.items[0].id,
					ownerId: work.id,
					ownerKind: "Work",
					sourceVersion: String(added.checklist.work.revision),
				},
				projectId: project.id,
				projectName: "Payments",
				startStatus: "Not Started",
				title: "Draft copy",
			},
			status: "ok",
		});
		expect(await listWork(prisma, project.id)).toHaveLength(1);
		expect(await prisma.mutationReceipt.count()).toBe(receiptsBefore);
		expect(JSON.stringify(WORK_CHECKLISTS_COPY)).toContain(
			"Convert to independent Work"
		);
		expect(JSON.stringify(preview)).not.toMatch(FORBIDDEN_PRODUCT);
		expect(workspaceId).toBeTruthy();
	});

	it("converts an item to independent Work with origin and no hierarchy", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-draft",
			origin: "human",
			title: "Draft copy",
			workId: work.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		const itemId = added.checklist.items[0].id;
		const sourceVersion = String(added.checklist.work.revision);
		expect(
			await convertChecklistItem(prisma, {
				actorId,
				baseRevision: added.checklist.work.revision,
				idempotencyKey: "convert-draft",
				itemId,
				origin: "human",
				workId: work.id,
			})
		).toMatchObject({ reason: "preview-required", status: "rejected" });
		expect(await listWork(prisma, project.id)).toHaveLength(1);
		const converted = await convertChecklistItem(prisma, {
			actorId,
			baseRevision: added.checklist.work.revision,
			idempotencyKey: "convert-draft",
			itemId,
			origin: "human",
			previewAcknowledged: true,
			workId: work.id,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed") {
			throw new Error("expected committed convert");
		}
		expect(converted.convertedWork).toMatchObject({
			projectId: project.id,
			status: "Not Started",
			title: "Draft copy",
		});
		expect(converted.convertedWork.id).not.toBe(work.id);
		expect(converted.convertedWork.id).not.toBe(itemId);
		expect(converted.checklist.work).toMatchObject({
			closureResult: null,
			id: work.id,
			status: "Not Started",
		});
		expect(converted.checklist.items).toEqual([
			{
				completed: false,
				convertedWork: {
					id: converted.convertedWork.id,
					key: converted.convertedWork.key,
				},
				id: itemId,
				title: "Draft copy",
			},
		]);
		const listed = await listWork(prisma, project.id);
		expect(listed.map((row) => row.id).sort()).toEqual(
			[work.id, converted.convertedWork.id].sort()
		);
		expect(await getWork(prisma, itemId)).toBeNull();
		expect(await getWorkByKey(prisma, project.id, "Draft copy")).toBeNull();
		expect(
			await getWorkByKey(prisma, project.id, converted.convertedWork.key)
		).toMatchObject({
			id: converted.convertedWork.id,
			status: "Not Started",
		});
		const origin = await listRelations(prisma, {
			record: { id: converted.convertedWork.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(origin).toMatchObject([
			{
				from: { id: work.id, kind: "Work" },
				originLocation: {
					componentId: itemId,
					missing: false,
					ownerId: work.id,
					ownerKind: "Work",
					sourceVersion,
				},
				to: { id: converted.convertedWork.id, kind: "Work" },
				type: RELATIONS_COPY.origin,
			},
		]);
		expect(origin[0]?.typeLabelTo).toBe(RELATIONS_COPY.origin);
		expect(origin[0]?.typeLabelFrom).toBe(RELATIONS_COPY.derived);
		expect(await getWorkScope(prisma, work.id)).toMatchObject({
			includedWork: [],
		});
		expect(
			await getWorkScope(prisma, converted.convertedWork.id)
		).toMatchObject({
			includedWork: [],
		});
		expect(JSON.stringify(converted)).not.toMatch(HIERARCHY_PATTERN);
		expect(JSON.stringify(origin)).not.toMatch(HIERARCHY_PATTERN);
		const replayed = await convertChecklistItem(prisma, {
			actorId,
			baseRevision: added.checklist.work.revision,
			idempotencyKey: "convert-draft",
			itemId,
			origin: "human",
			previewAcknowledged: true,
			workId: work.id,
		});
		expect(replayed).toMatchObject({
			convertedWork: { id: converted.convertedWork.id },
			status: "replayed",
		});
		expect(await listWork(prisma, project.id)).toHaveLength(2);
		expect(
			await convertChecklistItem(prisma, {
				actorId,
				baseRevision: converted.checklist.work.revision,
				idempotencyKey: "convert-again",
				itemId,
				origin: "human",
				previewAcknowledged: true,
				workId: work.id,
			})
		).toMatchObject({ reason: "already-converted", status: "rejected" });
		expect(await listWork(prisma, project.id)).toHaveLength(2);
	});

	it("does not convert when a Checklist item is checked", async () => {
		const { actorId, project } = await openPayments(prisma);
		const work = await committedWork(prisma, actorId, {
			idempotencyKey: "task-intake",
			projectId: project.id,
			title: "Intake",
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "add-draft",
			origin: "human",
			title: "Draft copy",
			workId: work.id,
		});
		expect(added.status).toBe("committed");
		if (added.status !== "committed") {
			throw new Error("expected committed add");
		}
		const checked = await setChecklistItemCompleted(prisma, {
			actorId,
			baseRevision: added.checklist.work.revision,
			completed: true,
			idempotencyKey: "check-draft",
			itemId: added.checklist.items[0].id,
			origin: "human",
			workId: work.id,
		});
		expect(checked.status).toBe("committed");
		if (checked.status !== "committed") {
			throw new Error("expected committed check");
		}
		expect(checked.checklist.items[0]).toMatchObject({
			completed: true,
			title: "Draft copy",
		});
		expect(checked.checklist.items[0].convertedWork).toBeUndefined();
		expect(await listWork(prisma, project.id)).toEqual([
			expect.objectContaining({ id: work.id, status: "Not Started" }),
		]);
		expect(await listWorkLifecycleHistory(prisma, work.id)).toEqual([]);
	});
});
