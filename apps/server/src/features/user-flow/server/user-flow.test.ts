/**
 * User Flow seam — Project design master; Screen nodes live-ref Screen id
 * (kullanım bağı, not Kökeni). Archive / broken / trash matrix.
 * docs/specs/49-user-flow/spec.md and GitHub #354 / UND-209.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kullanıcı Akışı: live refs, broken/archive matrix).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { USAGE_KIND } from "../../relations/server/relations-model";
import {
	archiveScreen,
	createScreen,
	permanentlyDeleteScreen,
	redactScreen,
	restoreScreen,
	trashScreen,
} from "./screen-double";
import {
	createUserFlow,
	getUserFlow,
	placeScreenNode,
	updateNodePathText,
} from "./user-flow";
import {
	collectionMembershipFrom,
	computedCountsFrom,
	exportContentFrom,
	searchHitsFrom,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
} from "./user-flow-model";

const DATABASE_URL = localTestDatabaseUrl();
const SECRET_BODY = "SECRET-SCREEN-BODY-MUST-NOT-LEAK";
const OTHER_SCREEN_TITLE = "Checkout confirmation";

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

async function openProject(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Atlas",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

async function addScreen(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body?: string;
		projectId: string;
		title: string;
		wireframeVersions?: { id: string; preview: string }[];
	}
) {
	const created = await createScreen(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.body,
			projectId: input.projectId,
			title: input.title,
			wireframeVersions: input.wireframeVersions,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Screen");
	}
	return created.screen;
}

async function addFlow(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string; title: string }
) {
	const created = await createUserFlow(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			projectId: input.projectId,
			title: input.title,
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected committed User Flow");
	}
	return created.flow;
}

describe("User Flow live Screen refs", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	afterEach(async () => {
		await prisma.usageLink.deleteMany();
		await prisma.usageHostEmbed.deleteMany();
		await prisma.typedRelation.deleteMany();
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.user.deleteMany();
		await prisma.$disconnect();
		await pool.end();
	});

	it("uses English User Flow, Archived, and Open Source Record labels", () => {
		expect(USER_FLOW_COPY.userFlow).toBe("User Flow");
		expect(USER_FLOW_COPY.archived).toBe("Archived");
		expect(USER_FLOW_COPY.openSourceRecord).toBe("Open Source Record");
	});

	it("binds a Screen node as a live usage link, not a Screen copy or Origin", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const screen = await addScreen(prisma, {
			actorId,
			body: SECRET_BODY,
			projectId: project.id,
			title: "Checkout",
			wireframeVersions: [{ id: "wf-current", preview: "preview-checkout-v1" }],
		});
		const screenCountBefore = await prisma.screen.count();
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		expect(flow.recordKind).toBe(USER_FLOW_RECORD_KIND);
		expect(flow.copy.userFlow).toBe("User Flow");

		const placed = await placeScreenNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				chosenWireframeVersionId: "wf-current",
				pathText: {
					condition: "card on file",
					decision: "pay now",
					description: "Enter payment",
					transition: "after cart",
				},
				screenId: screen.id,
				userFlowId: flow.id,
			},
		});
		if (placed.status !== "committed") {
			throw new Error("expected placed node");
		}
		expect(await prisma.screen.count()).toBe(screenCountBefore);
		expect(placed.flow.originRelations).toEqual([]);
		expect(placed.flow.usageLinks).toEqual([
			expect.objectContaining({
				kind: USAGE_KIND.flowNodeScreenReference,
				sourceRecordId: screen.id,
			}),
		]);
		expect(placed.flow.nodes).toHaveLength(1);
		const [node] = placed.flow.nodes;
		expect(node?.screenId).toBe(screen.id);
		expect(node?.screenTitle).toBe("Checkout");
		expect(node?.preview).toBe("preview-checkout-v1");
		expect(node?.openSourceRecord).toBe("Open Source Record");
		expect(node?.pathText.description).toBe("Enter payment");
		expect(JSON.stringify(placed.flow)).not.toContain(SECRET_BODY);

		const renamed = await prisma.screen.update({
			data: { title: "Checkout live" },
			where: { id: screen.id },
		});
		expect(renamed.id).toBe(screen.id);
		const live = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(live?.nodes[0]?.screenTitle).toBe("Checkout live");
		expect(live?.nodes[0]?.screenId).toBe(screen.id);
	});

	it("keeps path text on the node when the Screen title changes", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const screen = await addScreen(prisma, {
			actorId,
			projectId: project.id,
			title: "Cart",
		});
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Shop path",
		});
		const placed = await placeScreenNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				pathText: {
					condition: "",
					decision: "",
					description: "node-local path",
					transition: "",
				},
				screenId: screen.id,
				userFlowId: flow.id,
			},
		});
		if (placed.status !== "committed") {
			throw new Error("expected placed node");
		}
		const updated = await updateNodePathText(prisma, {
			actorId,
			baseRevision: placed.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: placed.flow.nodes[0]?.id ?? "",
				pathText: {
					condition: "in stock",
					decision: "",
					description: "node-local path",
					transition: "next",
				},
				userFlowId: flow.id,
			},
		});
		if (updated.status !== "committed") {
			throw new Error("expected path update");
		}
		const view = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(view?.nodes[0]?.pathText).toEqual({
			condition: "in stock",
			decision: "",
			description: "node-local path",
			transition: "next",
		});
	});

	it("shows Archived and still opens the source Screen", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const screen = await addScreen(prisma, {
			actorId,
			projectId: project.id,
			title: "Settings",
		});
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Account path",
		});
		const placed = await placeScreenNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: screen.id, userFlowId: flow.id },
		});
		if (placed.status !== "committed") {
			throw new Error("expected placed node");
		}
		const archived = await archiveScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: screen.id },
		});
		expect(archived.status).toBe("committed");
		const view = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(view?.nodes[0]?.reason).toBe(USER_FLOW_COPY.archived);
		expect(view?.nodes[0]?.resolution).toBe("archived");
		expect(view?.nodes[0]?.openSourceRecord).toBe("Open Source Record");
		expect(view?.nodes[0]?.openHref).toContain(screen.id);
		expect(view?.nodes[0]?.screenId).toBe(screen.id);
		expect(view?.copy.archived).toBe("Archived");
	});

	it("keeps a trash target broken without leaking body or retargeting", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const screen = await addScreen(prisma, {
			actorId,
			body: SECRET_BODY,
			projectId: project.id,
			title: "Pay",
		});
		const other = await addScreen(prisma, {
			actorId,
			projectId: project.id,
			title: OTHER_SCREEN_TITLE,
		});
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		const placed = await placeScreenNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: screen.id, userFlowId: flow.id },
		});
		if (placed.status !== "committed") {
			throw new Error("expected placed node");
		}
		await trashScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: screen.id },
		});
		const view = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(view?.nodes[0]?.resolution).toBe("broken");
		expect(view?.nodes[0]?.reason).toBe(RELATIONS_COPY.inTrash);
		expect(view?.nodes[0]?.screenId).toBe(screen.id);
		expect(view?.nodes[0]?.screenId).not.toBe(other.id);
		expect(view?.nodes[0]?.preview).toBeNull();
		expect(view?.nodes[0]?.openSourceRecord).toBe("Open Source Record");
		expect(JSON.stringify(view)).not.toContain(SECRET_BODY);
		expect(searchHitsFrom(view ?? { nodes: [], title: "" })).not.toContain(
			SECRET_BODY
		);
		expect(searchHitsFrom(view ?? { nodes: [], title: "" })).not.toContain(
			OTHER_SCREEN_TITLE
		);
		expect(collectionMembershipFrom(view?.nodes ?? [])).toEqual([]);
		expect(computedCountsFrom(view?.nodes ?? [])).toEqual({
			brokenTargets: 0,
			liveScreens: 0,
		});
		expect(exportContentFrom(view ?? { nodes: [], title: "" })).not.toContain(
			SECRET_BODY
		);

		await restoreScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: screen.id },
		});
		const restored = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(restored?.nodes[0]?.screenId).toBe(screen.id);
		expect(restored?.nodes[0]?.resolution).toBe("ok");
		expect(restored?.nodes[0]?.screenTitle).toBe("Pay");
		expect(collectionMembershipFrom(restored?.nodes ?? [])).toEqual([
			screen.id,
		]);
	});

	it("presents permanently deleted, redacted, and inaccessible targets without a body leak", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const deleted = await addScreen(prisma, {
			actorId,
			body: SECRET_BODY,
			projectId: project.id,
			title: "Gone",
		});
		const redacted = await addScreen(prisma, {
			actorId,
			body: SECRET_BODY,
			projectId: project.id,
			title: "Private",
		});
		const foreign = await addScreen(prisma, {
			actorId,
			body: SECRET_BODY,
			projectId: project.id,
			title: "Other workspace",
		});
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Broken matrix",
		});
		const first = await placeScreenNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: deleted.id, userFlowId: flow.id },
		});
		if (first.status !== "committed") {
			throw new Error("expected placed node");
		}
		const second = await placeScreenNode(prisma, {
			actorId,
			baseRevision: first.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: redacted.id, userFlowId: flow.id },
		});
		if (second.status !== "committed") {
			throw new Error("expected placed node");
		}
		const third = await placeScreenNode(prisma, {
			actorId,
			baseRevision: second.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: foreign.id, userFlowId: flow.id },
		});
		if (third.status !== "committed") {
			throw new Error("expected placed node");
		}
		await permanentlyDeleteScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: deleted.id },
		});
		await redactScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { screenId: redacted.id },
		});
		const otherWorkspace = await prisma.workspace.create({
			data: {
				id: crypto.randomUUID(),
				name: "Other",
				ownerId: (
					await prisma.user.create({
						data: {
							email: `other-${crypto.randomUUID()}@example.com`,
							emailVerified: true,
							id: crypto.randomUUID(),
							name: "Other",
						},
					})
				).id,
			},
		});

		const asOwner = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		const gone = asOwner?.nodes.find((node) => node.screenId === deleted.id);
		expect(gone?.resolution).toBe("broken");
		expect(gone?.reason).toBe(RELATIONS_COPY.permanentlyDeleted);
		expect(gone?.openSourceRecord).toBeNull();
		expect(gone?.screenTitle).toBeNull();

		const redactedNode = asOwner?.nodes.find(
			(node) => node.screenId === redacted.id
		);
		expect(redactedNode?.reason).toBe(RELATIONS_COPY.redactedForSecurity);
		expect(redactedNode?.screenTitle).toBeNull();
		expect(redactedNode?.openSourceRecord).toBeNull();

		const outsider = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId: otherWorkspace.id,
		});
		const hidden = outsider?.nodes.find((node) => node.screenId === foreign.id);
		expect(hidden?.reason).toBe(RELATIONS_COPY.noAccess);
		expect(hidden?.screenTitle).toBeNull();
		expect(JSON.stringify(outsider)).not.toContain(SECRET_BODY);
		expect(JSON.stringify(asOwner)).not.toContain(SECRET_BODY);
		expect(searchHitsFrom(asOwner ?? { nodes: [], title: "" })).not.toContain(
			SECRET_BODY
		);
		expect(searchHitsFrom(asOwner ?? { nodes: [], title: "" })).not.toContain(
			"Gone"
		);
		expect(
			exportContentFrom(asOwner ?? { nodes: [], title: "" })
		).not.toContain(SECRET_BODY);
	});
});
