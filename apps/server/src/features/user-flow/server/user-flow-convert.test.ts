/**
 * User Flow seam — Convert and Bind, Origin Location, Screen promotion,
 * templates without live source-Project bind, live cards.
 * docs/specs/49-user-flow/spec.md and GitHub #356.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kullanıcı Akışı kayda dönüştürme paketi).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import { createScreen } from "./screen-double";
import {
	applyEditorOp,
	createUserFlow,
	getUserFlow,
	placeFlowNode,
} from "./user-flow";
import {
	convertAndBind,
	instantiateUserFlowTemplate,
	moveLiveCard,
	placeLiveCard,
	previewConvertAndBind,
	previewRebindOrigin,
	promoteStepToScreen,
	rebindOrigin,
	removeLiveCard,
	saveUserFlowTemplate,
} from "./user-flow-bind";
import { USER_FLOW_COPY, USER_FLOW_REJECTION } from "./user-flow-model";

const DATABASE_URL = localTestDatabaseUrl();

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

async function openProject(prisma: PrismaClient, name = "Atlas") {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${crypto.randomUUID()}`,
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
	return { actorId, project: created.project, workspaceId };
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

async function addAction(
	prisma: PrismaClient,
	input: {
		actorId: string;
		description?: string;
		flowId: string;
		label: string;
		revision: number;
	}
) {
	const placed = await placeFlowNode(prisma, {
		actorId: input.actorId,
		baseRevision: input.revision,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			kind: USER_FLOW_COPY.action,
			label: input.label,
			pathText: {
				condition: "",
				decision: "",
				description: input.description ?? "Pay with saved card",
				transition: "",
			},
			userFlowId: input.flowId,
		},
	});
	if (placed.status !== "committed") {
		throw new Error("expected Action node");
	}
	const node = placed.flow.nodes.find(
		(item) => item.kind === USER_FLOW_COPY.action
	);
	if (!node) {
		throw new Error("expected Action");
	}
	return { flow: placed.flow, node };
}

describe("User Flow Convert and Bind", () => {
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

	it("does not mint a record until Convert and Bind is confirmed", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Enter payment",
			revision: flow.revision,
		});

		const previewed = await previewConvertAndBind(prisma, {
			nodeId: node.id,
			recordKind: USER_FLOW_COPY.work,
			userFlowId: flow.id,
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(previewed.preview.copy.convertAndBind).toBe("Convert and Bind");
		expect(previewed.preview.copy.originLocation).toBe("Origin Location");
		expect(previewed.preview.recordKind).toBe("Work");
		expect(previewed.preview.title).toBe("Enter payment");
		expect(previewed.preview.body).toBe("Pay with saved card");
		expect(previewed.preview.projectId).toBe(project.id);
		expect(previewed.preview.origin).toBe(RELATIONS_COPY.origin);
		expect(previewed.preview.originLocation).toEqual({
			componentId: node.id,
			ownerId: flow.id,
			ownerKind: "User Flow",
			sourceVersion: String(withNode.revision),
		});
		expect(await prisma.work.count()).toBe(0);

		expect(
			await convertAndBind(prisma, {
				actorId,
				baseRevision: withNode.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					nodeId: node.id,
					recordKind: USER_FLOW_COPY.work,
					userFlowId: flow.id,
				},
				previewAcknowledged: false,
			})
		).toEqual({
			reason: USER_FLOW_REJECTION.previewRequired,
			status: "rejected",
		});
		expect(await prisma.work.count()).toBe(0);
	});

	it("confirms exactly one Work with immutable Origin Location and leaves the node", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Enter payment",
			revision: flow.revision,
		});

		const converted = await convertAndBind(prisma, {
			actorId,
			baseRevision: withNode.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: node.id,
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
			previewAcknowledged: true,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed") {
			throw new Error("expected convert");
		}
		expect(converted.record.kind).toBe("Work");
		expect(converted.record.title).toBe("Enter payment");
		expect(converted.flow.nodes.find((item) => item.id === node.id)?.kind).toBe(
			USER_FLOW_COPY.action
		);
		expect(converted.flow.nodes).toHaveLength(1);

		const relations = await listRelations(prisma, {
			record: { id: converted.record.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toHaveLength(1);
		expect(relations[0]?.type).toBe(RELATIONS_COPY.origin);
		expect(relations[0]?.originLocation).toEqual({
			componentId: node.id,
			missing: false,
			ownerId: flow.id,
			ownerKind: "User Flow",
			sourceVersion: String(withNode.revision),
		});
		expect(await prisma.screen.count()).toBe(0);
	});

	it("refuses Convert and Bind when the target is a Screen", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Enter payment",
			revision: flow.revision,
		});
		expect(
			await previewConvertAndBind(prisma, {
				nodeId: node.id,
				recordKind: USER_FLOW_COPY.screen,
				userFlowId: flow.id,
				workspaceId,
			})
		).toEqual({
			reason: USER_FLOW_REJECTION.convertDoesNotMintScreen,
			status: "rejected",
		});
		const screensBefore = await prisma.screen.count();
		expect(
			await convertAndBind(prisma, {
				actorId,
				baseRevision: withNode.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					nodeId: node.id,
					recordKind: USER_FLOW_COPY.screen,
					userFlowId: flow.id,
				},
				previewAcknowledged: true,
			})
		).toEqual({
			reason: USER_FLOW_REJECTION.convertDoesNotMintScreen,
			status: "rejected",
		});
		expect(await prisma.screen.count()).toBe(screensBefore);
		expect(await prisma.work.count()).toBe(0);
	});

	it("promotes a low-detail step to a live Screen reference instead of a copy", async () => {
		const { actorId, project } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Payment",
			revision: flow.revision,
		});
		const existing = await createScreen(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Existing Screen" },
		});
		if (existing.status !== "committed") {
			throw new Error("expected Screen");
		}

		const promoted = await promoteStepToScreen(prisma, {
			actorId,
			baseRevision: withNode.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { nodeId: node.id, userFlowId: flow.id },
		});
		expect(promoted.status).toBe("committed");
		if (promoted.status !== "committed") {
			throw new Error("expected promote");
		}
		const promotedNode = promoted.flow.nodes.find(
			(item) => item.id === node.id
		);
		expect(promotedNode?.kind).toBe(USER_FLOW_COPY.screen);
		expect(promotedNode?.screenId).toBeTruthy();
		expect(promotedNode?.screenId).not.toBe(existing.screen.id);
		expect(promotedNode?.usageKind).toBe("flow-node-screen-reference");
		expect(await prisma.screen.count()).toBe(2);

		const linked = await promoteStepToScreen(prisma, {
			actorId,
			baseRevision: promoted.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: node.id,
				screenId: existing.screen.id,
				userFlowId: flow.id,
			},
		});
		expect(linked.status).toBe("committed");
		if (linked.status !== "committed") {
			throw new Error("expected link");
		}
		expect(
			linked.flow.nodes.find((item) => item.id === node.id)?.screenId
		).toBe(existing.screen.id);
		expect(await prisma.screen.count()).toBe(2);
	});

	it("keeps Origin Location on the exact flow version and requires rebind preview", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Enter payment",
			revision: flow.revision,
		});
		const converted = await convertAndBind(prisma, {
			actorId,
			baseRevision: withNode.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: node.id,
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
			previewAcknowledged: true,
		});
		if (converted.status !== "committed") {
			throw new Error("expected convert");
		}
		const originVersion = String(withNode.revision);
		const moved = await applyEditorOp(prisma, {
			actorId,
			baseRevision: converted.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				deltaX: 16,
				deltaY: 0,
				nodeIds: [node.id],
				op: "move",
				userFlowId: flow.id,
			},
		});
		if (moved.status !== "committed") {
			throw new Error("expected new version");
		}
		expect(moved.flow.revision).toBeGreaterThan(withNode.revision);
		const afterMove = await listRelations(prisma, {
			record: { id: converted.record.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(afterMove[0]?.originLocation?.sourceVersion).toBe(originVersion);

		expect(
			await rebindOrigin(prisma, {
				actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					nodeId: node.id,
					recordId: converted.record.id,
					recordKind: USER_FLOW_COPY.work,
					userFlowId: flow.id,
				},
				previewAcknowledged: false,
			})
		).toEqual({
			reason: USER_FLOW_REJECTION.previewRequired,
			status: "rejected",
		});
		const previewed = await previewRebindOrigin(prisma, {
			nodeId: node.id,
			recordId: converted.record.id,
			recordKind: USER_FLOW_COPY.work,
			userFlowId: flow.id,
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected rebind preview");
		}
		expect(previewed.preview.fromVersion).toBe(originVersion);
		expect(previewed.preview.toVersion).toBe(String(moved.flow.revision));
		const rebound = await rebindOrigin(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: node.id,
				recordId: converted.record.id,
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
			previewAcknowledged: true,
		});
		expect(rebound.status).toBe("committed");
		const afterRebind = await listRelations(prisma, {
			record: { id: converted.record.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(afterRebind[0]?.originLocation?.sourceVersion).toBe(
			String(moved.flow.revision)
		);
		expect(afterRebind[0]?.originLocation?.componentId).toBe(node.id);
	});

	it("saves a template stamp and instantiates a new flow with no live source bind", async () => {
		const source = await openProject(prisma, "Source");
		const target = await createProject(prisma, {
			actorId: source.actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				name: "Target",
				starterConfiguration: "Blank Project",
			},
			workspaceId: source.workspaceId,
		});
		if (target.status !== "committed") {
			throw new Error("expected target Project");
		}
		const flow = await addFlow(prisma, {
			actorId: source.actorId,
			projectId: source.project.id,
			title: "Checkout path",
		});
		const screen = await createScreen(prisma, {
			actorId: source.actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: source.project.id, title: "Pay" },
		});
		if (screen.status !== "committed") {
			throw new Error("expected Screen");
		}
		const withScreen = await placeFlowNode(prisma, {
			actorId: source.actorId,
			baseRevision: flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				kind: USER_FLOW_COPY.screen,
				screenId: screen.screen.id,
				userFlowId: flow.id,
			},
		});
		if (withScreen.status !== "committed") {
			throw new Error("expected Screen node");
		}
		const work = await convertAndBind(prisma, {
			actorId: source.actorId,
			baseRevision: withScreen.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: withScreen.flow.nodes[0]?.id ?? "",
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
			previewAcknowledged: true,
		});
		if (work.status !== "committed") {
			throw new Error("expected work from screen node");
		}

		const saved = await saveUserFlowTemplate(prisma, {
			actorId: source.actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { name: "Checkout stamp", userFlowId: flow.id },
		});
		expect(saved.status).toBe("committed");
		if (saved.status !== "committed") {
			throw new Error("expected template");
		}
		expect(saved.template.name).toBe("Checkout stamp");
		expect(saved.template.sourceProjectId).toBeUndefined();
		expect(saved.template.structure).not.toContain(screen.screen.id);
		expect(saved.template.structure).not.toContain(work.record.id);
		expect(saved.template.structure).not.toContain(source.project.id);

		const instantiated = await instantiateUserFlowTemplate(prisma, {
			actorId: source.actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				projectId: target.project.id,
				templateId: saved.template.id,
				title: "Checkout copy",
			},
		});
		expect(instantiated.status).toBe("committed");
		if (instantiated.status !== "committed") {
			throw new Error("expected instantiate");
		}
		expect(instantiated.flow.id).not.toBe(flow.id);
		expect(instantiated.flow.projectId).toBe(target.project.id);
		expect(instantiated.flow.nodes.some((item) => item.screenId)).toBe(false);
		expect(instantiated.flow.originRelations).toEqual([]);
		const sourceLive = await getUserFlow(prisma, {
			userFlowId: flow.id,
			workspaceId: source.workspaceId,
		});
		expect(sourceLive?.id).toBe(flow.id);
		expect(await prisma.typedRelation.count()).toBe(1);
	});

	it("moving a live Work card does not write the source Work", async () => {
		const { actorId, project } = await openProject(prisma);
		const flow = await addFlow(prisma, {
			actorId,
			projectId: project.id,
			title: "Checkout",
		});
		const { flow: withNode, node } = await addAction(prisma, {
			actorId,
			flowId: flow.id,
			label: "Enter payment",
			revision: flow.revision,
		});
		const converted = await convertAndBind(prisma, {
			actorId,
			baseRevision: withNode.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				nodeId: node.id,
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
			previewAcknowledged: true,
		});
		if (converted.status !== "committed") {
			throw new Error("expected convert");
		}
		const placed = await placeLiveCard(prisma, {
			actorId,
			baseRevision: converted.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				recordId: converted.record.id,
				recordKind: USER_FLOW_COPY.work,
				userFlowId: flow.id,
			},
		});
		expect(placed.status).toBe("committed");
		if (placed.status !== "committed") {
			throw new Error("expected live card");
		}
		const [card] = placed.flow.liveCards;
		expect(card?.title).toBe("Enter payment");
		const before = await getWork(prisma, converted.record.id);
		const moved = await moveLiveCard(prisma, {
			actorId,
			baseRevision: placed.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				cardId: card?.id ?? "",
				deltaX: 48,
				deltaY: 16,
				userFlowId: flow.id,
			},
		});
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			throw new Error("expected move card");
		}
		expect(moved.flow.liveCards[0]?.layout.x).toBe((card?.layout.x ?? 0) + 48);
		const afterMove = await getWork(prisma, converted.record.id);
		expect(afterMove?.title).toBe(before?.title);
		expect(afterMove?.status).toBe(before?.status);
		expect(afterMove?.revision).toBe(before?.revision);
		const removed = await removeLiveCard(prisma, {
			actorId,
			baseRevision: moved.flow.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { cardId: card?.id ?? "", userFlowId: flow.id },
		});
		expect(removed.status).toBe("committed");
		if (removed.status !== "committed") {
			throw new Error("expected remove card");
		}
		expect(removed.flow.liveCards).toEqual([]);
		const afterRemove = await getWork(prisma, converted.record.id);
		expect(afterRemove?.title).toBe("Enter payment");
		expect(afterRemove?.revision).toBe(before?.revision);
	});
});
