/**
 * Feedback seam — Project-scoped expert master record. Original
 * message, channel, and time stay on the record; a summary does
 * not replace them. Feedback is not a Source subtype, feature
 * request, Work, or social post, and does not inherit URL recheck
 * or snapshot life. Statuses New / Reviewed / Archived do not
 * write related Work status, priority, or planning membership.
 * First-product intake is in-app create and existing Sources.
 * No public form, comments, votes, or requester thread.
 * docs/specs/47-feedback/spec.md and GitHub #334.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createSource,
	getSource,
} from "../../sources-and-freshness/server/sources";
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";

import {
	createFeedback,
	createFeedbackFromSource,
	getFeedback,
	listFeedback,
	setFeedbackStatus,
} from "./feedback";
import {
	FEEDBACK_COPY,
	FEEDBACK_COUNTERPARTS,
	FEEDBACK_FOREIGN_RECORD_KINDS,
	FEEDBACK_RECORD_KIND,
	FEEDBACK_STATUS,
	FEEDBACK_STATUSES,
	feedbackCatalog,
} from "./feedback-model";

const DATABASE_URL = localTestDatabaseUrl();

const SOCIAL_OR_PUBLIC =
	/public form|comment thread|upvote|like|vote|requester|two-way/i;
const SOURCE_LIFE =
	/approvedVersionNumber|candidate snapshot|source check|recheck source|Save as new Source version/i;

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
	await prisma.feedbackAttachment.deleteMany();
	await prisma.feedbackEvent.deleteMany();
	await prisma.feedback.deleteMany();
	await prisma.sourceCheck.deleteMany();
	await prisma.sourceEvidencePin.deleteMany();
	await prisma.sourceVersionInUseSignal.deleteMany();
	await prisma.sourceVersion.deleteMany();
	await prisma.source.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.work.deleteMany();
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
		idempotencyKey: `create-payments-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed" && created.status !== "replayed") {
		throw new Error("expected project");
	}
	return { actorId, projectId: created.project.id, workspaceId };
}

describe("Feedback catalog", () => {
	it("exposes English Feedback labels and statuses without social or Source life", () => {
		const catalog = feedbackCatalog();
		expect(catalog.kind).toBe("Feedback");
		expect(catalog.copy.feedback).toBe("Feedback");
		expect(catalog.copy.originalMessage).toBe("Original message");
		expect(catalog.copy.channel).toBe("Channel");
		expect(catalog.copy.occurredAt).toBe("Occurred at");
		expect(catalog.copy.new).toBe("New");
		expect(catalog.copy.reviewed).toBe("Reviewed");
		expect(catalog.copy.archived).toBe("Archived");
		expect(catalog.statuses).toEqual(["New", "Reviewed", "Archived"]);
		expect(catalog.counterparts).toEqual(FEEDBACK_COUNTERPARTS);
		expect(FEEDBACK_COUNTERPARTS.sourceSubtype).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.urlRecheck).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.candidateSnapshot).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.sourceVersionLife).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.featureRequest).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.workRecord).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.socialPost).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.publicForm).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.comments).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.votes).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.requesterThread).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.contactMerge).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.personalDataErase).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.writesWorkStatus).toBe(false);
		expect(JSON.stringify(catalog.copy)).not.toMatch(SOCIAL_OR_PUBLIC);
		expect(JSON.stringify(FEEDBACK_COPY)).not.toMatch(SOURCE_LIFE);
		expect(FEEDBACK_FOREIGN_RECORD_KINDS).toEqual([
			"Source",
			"Work",
			"Feature",
			"Feature request",
		]);
	});
});

describe("Feedback", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	beforeEach(async () => {
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await resetSharedTables(prisma);
	});

	it("creates Feedback with original message, channel, and time that a summary cannot replace", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const occurredAt = "2026-03-04T10:15:00.000Z";
		const created = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "create-checkout-message",
			origin: "human",
			payload: {
				attachmentIds: ["file-1"],
				channel: "Email",
				occurredAt,
				originalMessage: "Checkout fails on retry.",
				projectId,
				url: "https://example.com/thread/1",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.feedback.recordKind).toBe(FEEDBACK_RECORD_KIND);
		expect(FEEDBACK_FOREIGN_RECORD_KINDS).not.toContain(
			created.feedback.recordKind
		);
		expect(Object.keys(created.feedback).sort()).toEqual([
			"attachments",
			"channel",
			"id",
			"occurredAt",
			"originalMessage",
			"projectId",
			"recordKind",
			"revision",
			"status",
			"url",
		]);
		expect(created.feedback).not.toHaveProperty("summary");
		expect(created.feedback.originalMessage).toBe("Checkout fails on retry.");
		expect(created.feedback.channel).toBe("Email");
		expect(created.feedback.occurredAt).toBe(occurredAt);
		expect(created.feedback.url).toBe("https://example.com/thread/1");
		expect(created.feedback.status).toBe(FEEDBACK_STATUS.new);
		expect(created.feedback.attachments).toEqual([
			{ fileAttachmentId: "file-1", id: expect.any(String) },
		]);
		expect(JSON.stringify(created.feedback)).not.toMatch(SOCIAL_OR_PUBLIC);
		const listed = await listFeedback(prisma, projectId);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.originalMessage).toBe("Checkout fails on retry.");
		const loaded = await getFeedback(prisma, created.feedback.id);
		expect(loaded?.originalMessage).toBe(created.feedback.originalMessage);
		expect(
			await createFeedback(prisma, {
				actorId,
				idempotencyKey: "create-as-source",
				origin: "human",
				payload: {
					channel: "Email",
					kind: "Source",
					originalMessage: "Not a Source.",
					projectId,
					summary: "Short note",
				},
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
	});

	it("is not a Source subtype and does not inherit recheck or snapshot life", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await createSource(prisma, {
			actorId,
			idempotencyKey: "source-1",
			origin: "human",
			payload: {
				accessedAt: "2026-03-01T08:00:00.000Z",
				capturedContent: "Forum post about guest checkout.",
				projectId,
				title: "Forum thread",
				url: "https://example.com/forum/9",
			},
		});
		expect(source.status).toBe("committed");
		if (source.status !== "committed") {
			throw new Error("expected source");
		}
		const created = await createFeedbackFromSource(prisma, {
			actorId,
			idempotencyKey: "from-source",
			origin: "human",
			payload: {
				channel: "Forum",
				sourceId: source.source.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected feedback from source");
		}
		expect(created.feedback.recordKind).toBe("Feedback");
		expect(created.feedback.originalMessage).toBe(
			"Forum post about guest checkout."
		);
		expect(created.feedback.url).toBe("https://example.com/forum/9");
		expect(created.feedback.occurredAt).toBe("2026-03-01T08:00:00.000Z");
		expect(created.feedback).not.toHaveProperty("approvedVersionNumber");
		expect(created.feedback).not.toHaveProperty("versions");
		expect(JSON.stringify(created.feedback)).not.toMatch(SOURCE_LIFE);
		const liveSource = await getSource(prisma, source.source.id);
		expect(liveSource?.versions).toHaveLength(1);
		expect(liveSource?.approvedVersionNumber).toBe(1);
		const origins = await listRelations(prisma, {
			record: { id: created.feedback.id, kind: "Feedback" },
			viewerWorkspaceId: workspaceId,
		});
		expect(origins.map((row) => row.type)).toContain(RELATIONS_COPY.origin);
		expect(
			await createFeedbackFromSource(prisma, {
				actorId,
				idempotencyKey: "missing-source",
				origin: "human",
				payload: {
					channel: "Forum",
					sourceId: crypto.randomUUID(),
				},
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "source-not-found", status: "rejected" });
	});

	it("does not write related Work status, priority, or planning membership when status changes", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-1",
			origin: "human",
			payload: {
				projectId,
				title: "Fix checkout retry",
				type: "Bug",
			},
		});
		expect(work.status).toBe("committed");
		if (work.status !== "committed") {
			throw new Error("expected work");
		}
		const created = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "fb-1",
			origin: "human",
			payload: {
				channel: "Support",
				originalMessage: "Retry loop on pay.",
				projectId,
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected feedback");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: created.feedback.id, kind: "Feedback" },
			idempotencyKey: "related-work",
			origin: "human",
			previewAcknowledged: true,
			to: { id: work.work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const before = await getWork(prisma, work.work.id);
		expect(before?.status).toBe(WORK_STATUS.notStarted);
		const reviewed = await setFeedbackStatus(prisma, {
			actorId,
			baseRevision: created.feedback.revision,
			idempotencyKey: "review",
			origin: "human",
			payload: {
				feedbackId: created.feedback.id,
				status: FEEDBACK_STATUS.reviewed,
			},
		});
		expect(reviewed.status).toBe("committed");
		if (reviewed.status !== "committed") {
			throw new Error("expected review");
		}
		expect(reviewed.feedback.status).toBe(FEEDBACK_STATUS.reviewed);
		const archived = await setFeedbackStatus(prisma, {
			actorId,
			baseRevision: reviewed.feedback.revision,
			idempotencyKey: "archive",
			origin: "human",
			payload: {
				feedbackId: created.feedback.id,
				status: FEEDBACK_STATUS.archived,
			},
		});
		expect(archived.status).toBe("committed");
		const after = await getWork(prisma, work.work.id);
		expect(after?.status).toBe(before?.status);
		expect(after?.revision).toBe(before?.revision);
		expect(after?.title).toBe("Fix checkout retry");
		const priorityRows = await prisma.projectPriorityCriterionValue.count({
			where: { workId: work.work.id },
		});
		expect(priorityRows).toBe(0);
		const planningRows = await prisma.projectBacklogManualOrderItem.count({
			where: { workId: work.work.id },
		});
		expect(planningRows).toBe(0);
		expect(FEEDBACK_STATUSES).toEqual(["New", "Reviewed", "Archived"]);
	});
});
