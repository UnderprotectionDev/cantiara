/**
 * User Flow seam — Project design master; Screen nodes live-ref Screen id
 * (kullanım bağı, not Kökeni). Closed semantic set, editor commons,
 * archive / broken / trash matrix.
 * docs/specs/49-user-flow/spec.md and GitHub #355 / UND-210 (also #354).
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kullanıcı Akışı: live refs, closed set, editor commons).
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
	applyEditorOp,
	createUserFlow,
	getUserFlow,
	placeFlowNode,
	placeScreenNode,
	updateNodePathText,
} from "./user-flow";
import {
	FLOW_GRID_SIZE,
	FOREIGN_SURFACE_KINDS,
	fitViewFrame,
	panCamera,
	STATE_MACHINE_KINDS,
	TECHNICAL_SEQUENCE_KINDS,
	userFlowCatalog,
	zoomCamera,
} from "./user-flow-editor";
import {
	collectionMembershipFrom,
	computedCountsFrom,
	exportContentFrom,
	parseFlowDocument,
	searchHitsFrom,
	serializeFlowDocument,
	USER_FLOW_COPY,
	USER_FLOW_RECORD_KIND,
	USER_FLOW_REJECTION,
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

const STALE_USER_FLOW_CLIENT = {
	$transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
		fn({
			$executeRaw: async () => 0,
			mutationReceipt: {
				create: async () => ({}),
				findUnique: async () => null,
			},
			userFlow: undefined,
		}),
} as unknown as PrismaClient;

const STALE_CREATE_COMMAND = {
	actorId: "actor_stale_client",
	idempotencyKey: "idem-stale-user-flow",
	origin: "human" as const,
	payload: { projectId: "proj_stale_client", title: "Design User Flow" },
};

/**
 * bun --hot can serve a Prisma client generated before UserFlow until
 * getPrismaClient refuses that client and regenerates. Fresh-client DB
 * tests below cannot catch the TypeError — they construct Prisma after
 * generate. This stub still must not evaluate tx.userFlow.create.
 */
describe("User Flow — missing Prisma delegate", () => {
	it("does not throw evaluating tx.userFlow.create", async () => {
		await expect(
			createUserFlow(STALE_USER_FLOW_CLIENT, STALE_CREATE_COMMAND)
		).rejects.toThrow(
			"Prisma client is missing current models; restart the API after prisma generate"
		);
	});
});

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
		expect(collectionMembershipFrom(view?.nodes ?? [])).toEqual([screen.id]);
		expect(computedCountsFrom(view?.nodes ?? [])).toEqual({ liveScreens: 1 });
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

describe("User Flow closed semantic set and editor commons", () => {
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

	it("exposes the closed set, Fit View, and counterpart refusals", () => {
		const catalog = userFlowCatalog();
		expect(catalog.semanticSet).toEqual([
			"Screen",
			"Action",
			"Decision",
			"State/Outcome",
			"Section",
		]);
		expect(catalog.copy.fitView).toBe("Fit View");
		expect(catalog.copy.action).toBe("Action");
		expect(catalog.copy.decision).toBe("Decision");
		expect(catalog.copy.stateOutcome).toBe("State/Outcome");
		expect(catalog.copy.section).toBe("Section");
		expect(catalog.counterparts).toEqual({
			colorAsType: false,
			moodboard: false,
			projectWall: false,
			shapeAsType: false,
			stateMachine: false,
			technicalSequence: false,
			xyflowPublicContract: false,
		});
		expect(catalog.editorCommons).toContain("Fit View");
		expect(catalog.editorCommons).toContain("undo");
		expect(catalog.technicalSequenceKinds).toEqual(TECHNICAL_SEQUENCE_KINDS);
	});

	it("places Action, Decision, State/Outcome, and Section without minting a Screen", async () => {
		const { actorId, project } = await openProject(prisma);
		const screenCountBefore = await prisma.screen.count();
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		const kinds = ["Action", "Decision", "State/Outcome", "Section"] as const;
		const labels = ["Tap pay", "Card on file?", "Paid", "Checkout"];
		const { revision } = flow;
		const first = await placeFlowNode(prisma, {
			actorId,
			baseRevision: revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: kinds[0],
				label: labels[0],
				layout: { x: 0, y: 40, z: 0 },
				userFlowId: flow.id,
			},
		});
		if (first.status !== "committed") {
			throw new Error("expected Action node");
		}
		const second = await placeFlowNode(prisma, {
			actorId,
			baseRevision: first.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: kinds[1],
				label: labels[1],
				layout: { x: 80, y: 40, z: 1 },
				userFlowId: flow.id,
			},
		});
		if (second.status !== "committed") {
			throw new Error("expected Decision node");
		}
		const third = await placeFlowNode(prisma, {
			actorId,
			baseRevision: second.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: kinds[2],
				label: labels[2],
				layout: { x: 160, y: 40, z: 2 },
				userFlowId: flow.id,
			},
		});
		if (third.status !== "committed") {
			throw new Error("expected State/Outcome node");
		}
		const fourth = await placeFlowNode(prisma, {
			actorId,
			baseRevision: third.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: kinds[3],
				label: labels[3],
				layout: { x: 240, y: 40, z: 3 },
				userFlowId: flow.id,
			},
		});
		if (fourth.status !== "committed") {
			throw new Error("expected Section node");
		}
		expect(fourth.flow.nodes.map((node) => node.kind)).toEqual([...kinds]);
		expect(fourth.flow.nodes.map((node) => node.label)).toEqual([...labels]);
		expect(fourth.flow.nodes.every((node) => node.screenId === null)).toBe(
			true
		);
		expect(await prisma.screen.count()).toBe(screenCountBefore);
	});

	it("rejects Technical Sequence, state-machine, Moodboard, and arbitrary shape kinds", async () => {
		const { actorId, project } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		const forbidden = [
			...TECHNICAL_SEQUENCE_KINDS,
			...STATE_MACHINE_KINDS,
			...FOREIGN_SURFACE_KINDS,
			"diamond",
			"hexagon",
		];
		const outcomes = await Promise.all(
			forbidden.map((kind) =>
				placeFlowNode(prisma, {
					actorId,
					baseRevision: flow.revision,
					idempotencyKey: crypto.randomUUID(),
					origin: "human",
					payload: {
						fill: "#ff00aa",
						kind,
						label: kind,
						shape: "diamond",
						userFlowId: flow.id,
					},
				})
			)
		);
		expect(outcomes).toEqual(
			forbidden.map(() => ({
				reason: USER_FLOW_REJECTION.closedSemanticSet,
				status: "rejected",
			}))
		);
		const live = await prisma.userFlow.findUnique({ where: { id: flow.id } });
		expect(parseFlowDocument(live?.document ?? "{}").nodes).toEqual([]);
	});

	it("strips color and shape so they cannot become a second type, and drops foreign kinds on read", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		const placed = await placeFlowNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				color: "danger-red",
				fill: "#c00",
				kind: "Action",
				label: "Submit",
				shape: "diamond",
				userFlowId: flow.id,
			},
		});
		if (placed.status !== "committed") {
			throw new Error("expected Action");
		}
		expect(placed.flow.nodes[0]?.kind).toBe("Action");
		expect(placed.flow.nodes[0]?.visualStyle).toEqual({ emphasis: "default" });
		const serialized = serializeFlowDocument({
			nodes: [
				{
					id: "n1",
					kind: "Action",
					label: "Submit",
					layout: { x: 0, y: 0, z: 0 },
					pathText: {
						condition: "",
						decision: "",
						description: "",
						transition: "",
					},
					visualStyle: { emphasis: "muted" },
				},
			],
		});
		expect(serialized).not.toContain("positionAbsolute");
		expect(serialized).not.toContain("sourceHandle");
		expect(serialized).not.toContain("#c00");
		expect(serialized).not.toContain("diamond");

		await prisma.userFlow.update({
			data: {
				document: JSON.stringify({
					nodes: [
						{
							id: "keep",
							kind: "Section",
							label: "Pay",
						},
						{
							id: "drop-seq",
							kind: "Lifeline",
							label: "API",
						},
						{
							data: { label: "xyflow" },
							id: "xy",
							kind: "Action",
							label: "Still Action",
							measured: { height: 40, width: 120 },
							positionAbsolute: { x: 9, y: 9 },
							type: "default",
						},
					],
					viewport: { x: 1, y: 2, zoom: 3 },
				}),
			},
			where: { id: flow.id },
		});
		const view = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId,
		});
		expect(view?.nodes.map((node) => node.kind).sort()).toEqual([
			"Action",
			"Section",
		]);
		expect(JSON.stringify(view)).not.toContain("Lifeline");
		expect(JSON.stringify(view)).not.toContain("positionAbsolute");
		expect(JSON.stringify(view)).not.toContain("xyflow");
	});

	it("aligns, restacks, snaps, copies, undoes, and fits without writing camera into the document", async () => {
		const { actorId, project } = await openProject(prisma);
		const screenCountBefore = await prisma.screen.count();
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Pay path",
		});
		const first = await placeFlowNode(prisma, {
			actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: "Action",
				label: "Tap",
				layout: { x: 10, y: 10, z: 0 },
				userFlowId: flow.id,
			},
		});
		if (first.status !== "committed") {
			throw new Error("expected first node");
		}
		const second = await placeFlowNode(prisma, {
			actorId,
			baseRevision: first.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: "Decision",
				label: "Retry?",
				layout: { x: 90, y: 50, z: 1 },
				userFlowId: flow.id,
			},
		});
		if (second.status !== "committed") {
			throw new Error("expected second node");
		}
		const ids = second.flow.nodes.map((node) => node.id);
		const aligned = await applyEditorOp(prisma, {
			actorId,
			baseRevision: second.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				axis: "left",
				nodeIds: ids,
				op: "align",
				userFlowId: flow.id,
			},
		});
		if (aligned.status !== "committed") {
			throw new Error("expected align");
		}
		expect(aligned.flow.nodes.every((node) => node.layout.x === 10)).toBe(true);

		const stacked = await applyEditorOp(prisma, {
			actorId,
			baseRevision: aligned.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				direction: "front",
				nodeIds: [ids[0] ?? ""],
				op: "z-order",
				userFlowId: flow.id,
			},
		});
		if (stacked.status !== "committed") {
			throw new Error("expected z-order");
		}
		const front = stacked.flow.nodes.find((node) => node.id === ids[0]);
		const back = stacked.flow.nodes.find((node) => node.id === ids[1]);
		expect((front?.layout.z ?? 0) > (back?.layout.z ?? 0)).toBe(true);

		const moved = await applyEditorOp(prisma, {
			actorId,
			baseRevision: stacked.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				deltaX: 7,
				deltaY: 9,
				nodeIds: ids,
				op: "move",
				userFlowId: flow.id,
			},
		});
		if (moved.status !== "committed") {
			throw new Error("expected move");
		}
		const snapped = await applyEditorOp(prisma, {
			actorId,
			baseRevision: moved.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeIds: ids,
				op: "grid",
				userFlowId: flow.id,
			},
		});
		if (snapped.status !== "committed") {
			throw new Error("expected grid");
		}
		expect(
			snapped.flow.nodes.every(
				(node) =>
					node.layout.x % FLOW_GRID_SIZE === 0 &&
					node.layout.y % FLOW_GRID_SIZE === 0
			)
		).toBe(true);

		const copied = await applyEditorOp(prisma, {
			actorId,
			baseRevision: snapped.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeIds: [ids[0] ?? ""],
				op: "duplicate",
				userFlowId: flow.id,
			},
		});
		if (copied.status !== "committed") {
			throw new Error("expected duplicate");
		}
		expect(copied.flow.nodes).toHaveLength(3);
		expect(
			copied.flow.nodes.filter((node) => node.kind === "Action")
		).toHaveLength(2);

		const frame = fitViewFrame({
			nodes: snapped.flow.nodes.map((node) => {
				if (node.kind === "Action" || node.kind === "Decision") {
					return {
						id: node.id,
						kind: node.kind,
						label: node.label,
						layout: node.layout,
						pathText: node.pathText,
						visualStyle: node.visualStyle,
					};
				}
				throw new Error("expected path node");
			}),
		});
		const panned = panCamera(frame, 20, -10);
		const zoomed = zoomCamera(panned, 2);
		expect(zoomed.zoom).toBe(2);
		expect(panned.x).toBe(frame.x + 20);

		const undone = await applyEditorOp(prisma, {
			actorId,
			baseRevision: copied.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { op: "undo", userFlowId: flow.id },
		});
		if (undone.status !== "committed") {
			throw new Error("expected undo");
		}
		expect(undone.flow.nodes).toHaveLength(2);
		const stored = await prisma.userFlow.findUnique({ where: { id: flow.id } });
		expect(stored?.document).not.toContain('"viewport"');
		expect(await prisma.screen.count()).toBe(screenCountBefore);
	});
});
