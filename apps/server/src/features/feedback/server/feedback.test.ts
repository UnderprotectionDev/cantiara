/**
 * Feedback seam — Project-scoped expert master record. Original
 * message, channel, and time stay on the record; a summary does
 * not replace them. Feedback is not a Source subtype, feature
 * request, Work, or social post, and does not inherit URL recheck
 * or snapshot life. Statuses New / Reviewed / Archived do not
 * write related Work status, priority, or planning membership.
 * First-product intake is in-app create and existing Sources.
 * No public form, comments, votes, or requester thread.
 * Feed lists the same Feedback and long-body Source ids; sort
 * does not write status or priority. Open Source Record opens
 * the same master. No social actions or notification signals.
 * docs/specs/47-feedback/spec.md and GitHub #334 #337.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	createCompany,
	createContact,
	getContact,
	listContacts,
} from "../../contact-and-company/server/contact-and-company";
import { createDecision } from "../../decisions/server/decisions";
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
	listWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { WORK_STATUS } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	bindFeedbackOrigin,
	convertFeedbackToWork,
	createFeedback,
	createFeedbackFromSource,
	getFeedback,
	listFeed,
	listFeedback,
	previewConvertFeedbackToWork,
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
	await prisma.decisionEvent.deleteMany();
	await prisma.decision.deleteMany();
	await prisma.feedbackAttachment.deleteMany();
	await prisma.feedbackEvent.deleteMany();
	await prisma.feedback.deleteMany();
	await prisma.contactCompanyAffiliation.deleteMany();
	await prisma.contactEmailAlias.deleteMany();
	await prisma.contact.deleteMany();
	await prisma.company.deleteMany();
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
		expect(FEEDBACK_COUNTERPARTS.automaticPriority).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.voteScoring).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.ai).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.multiRecordSpawn).toBe(false);
		expect(catalog.copy.convertToWork).toBe("Convert to Work");
		expect(catalog.copy.feed).toBe("Feed");
		expect(catalog.copy.openSourceRecord).toBe("Open Source Record");
		expect(catalog.copy.contact).toBe("Contact");
		expect(catalog.copy.company).toBe("Company");
		expect(FEEDBACK_COUNTERPARTS.unifiedNotificationCenter).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.universalSearch).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.inboxProduct).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.supportTool).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.sourceRecheckApi).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.feedRecordType).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.writesSourceStatus).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.writesSourcePriority).toBe(false);
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
			"companyId",
			"contactId",
			"id",
			"occurredAt",
			"originalMessage",
			"projectId",
			"recordKind",
			"revision",
			"status",
			"url",
		]);
		expect(created.feedback.contactId).toBeNull();
		expect(created.feedback.companyId).toBeNull();
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

	it("saves Feedback without Contact and does not invent one for an unknown sender", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "unknown-sender",
			origin: "human",
			payload: {
				channel: "Email",
				originalMessage: "Guest checkout failed.",
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.feedback.contactId).toBeNull();
		expect(created.feedback.companyId).toBeNull();
		const loaded = await getFeedback(prisma, created.feedback.id);
		expect(loaded?.contactId).toBeNull();
		expect(loaded?.companyId).toBeNull();
		expect(
			await createFeedback(prisma, {
				actorId,
				idempotencyKey: "force-contact",
				origin: "human",
				payload: {
					channel: "Email",
					contactRequired: true,
					originalMessage: "Must invent a person.",
					projectId,
				},
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "invalid-command", status: "rejected" });
		const listedContacts = await listContacts(prisma, workspaceId);
		expect(listedContacts).toHaveLength(0);
	});

	it("attaches optional Contact and Company when they already exist", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const company = await createCompany(prisma, {
			actorId,
			idempotencyKey: "company-1",
			origin: "human",
			payload: { name: "Northwind" },
			workspaceId,
		});
		expect(company.status).toBe("committed");
		if (company.status !== "committed") {
			throw new Error("expected company");
		}
		const contact = await createContact(prisma, {
			actorId,
			idempotencyKey: "contact-1",
			origin: "human",
			payload: { displayName: "Maya" },
			workspaceId,
		});
		expect(contact.status).toBe("committed");
		if (contact.status !== "committed") {
			throw new Error("expected contact");
		}
		const created = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "known-sender",
			origin: "human",
			payload: {
				channel: "Call",
				companyId: company.company.id,
				contactId: contact.contact.id,
				originalMessage: "Retry still loops.",
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		expect(created.feedback.contactId).toBe(contact.contact.id);
		expect(created.feedback.companyId).toBe(company.company.id);
		const relations = await listRelations(prisma, {
			record: { id: created.feedback.id, kind: "Feedback" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations.map((row) => row.type).sort()).toEqual([
			RELATIONS_COPY.participant,
			RELATIONS_COPY.related,
		]);
		const profile = await getContact(prisma, contact.contact.id, workspaceId);
		expect(profile?.relatedFeedback.map((row) => row.id)).toEqual([
			created.feedback.id,
		]);
	});

	it("binds multiple Feedback origins to one Work without treating the count as a vote or priority", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const first = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "origin-a",
			origin: "human",
			payload: {
				channel: "Email",
				originalMessage: "Pay button does nothing.",
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		const second = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "origin-b",
			origin: "human",
			payload: {
				channel: "Forum",
				originalMessage: "Same retry loop here.",
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(first.status).toBe("committed");
		expect(second.status).toBe("committed");
		if (first.status !== "committed" || second.status !== "committed") {
			throw new Error("expected feedback");
		}
		const previewed = await previewConvertFeedbackToWork(prisma, {
			feedbackId: first.feedback.id,
			projectId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const converted = await convertFeedbackToWork(prisma, {
			actorId,
			idempotencyKey: "convert-first",
			origin: "human",
			payload: {
				feedbackId: first.feedback.id,
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed") {
			throw new Error("expected convert");
		}
		expect(converted.records).toHaveLength(1);
		expect(converted.records[0]?.kind).toBe("Work");
		const bound = await bindFeedbackOrigin(prisma, {
			actorId,
			idempotencyKey: "bind-second",
			origin: "human",
			payload: {
				feedbackId: second.feedback.id,
				workId: converted.records[0]?.id,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(bound.status).toBe("committed");
		const origins = await listRelations(prisma, {
			record: { id: converted.records[0]?.id ?? "", kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		const originEnds = origins.filter(
			(row) => row.type === RELATIONS_COPY.origin
		);
		expect(originEnds).toHaveLength(2);
		expect(new Set(originEnds.map((row) => row.from.id))).toEqual(
			new Set([first.feedback.id, second.feedback.id])
		);
		expect(FEEDBACK_COUNTERPARTS.voteScoring).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.automaticPriority).toBe(false);
		const work = await getWork(prisma, converted.records[0]?.id ?? "");
		expect(work?.revision).toBe(1);
	});

	it("previews Convert to Work and only creates one Work on confirm without deleting Feedback", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const created = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "convert-source",
			origin: "human",
			payload: {
				channel: "Support",
				originalMessage: "Checkout fails on retry.\nKeep the original.",
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected create");
		}
		const previewed = await previewConvertFeedbackToWork(prisma, {
			feedbackId: created.feedback.id,
			projectId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(previewed.preview.label).toBe(FEEDBACK_COPY.convertToWork);
		expect(previewed.preview.recordKind).toBe("Work");
		expect(previewed.preview.projectId).toBe(projectId);
		expect(previewed.preview.title).toBe("Checkout fails on retry.");
		expect(previewed.preview.body).toBe(
			"Checkout fails on retry.\nKeep the original."
		);
		expect(previewed.preview.origin).toBe(RELATIONS_COPY.origin);
		expect(previewed.preview.recordsToCreate).toBe(1);
		expect(previewed.preview).not.toHaveProperty("ai");
		expect(previewed.preview).not.toHaveProperty("batch");
		expect((await listWork(prisma, projectId)).length).toBe(0);
		expect(
			await convertFeedbackToWork(prisma, {
				actorId,
				idempotencyKey: "no-ack",
				origin: "human",
				payload: {
					feedbackId: created.feedback.id,
					previewFingerprint: previewed.preview.fingerprint,
					projectId,
				},
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "preview-required", status: "rejected" });
		expect((await listWork(prisma, projectId)).length).toBe(0);
		expect(
			await convertFeedbackToWork(prisma, {
				actorId,
				idempotencyKey: "blank-title",
				origin: "human",
				payload: {
					feedbackId: created.feedback.id,
					previewAcknowledged: true,
					previewFingerprint: previewed.preview.fingerprint,
					projectId,
					title: "   ",
				},
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "preview-mismatch", status: "rejected" });
		const blankPreview = await previewConvertFeedbackToWork(prisma, {
			feedbackId: created.feedback.id,
			projectId,
			title: "   ",
		});
		expect(blankPreview.status).toBe("ok");
		if (blankPreview.status !== "ok") {
			throw new Error("expected blank preview");
		}
		expect(blankPreview.preview.title).toBe("");
		expect(
			await convertFeedbackToWork(prisma, {
				actorId,
				idempotencyKey: "skip-title",
				origin: "human",
				payload: {
					feedbackId: created.feedback.id,
					previewAcknowledged: true,
					previewFingerprint: blankPreview.preview.fingerprint,
					projectId,
					title: "   ",
				},
				viewerWorkspaceId: workspaceId,
			})
		).toEqual({ reason: "missing-title", status: "rejected" });
		expect((await listWork(prisma, projectId)).length).toBe(0);
		const converted = await convertFeedbackToWork(prisma, {
			actorId,
			idempotencyKey: "confirm",
			origin: "human",
			payload: {
				feedbackId: created.feedback.id,
				previewAcknowledged: true,
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
			},
			viewerWorkspaceId: workspaceId,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed") {
			throw new Error("expected convert");
		}
		expect(converted.records).toHaveLength(1);
		expect(converted.feedback.id).toBe(created.feedback.id);
		expect(converted.feedback.status).toBe(FEEDBACK_STATUS.new);
		const live = await getFeedback(prisma, created.feedback.id);
		expect(live?.originalMessage).toBe(
			"Checkout fails on retry.\nKeep the original."
		);
		expect(live?.status).toBe(FEEDBACK_STATUS.new);
		const work = await getWork(prisma, converted.records[0]?.id ?? "");
		expect(work?.title).toBe("Checkout fails on retry.");
		expect(work?.description).toBeNull();
		const origins = await listRelations(prisma, {
			record: { id: created.feedback.id, kind: "Feedback" },
			viewerWorkspaceId: workspaceId,
		});
		expect(origins.map((row) => row.type)).toContain(RELATIONS_COPY.origin);
		expect(FEEDBACK_COUNTERPARTS.ai).toBe(false);
		expect(FEEDBACK_COUNTERPARTS.multiRecordSpawn).toBe(false);
	});

	it("lists Feed rows as the same Feedback and long-body Source ids", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "feed-feedback",
			origin: "human",
			payload: {
				attachmentIds: ["file-feed-1"],
				channel: "Email",
				occurredAt: "2026-04-02T09:00:00.000Z",
				originalMessage: "Retry still fails at pay.",
				projectId,
			},
		});
		expect(feedback.status).toBe("committed");
		if (feedback.status !== "committed") {
			throw new Error("expected feedback");
		}
		const longSource = await createSource(prisma, {
			actorId,
			idempotencyKey: "feed-long-source",
			origin: "human",
			payload: {
				accessedAt: "2026-04-01T08:00:00.000Z",
				capturedContent: "Long forum write-up about guest checkout retry.",
				projectId,
				title: "Forum thread",
				url: "https://example.com/forum/22",
			},
		});
		expect(longSource.status).toBe("committed");
		if (longSource.status !== "committed") {
			throw new Error("expected long source");
		}
		const shortSource = await createSource(prisma, {
			actorId,
			idempotencyKey: "feed-short-source",
			origin: "human",
			payload: {
				accessedAt: "2026-04-03T08:00:00.000Z",
				capturedContent: "",
				projectId,
				title: "Bookmark only",
				url: "https://example.com/bookmark",
			},
		});
		expect(shortSource.status).toBe("committed");
		if (shortSource.status !== "committed") {
			throw new Error("expected short source");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "feed-work",
			origin: "human",
			payload: {
				projectId,
				title: "Fix pay retry",
				type: "Bug",
			},
		});
		expect(work.status).toBe("committed");
		if (work.status !== "committed") {
			throw new Error("expected work");
		}
		const decision = await createDecision(prisma, {
			actorId,
			idempotencyKey: "feed-decision",
			origin: "human",
			payload: {
				decision: "Keep retry copy.",
				projectId,
				rationale: "Support still sees the same error.",
				title: "Keep retry copy",
			},
		});
		expect(decision.status).toBe("committed");
		if (decision.status !== "committed") {
			throw new Error("expected decision");
		}
		expect(
			(
				await createRelation(prisma, {
					actorId,
					from: { id: feedback.feedback.id, kind: "Feedback" },
					idempotencyKey: "feed-related-work",
					origin: "human",
					previewAcknowledged: true,
					to: { id: work.work.id, kind: "Work" },
					type: RELATIONS_COPY.related,
					viewerWorkspaceId: workspaceId,
				})
			).status
		).toBe("committed");
		expect(
			(
				await createRelation(prisma, {
					actorId,
					from: { id: longSource.source.id, kind: "Source" },
					idempotencyKey: "feed-related-decision",
					origin: "human",
					previewAcknowledged: true,
					to: { id: decision.decision.id, kind: "Decision" },
					type: RELATIONS_COPY.related,
					viewerWorkspaceId: workspaceId,
				})
			).status
		).toBe("committed");
		const listedFeedback = await listFeedback(prisma, projectId);
		const feed = await listFeed(prisma, { projectId });
		expect(feed.rows.map((row) => row.id).sort()).toEqual(
			[feedback.feedback.id, longSource.source.id].sort()
		);
		expect(feed.rows.map((row) => row.id)).not.toContain(shortSource.source.id);
		expect(listedFeedback.map((row) => row.id)).toEqual([feedback.feedback.id]);
		const feedbackRow = feed.rows.find(
			(row) => row.id === feedback.feedback.id
		);
		const sourceRow = feed.rows.find((row) => row.id === longSource.source.id);
		expect(feedbackRow).toMatchObject({
			attachments: [
				{ fileAttachmentId: "file-feed-1", id: expect.any(String) },
			],
			body: "Retry still fails at pay.",
			identityOrChannel: "Email",
			occurredAt: "2026-04-02T09:00:00.000Z",
			openSourceRecord: FEEDBACK_COPY.openSourceRecord,
			projectId,
			projectName: "Payments",
			recordKind: "Feedback",
			relatedDecisions: [],
			relatedWork: [{ id: work.work.id, title: "Fix pay retry" }],
		});
		expect(sourceRow).toMatchObject({
			attachments: [],
			body: "Long forum write-up about guest checkout retry.",
			identityOrChannel: "Forum thread",
			occurredAt: "2026-04-01T08:00:00.000Z",
			openSourceRecord: FEEDBACK_COPY.openSourceRecord,
			projectId,
			projectName: "Payments",
			recordKind: "Source",
			relatedDecisions: [
				{ id: decision.decision.id, title: "Keep retry copy" },
			],
			relatedWork: [],
		});
		expect(feed.rows.some((row) => row.recordKind === "Feed")).toBe(false);
		expect(feed.writes).toEqual({ priority: false, status: false });
		expect(feed.socialActions).toEqual([]);
		expect(feed.notificationSignals).toEqual([]);
		expect(JSON.stringify(feed)).not.toMatch(SOURCE_LIFE);
		expect(feed).not.toHaveProperty("recheckSource");
	});

	it("does not write Source or Feedback status or Work priority when Feed is sorted or filtered", async () => {
		const { actorId, projectId } = await openPayments(prisma);
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "sort-feedback",
			origin: "human",
			payload: {
				channel: "Chat",
				occurredAt: "2026-05-02T09:00:00.000Z",
				originalMessage: "Chat about retry.",
				projectId,
			},
		});
		expect(feedback.status).toBe("committed");
		if (feedback.status !== "committed") {
			throw new Error("expected feedback");
		}
		const source = await createSource(prisma, {
			actorId,
			idempotencyKey: "sort-source",
			origin: "human",
			payload: {
				accessedAt: "2026-05-01T08:00:00.000Z",
				capturedContent: "Captured retry notes for the feed.",
				projectId,
				title: "Retry notes",
				url: "https://example.com/notes",
			},
		});
		expect(source.status).toBe("committed");
		if (source.status !== "committed") {
			throw new Error("expected source");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "sort-work",
			origin: "human",
			payload: {
				projectId,
				title: "Retry work",
				type: "Bug",
			},
		});
		expect(work.status).toBe("committed");
		if (work.status !== "committed") {
			throw new Error("expected work");
		}
		const beforeFeedback = await getFeedback(prisma, feedback.feedback.id);
		const beforeSource = await getSource(prisma, source.source.id);
		const beforeWork = await getWork(prisma, work.work.id);
		const newest = await listFeed(prisma, { projectId });
		expect(newest.rows.map((row) => row.id)).toEqual([
			feedback.feedback.id,
			source.source.id,
		]);
		const titled = await listFeed(prisma, {
			projectId,
			sortDirection: "asc",
			sortField: "title",
		});
		expect(titled.rows.map((row) => row.identityOrChannel)).toEqual([
			"Chat",
			"Retry notes",
		]);
		const filtered = await listFeed(prisma, {
			filterText: "Retry notes",
			projectId,
		});
		expect(filtered.rows.map((row) => row.id)).toEqual([source.source.id]);
		expect(filtered.writes).toEqual({ priority: false, status: false });
		const afterFeedback = await getFeedback(prisma, feedback.feedback.id);
		const afterSource = await getSource(prisma, source.source.id);
		const afterWork = await getWork(prisma, work.work.id);
		expect(afterFeedback?.status).toBe(beforeFeedback?.status);
		expect(afterFeedback?.revision).toBe(beforeFeedback?.revision);
		expect(afterSource?.revision).toBe(beforeSource?.revision);
		expect(afterSource?.approvedVersionNumber).toBe(
			beforeSource?.approvedVersionNumber
		);
		expect(afterSource?.capturedContent).toBe(beforeSource?.capturedContent);
		expect(afterSource?.url).toBe(beforeSource?.url);
		expect(afterWork?.status).toBe(beforeWork?.status);
		expect(afterWork?.revision).toBe(beforeWork?.revision);
		expect(
			await prisma.projectPriorityCriterionValue.count({
				where: { workId: work.work.id },
			})
		).toBe(0);
	});
});
