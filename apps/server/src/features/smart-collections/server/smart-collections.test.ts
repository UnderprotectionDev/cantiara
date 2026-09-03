/**
 * Smart Collections seam — live membership from visual conditions,
 * no stored member list, pins and exceptions refused, drag preview
 * is a field write not parenting. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki: membership counts only from accessible exact
 * sources; Documents metadata/tags/scope only).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { RECORD_DISCOVERY_COPY } from "../../record-discovery/server/record-discovery-copy";
import {
	changeWorkStatus,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	addException,
	createSmartCollection,
	defineSmartCollection,
	deriveMembership,
	listSmartCollections,
	pinMember,
	previewDragOntoCollection,
	viewSmartCollection,
} from "./smart-collections";
import {
	type CollectionRecord,
	type MembershipCondition,
	SMART_COLLECTIONS_COPY,
	smartCollectionsCatalog,
} from "./smart-collections-model";

const FREE_QUERY_PATTERN = /advanced query|query language|JQL|Lucene|SQL/i;

const STATUS_IN_PROGRESS: MembershipCondition = {
	field: "status",
	operator: "equals",
	value: "In Progress",
};

function workRecord(
	partial: Partial<CollectionRecord> & Pick<CollectionRecord, "id" | "title">
): CollectionRecord {
	return {
		kind: RECORD_DISCOVERY_COPY.work,
		projectId: "project-atlas",
		status: "Not Started",
		tagIds: [],
		type: "Task",
		...partial,
	};
}

function documentRecord(
	partial: Partial<CollectionRecord> & Pick<CollectionRecord, "id" | "title">
): CollectionRecord {
	return {
		body: "secret architecture notes",
		kind: RECORD_DISCOVERY_COPY.document,
		projectId: "project-atlas",
		scopeKind: "project",
		tagIds: [],
		type: "Note",
		...partial,
	};
}

describe("Smart Collections catalog", () => {
	it("uses English Smart Collection copy and no free query language", () => {
		const catalog = smartCollectionsCatalog();
		expect(catalog.copy.smartCollection).toBe("Smart Collection");
		expect(catalog.copy.noneYet).toBe("No Smart Collection yet.");
		expect(SMART_COLLECTIONS_COPY.smartCollection).toBe("Smart Collection");
		expect(JSON.stringify(catalog.copy)).not.toMatch(FREE_QUERY_PATTERN);
		expect(catalog.copy).not.toHaveProperty("query");
	});
});

describe("Smart Collections live membership", () => {
	it("defines a collection without a stored member list, pins, or query string", () => {
		const defined = defineSmartCollection({
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: "project-atlas",
			sourceKind: RECORD_DISCOVERY_COPY.work,
		});
		expect(defined.status).toBe("ok");
		if (defined.status !== "ok") {
			return;
		}
		expect(defined.collection).not.toHaveProperty("members");
		expect(defined.collection).not.toHaveProperty("pins");
		expect(defined.collection).not.toHaveProperty("exceptions");
		expect(defined.collection).not.toHaveProperty("query");
		expect(defined.collection.conditions).toEqual([STATUS_IN_PROGRESS]);
	});

	it("re-derives membership when conditions change; there is no stored member list", () => {
		const defined = defineSmartCollection({
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: "project-atlas",
			sourceKind: RECORD_DISCOVERY_COPY.work,
		});
		expect(defined.status).toBe("ok");
		if (defined.status !== "ok") {
			return;
		}
		const catalog = [
			workRecord({
				id: "work-open",
				status: "In Progress",
				title: "Ship login",
			}),
			workRecord({
				id: "work-idle",
				status: "Not Started",
				title: "Write ADR",
			}),
		];
		const first = deriveMembership(defined.collection, catalog);
		expect(first.members.map((member) => member.id)).toEqual(["work-open"]);
		expect(first.members[0]?.because).toEqual([
			{
				field: "status",
				label: "Status is In Progress",
			},
		]);
		expect(first.summary).toBe("Status is In Progress");

		const next = defineSmartCollection({
			conditions: [
				{
					field: "status",
					operator: "equals",
					value: "Not Started",
				},
			],
			name: defined.collection.name,
			projectId: defined.collection.projectId,
			sourceKind: defined.collection.sourceKind,
		});
		expect(next.status).toBe("ok");
		if (next.status !== "ok") {
			return;
		}
		const second = deriveMembership(next.collection, catalog);
		expect(second.members.map((member) => member.id)).toEqual(["work-idle"]);
		expect(first.members.map((member) => member.id)).toEqual(["work-open"]);
	});

	it("refuses pins and filter exceptions", () => {
		const defined = defineSmartCollection({
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: "project-atlas",
			sourceKind: RECORD_DISCOVERY_COPY.work,
		});
		expect(defined.status).toBe("ok");
		if (defined.status !== "ok") {
			return;
		}
		expect(pinMember(defined.collection, "work-idle")).toEqual({
			parenting: false,
			reason: "pin-not-allowed",
			status: "refused",
		});
		expect(addException(defined.collection, "work-open")).toEqual({
			parenting: false,
			reason: "exception-not-allowed",
			status: "refused",
		});
		expect(
			defineSmartCollection({
				conditions: [STATUS_IN_PROGRESS],
				members: ["work-idle"],
				name: "Pinned",
				projectId: "project-atlas",
				sourceKind: RECORD_DISCOVERY_COPY.work,
			}).status
		).toBe("refused");
	});

	it("previews a field write on drag and never writes a pin or parent", () => {
		const defined = defineSmartCollection({
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: "project-atlas",
			sourceKind: RECORD_DISCOVERY_COPY.work,
		});
		expect(defined.status).toBe("ok");
		if (defined.status !== "ok") {
			return;
		}
		const idle = workRecord({
			id: "work-idle",
			status: "Not Started",
			title: "Write ADR",
		});
		expect(previewDragOntoCollection(defined.collection, idle)).toEqual({
			parenting: false,
			status: "preview",
			writes: [{ field: "status", value: "In Progress" }],
		});
	});

	it("keeps a cross-Project condition as live membership, not a static list", () => {
		const defined = defineSmartCollection({
			conditions: [STATUS_IN_PROGRESS],
			name: "Workspace Active Work",
			projectId: null,
			sourceKind: RECORD_DISCOVERY_COPY.work,
		});
		expect(defined.status).toBe("ok");
		if (defined.status !== "ok") {
			return;
		}
		const catalog = [
			workRecord({
				id: "atlas-open",
				projectId: "project-atlas",
				status: "In Progress",
				title: "Atlas login",
			}),
			workRecord({
				id: "nova-open",
				projectId: "project-nova",
				status: "In Progress",
				title: "Nova billing",
			}),
			workRecord({
				id: "atlas-idle",
				projectId: "project-atlas",
				status: "Not Started",
				title: "Atlas docs",
			}),
		];
		const view = deriveMembership(defined.collection, catalog);
		expect(view.members.map((member) => member.id)).toEqual([
			"atlas-open",
			"nova-open",
		]);
		expect(defined.collection).not.toHaveProperty("folderId");
		expect(defined.collection).not.toHaveProperty("tagAsCollection");
	});

	it("lets a Document join only on structured metadata, tags, and scope", () => {
		const tagged = defineSmartCollection({
			conditions: [
				{ field: "tagId", operator: "equals", value: "tag-spec" },
				{ field: "scopeKind", operator: "equals", value: "project" },
				{ field: "type", operator: "equals", value: "Note" },
			],
			name: "Spec notes",
			projectId: "project-atlas",
			sourceKind: RECORD_DISCOVERY_COPY.document,
		});
		expect(tagged.status).toBe("ok");
		if (tagged.status !== "ok") {
			return;
		}
		const catalog = [
			documentRecord({
				id: "doc-match",
				tagIds: ["tag-spec"],
				title: "Login spec",
			}),
			documentRecord({
				body: "tag-spec",
				id: "doc-body-only",
				tagIds: [],
				title: "Mentions the tag in body",
			}),
		];
		const view = deriveMembership(tagged.collection, catalog);
		expect(view.members.map((member) => member.id)).toEqual(["doc-match"]);
		expect(
			defineSmartCollection({
				conditions: [
					{
						field: "body",
						operator: "equals",
						value: "secret architecture notes",
					},
				],
				name: "Body search",
				projectId: "project-atlas",
				sourceKind: RECORD_DISCOVERY_COPY.document,
			}).reason
		).toBe("document-body-condition");
	});

	it("refuses Screen, diagram, and File Attachment as sources", () => {
		expect(
			defineSmartCollection({
				conditions: [],
				name: "Screens",
				projectId: "project-atlas",
				sourceKind: RECORD_DISCOVERY_COPY.screen,
			}).reason
		).toBe("source-not-allowed");
		expect(
			defineSmartCollection({
				conditions: [],
				name: "Diagrams",
				projectId: "project-atlas",
				sourceKind: RECORD_DISCOVERY_COPY.technicalDiagram,
			}).reason
		).toBe("source-not-allowed");
		expect(
			defineSmartCollection({
				conditions: [],
				name: "Files",
				projectId: "project-atlas",
				sourceKind: RECORD_DISCOVERY_COPY.fileAttachment,
			}).reason
		).toBe("source-not-allowed");
	});

	it("refuses a free query string instead of visual conditions", () => {
		expect(
			defineSmartCollection({
				conditions: [STATUS_IN_PROGRESS],
				name: "Query dump",
				projectId: "project-atlas",
				query: "status:open AND project:atlas",
				sourceKind: RECORD_DISCOVERY_COPY.work,
			}).reason
		).toBe("free-query");
	});
});

describe("Smart Collections stored definition", () => {
	const DATABASE_URL = localTestDatabaseUrl();
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspaceShortCodeReservation.deleteMany();
		await prisma.project.deleteMany();
		await prisma.accountPreference.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.verification.deleteMany();
		await prisma.user.deleteMany();
	});

	it("stores conditions only and re-derives membership from live Work", async () => {
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
		const createdProject = await createProject(prisma, {
			actorId: user.id,
			idempotencyKey: "create-atlas",
			origin: "human",
			payload: {
				name: "Atlas",
				starterConfiguration: "Blank Project",
			},
			workspaceId: workspace.id,
		});
		expect(createdProject.status).toBe("committed");
		if (createdProject.status !== "committed") {
			return;
		}
		const open = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "work-open",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Ship login",
				type: "Task",
			},
		});
		const idle = await createWork(prisma, {
			actorId: user.id,
			idempotencyKey: "work-idle",
			origin: "human",
			payload: {
				projectId: createdProject.project.id,
				title: "Write ADR",
				type: "Task",
			},
		});
		expect(open.status).toBe("committed");
		expect(idle.status).toBe("committed");
		if (open.status !== "committed" || idle.status !== "committed") {
			return;
		}
		const progressed = await changeWorkStatus(prisma, {
			actorId: user.id,
			baseRevision: open.work.revision,
			idempotencyKey: "to-in-progress",
			origin: "human",
			status: "In Progress",
			workId: open.work.id,
		});
		expect(progressed.status).toBe("committed");
		const stored = await createSmartCollection(prisma, {
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: createdProject.project.id,
			sourceKind: RECORD_DISCOVERY_COPY.work,
			workspaceId: workspace.id,
		});
		expect(stored.status).toBe("ok");
		if (stored.status !== "ok") {
			return;
		}
		expect(stored.collection).not.toHaveProperty("members");
		const view = await viewSmartCollection(
			prisma,
			workspace.id,
			stored.collection.id
		);
		expect(view?.membership.members.map((member) => member.id)).toEqual([
			open.work.id,
		]);
		expect("smartCollectionMember" in prisma).toBe(false);
	});

	it("stores a Smart Collection when the Prisma delegate is missing", async () => {
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
		const withoutDelegate = new Proxy(prisma, {
			get(target, prop, receiver) {
				if (prop === "smartCollection") {
					return;
				}
				const value = Reflect.get(target, prop, receiver);
				if (typeof value === "function") {
					return value.bind(target);
				}
				return value;
			},
		}) as PrismaClient;
		const stored = await createSmartCollection(withoutDelegate, {
			conditions: [STATUS_IN_PROGRESS],
			name: "Active Work",
			projectId: null,
			sourceKind: RECORD_DISCOVERY_COPY.work,
			workspaceId: workspace.id,
		});
		expect(stored.status).toBe("ok");
		if (stored.status !== "ok") {
			return;
		}
		const listed = await listSmartCollections(withoutDelegate, workspace.id);
		expect(listed.map((collection) => collection.name)).toEqual([
			"Active Work",
		]);
		expect(listed[0]?.conditions).toEqual([STATUS_IN_PROGRESS]);
	});
});
