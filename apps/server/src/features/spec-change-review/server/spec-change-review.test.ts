/**
 * Spec Change Review seam — version-backed section diff for a
 * Feature's Primary spec Document pair. Not Git, not a second
 * spec body. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Belge bütünlüğü: live vs pinned stays distinct; this queue is
 * the impact-review of a new Primary spec version).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	createDocument,
	getDocument,
	listDocumentVersions,
	updateDocument,
} from "../../documents/server/documents";
import { createProject } from "../../project-shell/server/project-shell";
import {
	bindPrimarySpec,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { listSpecChangeReviews } from "./spec-change-review";
import {
	SPEC_CHANGE_REVIEW_COPY,
	specChangeReviewCatalog,
} from "./spec-change-review-model";

const DATABASE_URL = localTestDatabaseUrl();
const GIT_SOURCE_PATTERN = /gitSha|commitHash|workingTree|GitHub review/i;
const PREVIOUS_CHECKOUT = [
	"## Checkout",
	"Charge after confirm.",
	"",
	"## Notes",
	"Keep shipping Monday.",
].join("\n");
const NEXT_CHECKOUT = [
	"## Checkout",
	"Charge before ship.",
	"",
	"## Notes",
	"Keep shipping Monday.",
].join("\n");

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

async function committedFeature(
	prisma: PrismaClient,
	actorId: string,
	projectId: string
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			projectId,
			title: "Checkout",
			type: "Feature",
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected Feature");
	}
	return created.work;
}

async function committedSpec(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		projectId: string;
		title: string;
		workspaceId: string;
	}
) {
	const created = await createDocument(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.body,
			scope: { kind: "project", projectId: input.projectId },
			title: input.title,
			type: "Spec",
		},
		workspaceId: input.workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Document");
	}
	return created.document;
}

describe("Spec Change Review catalog", () => {
	it("exposes English Spec Change Review and Primary spec", () => {
		expect(specChangeReviewCatalog()).toEqual({
			copy: SPEC_CHANGE_REVIEW_COPY,
		});
		expect(SPEC_CHANGE_REVIEW_COPY.specChangeReview).toBe("Spec Change Review");
		expect(SPEC_CHANGE_REVIEW_COPY.primarySpec).toBe("Primary spec");
		expect(SPEC_CHANGE_REVIEW_COPY.version).toBe("Version");
		expect(JSON.stringify(specChangeReviewCatalog())).not.toMatch(
			GIT_SOURCE_PATTERN
		);
	});
});

describe("Spec Change Review", () => {
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
		await prisma.specChangeReview.deleteMany();
		await prisma.usageLink.deleteMany();
		await prisma.usageHostEmbed.deleteMany();
		await prisma.typedRelation.deleteMany();
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.user.deleteMany();
		await prisma.$disconnect();
		await pool.end();
	});

	it("opens one version pair with changed-section context when a Feature Primary spec saves a new version", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const feature = await committedFeature(prisma, actorId, project.id);
		const spec = await committedSpec(prisma, {
			actorId,
			body: PREVIOUS_CHECKOUT,
			projectId: project.id,
			title: "Checkout spec",
			workspaceId,
		});
		const bound = await bindPrimarySpec(prisma, {
			actorId,
			baseRevision: feature.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			primarySpec: { id: spec.id, title: spec.title },
			workId: feature.id,
		});
		if (bound.status !== "committed") {
			throw new Error("expected Primary spec");
		}
		const saved = await updateDocument(prisma, {
			actorId,
			baseRevision: spec.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: NEXT_CHECKOUT,
				documentId: spec.id,
			},
			workspaceId,
		});
		if (saved.status !== "committed") {
			throw new Error("expected saved Spec");
		}
		const versions = await listDocumentVersions(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		const queue = await listSpecChangeReviews(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		expect(queue).toHaveLength(1);
		const [review] = queue;
		expect(review?.featureId).toBe(feature.id);
		expect(review?.primarySpec).toEqual({
			id: spec.id,
			title: "Checkout spec",
		});
		expect(review?.previousVersion.revision).toBe(1);
		expect(review?.newVersion.revision).toBe(2);
		expect(review?.previousVersion.id).toBe(versions?.[0]?.id);
		expect(review?.newVersion.id).toBe(versions?.[1]?.id);
		expect(review?.changedSections).toEqual([
			{
				heading: "Checkout",
				newBody: expect.stringContaining("Charge before ship."),
				previousBody: expect.stringContaining("Charge after confirm."),
			},
		]);
		expect(review?.id).not.toBe(spec.id);
		expect(review).not.toHaveProperty("gitSha");
		expect(review).not.toHaveProperty("commitHash");
		const live = await getDocument(prisma, spec.id, workspaceId);
		expect(live?.body).toContain("Charge before ship.");
		expect(live?.body).not.toBe(review?.id);
		expect(JSON.stringify(queue)).not.toMatch(GIT_SOURCE_PATTERN);
	});

	it("does not open the queue for a Document that is not a Feature Primary spec", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const spec = await committedSpec(prisma, {
			actorId,
			body: PREVIOUS_CHECKOUT,
			projectId: project.id,
			title: "Orphan spec",
			workspaceId,
		});
		const saved = await updateDocument(prisma, {
			actorId,
			baseRevision: spec.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: NEXT_CHECKOUT,
				documentId: spec.id,
			},
			workspaceId,
		});
		if (saved.status !== "committed") {
			throw new Error("expected saved Spec");
		}
		expect(
			await listSpecChangeReviews(prisma, {
				documentId: spec.id,
				workspaceId,
			})
		).toEqual([]);
	});

	it("keeps each version pair as its own queue row and does not replace the spec body", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const feature = await committedFeature(prisma, actorId, project.id);
		const spec = await committedSpec(prisma, {
			actorId,
			body: PREVIOUS_CHECKOUT,
			projectId: project.id,
			title: "Checkout spec",
			workspaceId,
		});
		const bound = await bindPrimarySpec(prisma, {
			actorId,
			baseRevision: feature.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			primarySpec: { id: spec.id, title: spec.title },
			workId: feature.id,
		});
		if (bound.status !== "committed") {
			throw new Error("expected Primary spec");
		}
		const firstSave = await updateDocument(prisma, {
			actorId,
			baseRevision: spec.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: NEXT_CHECKOUT,
				documentId: spec.id,
			},
			workspaceId,
		});
		if (firstSave.status !== "committed") {
			throw new Error("expected first save");
		}
		const thirdBody = [
			"## Checkout",
			"Charge at capture.",
			"",
			"## Notes",
			"Keep shipping Monday.",
		].join("\n");
		const secondSave = await updateDocument(prisma, {
			actorId,
			baseRevision: firstSave.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: thirdBody,
				documentId: spec.id,
			},
			workspaceId,
		});
		if (secondSave.status !== "committed") {
			throw new Error("expected second save");
		}
		const queue = await listSpecChangeReviews(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		expect(
			queue.map((row) => [
				row.previousVersion.revision,
				row.newVersion.revision,
			])
		).toEqual([
			[1, 2],
			[2, 3],
		]);
		const live = await getDocument(prisma, spec.id, workspaceId);
		expect(live?.body).toContain("Charge at capture.");
		expect(live?.title).toBe("Checkout spec");
	});
});
