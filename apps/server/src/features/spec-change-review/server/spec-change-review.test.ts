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
import { pinVersionPinnedEvidence } from "../../documents/server/documents-convert";
import {
	inlineRecordMarkdown,
	liveSectionFence,
	liveWorkFence,
} from "../../documents/server/documents-live";
import { EVIDENCE_COPY } from "../../evidence/server/evidence-model";
import { createProject } from "../../project-shell/server/project-shell";
import { createRelation } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	bindPrimarySpec,
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	listSpecChangeReviews,
	markSpecChangeReviewCandidate,
} from "./spec-change-review";
import {
	SPEC_CHANGE_REVIEW_COPY,
	SPEC_CHANGE_REVIEW_COUNTERPARTS,
	SPEC_CHANGE_REVIEW_STATUSES,
	specChangeReviewCatalog,
} from "./spec-change-review-model";

const DATABASE_URL = localTestDatabaseUrl();
const GIT_SOURCE_PATTERN = /gitSha|commitHash|workingTree|GitHub review/i;
const AI_PATTERN = /embedding|openai|similarity ranking/i;
const SIMILARITY_PATTERN = /embedding|openai|similarity/i;
const BULK_WRITE_PATTERN = /markAll|allAffected/i;
const SECTION_ID_MARK = /\{#([^}]+)\}/;
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

async function committedTask(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string
) {
	const created = await createWork(prisma, {
		actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			projectId,
			title,
			type: "Task",
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected Task");
	}
	return created.work;
}

async function bindAndSaveSpec(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		featureId: string;
		featureRevision: number;
		nextBody: string;
		projectId: string;
		specTitle?: string;
		workspaceId: string;
	}
) {
	const spec = await committedSpec(prisma, {
		actorId: input.actorId,
		body: input.body,
		projectId: input.projectId,
		title: input.specTitle ?? "Checkout spec",
		workspaceId: input.workspaceId,
	});
	const bound = await bindPrimarySpec(prisma, {
		actorId: input.actorId,
		baseRevision: input.featureRevision,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		primarySpec: { id: spec.id, title: spec.title },
		workId: input.featureId,
	});
	if (bound.status !== "committed") {
		throw new Error("expected Primary spec");
	}
	const saved = await updateDocument(prisma, {
		actorId: input.actorId,
		baseRevision: spec.revision,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.nextBody,
			documentId: spec.id,
		},
		workspaceId: input.workspaceId,
	});
	if (saved.status !== "committed") {
		throw new Error("expected saved Spec");
	}
	const queue = await listSpecChangeReviews(prisma, {
		documentId: spec.id,
		workspaceId: input.workspaceId,
	});
	return { queue, spec };
}

describe("Spec Change Review catalog", () => {
	it("exposes English Spec Change Review, Primary spec, and the three review statuses", () => {
		expect(specChangeReviewCatalog()).toEqual({
			copy: SPEC_CHANGE_REVIEW_COPY,
			counterparts: SPEC_CHANGE_REVIEW_COUNTERPARTS,
			statuses: SPEC_CHANGE_REVIEW_STATUSES,
		});
		expect(SPEC_CHANGE_REVIEW_COPY.specChangeReview).toBe("Spec Change Review");
		expect(SPEC_CHANGE_REVIEW_COPY.primarySpec).toBe("Primary spec");
		expect(SPEC_CHANGE_REVIEW_COPY.version).toBe("Version");
		expect(SPEC_CHANGE_REVIEW_COPY.documentLevelCandidate).toBe(
			"Document-level candidate"
		);
		expect([...SPEC_CHANGE_REVIEW_STATUSES]).toEqual([
			"Waiting",
			"Reviewed",
			"Not affected",
		]);
		expect(SPEC_CHANGE_REVIEW_STATUSES).toHaveLength(3);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.ai).toBe(false);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.titleSimilarity).toBe(false);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.bulkAllAffected).toBe(false);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.writesCandidateWork).toBe(false);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.feedbackReviewed).toBe(false);
		expect(SPEC_CHANGE_REVIEW_COUNTERPARTS.workWorkflowStatus).toBe(false);
		expect(JSON.stringify(specChangeReviewCatalog())).not.toMatch(
			GIT_SOURCE_PATTERN
		);
		expect(JSON.stringify(specChangeReviewCatalog())).not.toMatch(AI_PATTERN);
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
		if (
			"specChangeReviewCandidate" in prisma &&
			typeof prisma.specChangeReviewCandidate?.deleteMany === "function"
		) {
			await prisma.specChangeReviewCandidate.deleteMany();
		}
		await prisma.specChangeReview.deleteMany();
		if (
			"evidenceRelationHistory" in prisma &&
			typeof prisma.evidenceRelationHistory?.deleteMany === "function"
		) {
			await prisma.evidenceRelationHistory.deleteMany();
		}
		if (
			"evidencePin" in prisma &&
			typeof prisma.evidencePin?.deleteMany === "function"
		) {
			await prisma.evidencePin.deleteMany();
		}
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

	it("builds the candidate set from recorded-link closure and ignores title similarity", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const feature = await committedFeature(prisma, actorId, project.id);
		const linkedTask = await committedTask(
			prisma,
			actorId,
			project.id,
			"Refund capture"
		);
		await committedTask(prisma, actorId, project.id, "Checkout");
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
		const relatedTask = await committedTask(
			prisma,
			actorId,
			project.id,
			"Receipt mail"
		);
		const related = await createRelation(prisma, {
			actorId,
			from: { id: relatedTask.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: spec.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const sectionId = spec.body.match(SECTION_ID_MARK)?.[1];
		expect(sectionId).toBeTruthy();
		const host = await committedSpec(prisma, {
			actorId,
			body: liveSectionFence(spec.id, sectionId ?? ""),
			projectId: project.id,
			title: "Host notes",
			workspaceId,
		});
		const inlineHost = await committedSpec(prisma, {
			actorId,
			body: inlineRecordMarkdown("Checkout spec", "Document", spec.id),
			projectId: project.id,
			title: "Inline host",
			workspaceId,
		});
		const evidenceWork = await committedTask(
			prisma,
			actorId,
			project.id,
			"Fee claim"
		);
		const pinned = await pinVersionPinnedEvidence(prisma, {
			actorId,
			baseRevision: spec.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: spec.id,
				selectedText: "Charge after confirm.",
				targetId: evidenceWork.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(pinned.status).toBe("committed");
		const saved = await updateDocument(prisma, {
			actorId,
			baseRevision: spec.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: [
					"## Checkout",
					"Charge before ship.",
					liveWorkFence(linkedTask.id),
					"",
					"## Notes",
					"Keep shipping Monday.",
				].join("\n"),
				documentId: spec.id,
			},
			workspaceId,
		});
		if (saved.status !== "committed") {
			throw new Error("expected saved Spec");
		}
		const queue = await listSpecChangeReviews(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		const candidates = queue[0]?.candidates ?? [];
		const ids = candidates.map((candidate) => candidate.recordId).sort();
		expect(ids).toEqual(
			[
				evidenceWork.id,
				feature.id,
				host.id,
				inlineHost.id,
				linkedTask.id,
				relatedTask.id,
			].sort()
		);
		const similar = await prisma.work.findFirst({
			where: { title: "Checkout", type: "Task" },
		});
		expect(ids).not.toContain(similar?.id);
		expect(
			candidates.every((candidate) => candidate.reviewStatus === "Waiting")
		).toBe(true);
		expect(
			candidates.find((candidate) => candidate.recordId === feature.id)
		).toMatchObject({
			changedSection: null,
			documentLevel: true,
			title: "Checkout",
			why: expect.arrayContaining([SPEC_CHANGE_REVIEW_COPY.primarySpec]),
		});
		expect(
			candidates.find((candidate) => candidate.recordId === relatedTask.id)
		).toMatchObject({
			changedSection: null,
			documentLevel: true,
			why: expect.arrayContaining([RELATIONS_COPY.related]),
		});
		expect(
			candidates.find((candidate) => candidate.recordId === host.id)
		).toMatchObject({
			changedSection: "Checkout",
			documentLevel: false,
			why: expect.arrayContaining(["Section reference"]),
		});
		expect(
			candidates.find((candidate) => candidate.recordId === linkedTask.id)
		).toMatchObject({
			changedSection: "Checkout",
			documentLevel: false,
			why: expect.arrayContaining(["Live block"]),
		});
		expect(
			candidates.find((candidate) => candidate.recordId === inlineHost.id)
		).toMatchObject({
			documentLevel: true,
			why: expect.arrayContaining(["Inline reference"]),
		});
		expect(
			candidates.find((candidate) => candidate.recordId === evidenceWork.id)
		).toMatchObject({
			why: expect.arrayContaining([EVIDENCE_COPY.versionPinnedEvidence]),
		});
		expect(JSON.stringify(queue)).not.toMatch(SIMILARITY_PATTERN);
	});

	it("does not treat a Document-level candidate as hit by a particular span", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const feature = await committedFeature(prisma, actorId, project.id);
		const { queue } = await bindAndSaveSpec(prisma, {
			actorId,
			body: PREVIOUS_CHECKOUT,
			featureId: feature.id,
			featureRevision: feature.revision,
			nextBody: NEXT_CHECKOUT,
			projectId: project.id,
			workspaceId,
		});
		const featureCandidate = queue[0]?.candidates.find(
			(candidate) => candidate.recordId === feature.id
		);
		expect(featureCandidate?.documentLevel).toBe(true);
		expect(featureCandidate?.changedSection).toBeNull();
		expect(featureCandidate?.title).toBe("Checkout");
	});

	it("marks one candidate on this version pair without writing the target Work", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const feature = await committedFeature(prisma, actorId, project.id);
		const { queue, spec } = await bindAndSaveSpec(prisma, {
			actorId,
			body: PREVIOUS_CHECKOUT,
			featureId: feature.id,
			featureRevision: feature.revision,
			nextBody: NEXT_CHECKOUT,
			projectId: project.id,
			workspaceId,
		});
		const featureCandidate = queue[0]?.candidates.find(
			(candidate) => candidate.recordId === feature.id
		);
		expect(featureCandidate).toBeDefined();
		const before = await getWork(prisma, feature.id);
		expect(before?.status).toBe(WORK_STATUS.notStarted);
		const marked = await markSpecChangeReviewCandidate(prisma, {
			candidateId: featureCandidate?.id ?? "",
			note: "Checkout copy still holds.",
			reviewId: queue[0]?.id ?? "",
			status: SPEC_CHANGE_REVIEW_COPY.notAffected,
			workspaceId,
		});
		expect(marked.status).toBe("committed");
		if (marked.status !== "committed") {
			throw new Error("expected mark");
		}
		expect(marked.candidate.reviewStatus).toBe("Not affected");
		expect(marked.candidate.note).toBe("Checkout copy still holds.");
		const after = await getWork(prisma, feature.id);
		expect(after?.status).toBe(before?.status);
		expect(after?.description).toBe(before?.description);
		expect(after?.title).toBe(before?.title);
		expect(after?.revision).toBe(before?.revision);
		const rejected = await markSpecChangeReviewCandidate(prisma, {
			candidateId: featureCandidate?.id ?? "",
			note: "",
			reviewId: queue[0]?.id ?? "",
			status: "Affected",
			workspaceId,
		});
		expect(rejected).toEqual({
			reason: "unknown-review-status",
			status: "rejected",
		});
		const feedbackWord = await markSpecChangeReviewCandidate(prisma, {
			candidateId: featureCandidate?.id ?? "",
			note: "",
			reviewId: queue[0]?.id ?? "",
			status: "İncelendi",
			workspaceId,
		});
		expect(feedbackWord.status).toBe("rejected");
		const later = await updateDocument(prisma, {
			actorId,
			baseRevision: spec.revision + 1,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: [
					"## Checkout",
					"Charge at capture.",
					"",
					"## Notes",
					"Keep shipping Monday.",
				].join("\n"),
				documentId: spec.id,
			},
			workspaceId,
		});
		if (later.status !== "committed") {
			throw new Error("expected second save");
		}
		const both = await listSpecChangeReviews(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		expect(both).toHaveLength(2);
		const firstPair = both.find(
			(row) =>
				row.previousVersion.revision === 1 && row.newVersion.revision === 2
		);
		const secondPair = both.find(
			(row) =>
				row.previousVersion.revision === 2 && row.newVersion.revision === 3
		);
		expect(
			firstPair?.candidates.find(
				(candidate) => candidate.recordId === feature.id
			)
		).toMatchObject({
			note: "Checkout copy still holds.",
			reviewStatus: "Not affected",
		});
		expect(
			secondPair?.candidates.find(
				(candidate) => candidate.recordId === feature.id
			)
		).toMatchObject({
			note: "",
			reviewStatus: "Waiting",
		});
	});

	it("does not expose a bulk all-affected write", async () => {
		expect(specChangeReviewCatalog().counterparts.bulkAllAffected).toBe(false);
		const module = await import("./spec-change-review");
		expect("markAllSpecChangeReviewCandidates" in module).toBe(false);
		expect(JSON.stringify(Object.keys(module))).not.toMatch(BULK_WRITE_PATTERN);
	});

	it("presents an inaccessible candidate as No access without leaking title or body", async () => {
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
		const other = await seedWorkspace(prisma);
		const foreignProject = await createProject(prisma, {
			actorId: other.actorId,
			idempotencyKey: `create-${crypto.randomUUID()}`,
			origin: "human",
			payload: {
				name: "Foreign",
				starterConfiguration: "Blank Project",
			},
			workspaceId: other.workspaceId,
		});
		if (foreignProject.status !== "committed") {
			throw new Error("expected foreign Project");
		}
		const secretWork = await committedTask(
			prisma,
			other.actorId,
			foreignProject.project.id,
			"Secret other-workspace title"
		);
		const related = await createRelation(prisma, {
			actorId,
			from: { id: secretWork.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: spec.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
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
		const queue = await listSpecChangeReviews(prisma, {
			documentId: spec.id,
			workspaceId,
		});
		const hidden = queue[0]?.candidates.find(
			(candidate) => candidate.recordId === secretWork.id
		);
		expect(hidden).toMatchObject({
			brokenReason: RELATIONS_COPY.noAccess,
			title: null,
		});
		expect(JSON.stringify(queue)).not.toContain("Secret other-workspace title");
	});
});
