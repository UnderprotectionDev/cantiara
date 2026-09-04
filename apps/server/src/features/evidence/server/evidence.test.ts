/**
 * Evidence seam — version-pinned text range bind, convert preview,
 * Origin Location tombstone, redaction, Kanıt Rolü, and Founder
 * interpretation, and Evidence Flow listing of explicit Kanıtı rows.
 * docs/specs/45-evidence/spec.md and GitHub #329.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDecision } from "../../decisions/server/decisions";
import {
	archiveDocument,
	createDocument,
} from "../../documents/server/documents";
import {
	createFeedback,
	setFeedbackStatus,
} from "../../feedback/server/feedback";
import { FEEDBACK_STATUS } from "../../feedback/server/feedback-model";
import {
	permanentlyDeleteFileAttachment,
	setFileLifecycle,
} from "../../file-attachments/server/file-attachments";
import { FILE_LIFECYCLE } from "../../file-attachments/server/file-attachments-model";
import { createProjectGoals } from "../../goals/server/project-goals";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createResearchSession,
	writeObservation,
} from "../../research-sessions/server/research-sessions";
import { CONSENT } from "../../research-sessions/server/research-sessions-model";
import {
	createSource,
	getSource,
	saveSourceVersion,
} from "../../sources-and-freshness/server/sources";
import { createAssumption } from "../../uncertainty-records/server/uncertainty-records";
import { createValidationRecord } from "../../validation-records/server/validation-records";
import {
	addChecklistItem,
	removeChecklistItem,
} from "../../work-checklists/server/work-checklists";
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";

import {
	bindEvidence,
	convertToNewRecordAndBind,
	getEvidencePin,
	listEvidenceFlow,
	listEvidenceOnSource,
	listEvidenceOnTarget,
	listEvidenceOnTargetSurface,
	openEvidenceRoleSet,
	presentEvidenceShare,
	previewBindEvidence,
	previewConvertEvidence,
	previewRebindEvidence,
	rebindEvidence,
	redactEvidenceContent,
	setEvidenceFounderInterpretation,
	setEvidenceRole,
} from "./evidence";
import {
	EVIDENCE_COPY,
	EVIDENCE_ROLES,
	EVIDENCE_SOURCE_KIND,
} from "./evidence-model";

const DATABASE_URL = localTestDatabaseUrl();
const AI_OR_MULTI = /\bAI\b|multi-create|classifier/i;
const FLOW_INVENTION = /\bclassifier\b|timeline snapshot/i;

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
	await prisma.evidenceRelationHistory.deleteMany();
	await prisma.evidencePin.deleteMany();
	await prisma.source.deleteMany();
	await prisma.document.deleteMany();
	await prisma.fileAttachment.deleteMany();
	await prisma.feedback.deleteMany();
	await prisma.researchSession.deleteMany();
	await prisma.validationRecord.deleteMany();
	await prisma.projectGoal.deleteMany();
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

async function committedSource(
	prisma: PrismaClient,
	input: { actorId: string; capturedContent: string; projectId: string }
) {
	const created = await createSource(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			capturedContent: input.capturedContent,
			projectId: input.projectId,
			title: "Stripe Checkout",
			url: "https://docs.stripe.com/payments/checkout",
		},
	});
	if (created.status !== "committed") {
		throw new Error("expected source");
	}
	return created.source;
}

async function committedWork(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string; title: string }
) {
	const created = await createWork(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: { projectId: input.projectId, title: input.title },
	});
	if (created.status !== "committed") {
		throw new Error("expected work");
	}
	return created.work;
}

async function bindQuotedEvidence(
	prisma: PrismaClient,
	input: {
		actorId: string;
		selectedText: string;
		sourceId: string;
		sourceKind:
			| "Source"
			| "Document"
			| "Feedback"
			| "User Research Session"
			| "Experiment/Validation"
			| "File Attachment";
		sourceVersionId: string;
		targetId: string;
		targetKind:
			| "Work"
			| "Decision"
			| "Risk"
			| "Assumption"
			| "Question"
			| "Access observation"
			| "Project Release";
		workspaceId: string;
	}
) {
	const previewed = await previewBindEvidence(prisma, {
		selectedText: input.selectedText,
		sourceId: input.sourceId,
		sourceKind: input.sourceKind,
		sourceVersionId: input.sourceVersionId,
		targetId: input.targetId,
		targetKind: input.targetKind,
		workspaceId: input.workspaceId,
	});
	if (previewed.status !== "ok") {
		throw new Error("expected preview");
	}
	const bound = await bindEvidence(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			previewFingerprint: previewed.preview.fingerprint,
			selectedText: input.selectedText,
			sourceId: input.sourceId,
			sourceKind: input.sourceKind,
			sourceVersionId: input.sourceVersionId,
			targetId: input.targetId,
			targetKind: input.targetKind,
		},
		previewAcknowledged: true,
		workspaceId: input.workspaceId,
	});
	if (bound.status !== "committed") {
		throw new Error("expected bind");
	}
	return bound.pin;
}

describe("Evidence version-pinned text range", () => {
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

	it("pins selected text on the exact Source version after Bind as evidence to existing record preview", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const body = "Checkout Session creates a payment page.";
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: body,
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const skipped = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "bind-skip",
			origin: "human",
			payload: {
				previewFingerprint: "nope",
				selectedText: "Checkout Session",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: work.id,
				targetKind: "Work",
			},
			workspaceId,
		});
		expect(skipped).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(previewed.preview.label).toBe(
			EVIDENCE_COPY.bindAsEvidenceToExistingRecord
		);
		expect(previewed.preview.sourceVersionNumber).toBe(1);
		expect(previewed.preview.textRange).toEqual({ end: 16, start: 0 });
		expect(previewed.preview.rangeText).toBe("Checkout Session");
		expect(previewed.preview.surroundingText).toBe(body);
		expect(previewed.preview.targetTitle).toBe("Checkout claim");
		expect(previewed.preview.sourceStaysInPlace).toBe(
			EVIDENCE_COPY.sourceStaysInPlace
		);
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "bind-checkout",
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Checkout Session",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: work.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(bound.status).toBe("committed");
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		expect(bound.pin.sourceVersionNumber).toBe(1);
		expect(bound.pin.textRange).toEqual({ end: 16, start: 0 });
		expect(bound.pin.highlight).toEqual({ end: 16, start: 0 });
		expect(bound.pin.rangeText).toBe("Checkout Session");
		expect(bound.pin.pinnedBody).toBe(body);
		expect(bound.pin.surroundingText).toBe(body);
		expect(bound.pin.openSourceRecord).toBe(EVIDENCE_COPY.openSourceRecord);
		expect(bound.pin.backlinks).toEqual([
			{
				targetId: work.id,
				targetKind: "Work",
				targetTitle: "Checkout claim",
			},
		]);
		const still = await getSource(prisma, source.id);
		expect(still?.capturedContent).toBe(body);
		const onTarget = await listEvidenceOnTarget(prisma, "Work", work.id);
		expect(onTarget[0]?.sourceVersionId).toBe(source.versions[0]?.id);
		const relations = await listRelations(prisma, {
			record: { id: work.id, kind: "Work" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations.some((row) => row.type === RELATIONS_COPY.evidence)).toBe(
			true
		);
		expect(relations.some((row) => row.type === RELATIONS_COPY.related)).toBe(
			false
		);
	});

	it("binds selected text to an existing Decision after preview", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const body = "Checkout Session creates a payment page.";
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: body,
			projectId,
		});
		const created = await createDecision(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				decision: "Use Checkout Session.",
				projectId,
				rationale: "Docs quote.",
				title: "Checkout decision",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected decision");
		}
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: created.decision.id,
			targetKind: "Decision",
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "bind-decision",
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Checkout Session",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: created.decision.id,
				targetKind: "Decision",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(bound.status).toBe("committed");
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		const onTarget = await listEvidenceOnTarget(
			prisma,
			"Decision",
			created.decision.id
		);
		expect(onTarget[0]?.rangeText).toBe("Checkout Session");
		expect(onTarget[0]?.openSourceRecord).toBe(EVIDENCE_COPY.openSourceRecord);
	});

	it("rejects bind ends outside the Kanıtı catalog and allows a Document version", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Claim",
		});
		const fromWork = await previewBindEvidence(prisma, {
			selectedText: "Claim",
			sourceId: work.id,
			sourceKind: "Work" as never,
			sourceVersionId: work.id,
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		expect(fromWork.status).toBe("rejected");
		const document = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "The fee is 2%.",
				scope: { kind: "project", projectId },
				title: "Fees",
				type: "Spec",
			},
			workspaceId,
		});
		if (document.status !== "committed") {
			throw new Error("expected document");
		}
		const version = await prisma.documentVersion.findFirst({
			where: { documentId: document.document.id },
		});
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "The fee is 2%.",
			sourceId: document.document.id,
			sourceKind: "Document",
			sourceVersionId: version?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
	});

	it("converts selected text to exactly one Work after preview and does not use AI", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Tokenize cards before charge.",
			projectId,
		});
		const skipped = await convertToNewRecordAndBind(prisma, {
			actorId,
			idempotencyKey: "convert-skip",
			origin: "human",
			payload: {
				previewFingerprint: "nope",
				projectId,
				recordKind: "Work",
				selectedText: "Tokenize cards before charge.",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
			},
			workspaceId,
		});
		expect(skipped).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		const previewed = await previewConvertEvidence(prisma, {
			projectId,
			recordKind: "Work",
			selectedText: "Tokenize cards before charge.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected convert preview");
		}
		expect(previewed.preview.label).toBe(
			EVIDENCE_COPY.convertToNewRecordAndBind
		);
		expect(previewed.preview.title).toBe("Tokenize cards before charge.");
		expect(JSON.stringify(previewed.preview)).not.toMatch(AI_OR_MULTI);
		const converted = await convertToNewRecordAndBind(prisma, {
			actorId,
			idempotencyKey: "convert-tokenize",
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				projectId,
				recordKind: "Work",
				selectedText: "Tokenize cards before charge.",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed" || !("record" in converted)) {
			throw new Error("expected convert");
		}
		expect(converted.record.kind).toBe("Work");
		const loaded = await getWork(prisma, converted.record.id);
		expect(loaded?.title).toBe("Tokenize cards before charge.");
		const still = await getSource(prisma, source.id);
		expect(still?.capturedContent).toBe("Tokenize cards before charge.");
	});

	it("does not slide the pin when a newer Source version exists until rebind is previewed", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "bind-then-version",
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Checkout Session",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: work.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		const pinnedVersionId = bound.pin.sourceVersionId;
		const saved = await saveSourceVersion(prisma, {
			actorId,
			baseRevision: source.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				capturedContent: "Checkout Session still creates a payment page.",
				sourceId: source.id,
				title: "Stripe Checkout",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		expect(saved.status).toBe("committed");
		const after = await getEvidencePin(prisma, bound.pin.id);
		expect(after?.sourceVersionId).toBe(pinnedVersionId);
		expect(after?.sourceVersionNumber).toBe(1);
		expect(after?.rangeText).toBe("Checkout Session");
		expect(after?.pinnedBody).toBe("Checkout Session creates a payment page.");
		expect(after?.pinnedBody.includes("still")).toBe(false);
		expect(after?.newerVersionExists).toBe(true);
		const silent = await rebindEvidence(prisma, {
			actorId,
			idempotencyKey: "silent-rebind",
			origin: "human",
			payload: {
				pinId: bound.pin.id,
				previewFingerprint: "nope",
			},
			workspaceId,
		});
		expect(silent).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		const rebindPreview = await previewRebindEvidence(prisma, {
			pinId: bound.pin.id,
			workspaceId,
		});
		expect(rebindPreview.status).toBe("ok");
		if (rebindPreview.status !== "ok") {
			throw new Error("expected rebind preview");
		}
		expect(rebindPreview.preview.label).toBe(EVIDENCE_COPY.newerVersionExists);
		const rebound = await rebindEvidence(prisma, {
			actorId,
			idempotencyKey: "rebind-v2",
			origin: "human",
			payload: {
				pinId: bound.pin.id,
				previewFingerprint: rebindPreview.preview.fingerprint,
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(rebound.status).toBe("committed");
		if (rebound.status !== "committed") {
			throw new Error("expected rebind");
		}
		expect(rebound.pin.sourceVersionNumber).toBe(2);
		expect(rebound.pin.sourceVersionId).not.toBe(pinnedVersionId);
	});

	it("keeps Origin Location on the same component and shows Source element no longer exists", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Fee is 2%.",
			projectId,
		});
		const host = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Host",
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: host.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			title: "Quote item",
			workId: host.id,
		});
		if (added.status !== "committed") {
			throw new Error("expected item");
		}
		const itemId = added.checklist.items[0]?.id;
		expect(itemId).toBeTruthy();
		const previewed = await previewBindEvidence(prisma, {
			originLocation: {
				componentId: itemId ?? "",
				ownerId: host.id,
				ownerKind: "Work",
				sourceVersion: String(host.revision),
			},
			selectedText: "Fee is 2%.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: host.id,
			targetKind: "Work",
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "origin-pin",
			origin: "human",
			payload: {
				originLocation: {
					componentId: itemId ?? "",
					ownerId: host.id,
					ownerKind: "Work",
					sourceVersion: String(host.revision),
				},
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Fee is 2%.",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: host.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		expect(bound.pin.originLocation?.missing).toBe(false);
		expect(bound.pin.originLocation?.componentId).toBe(itemId);
		const current = await getWork(prisma, host.id);
		await removeChecklistItem(prisma, {
			actorId,
			baseRevision: current?.revision ?? 1,
			idempotencyKey: crypto.randomUUID(),
			itemId: itemId ?? "",
			origin: "human",
			workId: host.id,
		});
		await addChecklistItem(prisma, {
			actorId,
			baseRevision: (await getWork(prisma, host.id))?.revision ?? 1,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			title: "Other item",
			workId: host.id,
		});
		const after = await getEvidencePin(prisma, bound.pin.id);
		expect(after?.originLocation?.componentId).toBe(itemId);
		expect(after?.originLocation?.missing).toBe(true);
		expect(after?.originLocation?.missingLabel).toBe(
			EVIDENCE_COPY.sourceElementNoLongerExists
		);
	});

	it("redacts pin content while keeping the historical bind", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Secret quote about fees.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Claim",
		});
		const previewed = await previewBindEvidence(prisma, {
			selectedText: "Secret quote about fees.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "bind-secret",
			origin: "human",
			payload: {
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Secret quote about fees.",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: work.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		const redacted = await redactEvidenceContent(prisma, {
			actorId,
			idempotencyKey: "redact-pin",
			origin: "human",
			payload: { pinId: bound.pin.id },
			workspaceId,
		});
		expect(redacted.status).toBe("committed");
		if (redacted.status !== "committed") {
			throw new Error("expected redact");
		}
		expect(redacted.pin.contentAccess).toBe("redacted");
		expect(redacted.pin.rangeText).toBe("");
		expect(redacted.pin.surroundingText).toBe("");
		expect(redacted.pin.pinnedBody).toBe("");
		expect(redacted.pin.historicalBindExists).toBe(true);
		const onSource = await listEvidenceOnSource(prisma, "Source", source.id);
		expect(onSource).toHaveLength(1);
		expect(onSource[0]?.historicalBindExists).toBe(true);
	});

	it("stores Unspecified when the founder binds without a Kanıt Rolü", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "This quote contradicts the checkout claim.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const pin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "This quote contradicts the checkout claim.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		expect(pin.role).toBe(EVIDENCE_COPY.unspecified);
		expect(pin.founderInterpretation).toBe("");
		expect(pin).not.toHaveProperty("evidenceQuality");
		expect(pin).not.toHaveProperty("kanitNiteligi");
		expect(JSON.stringify(pin)).not.toMatch(AI_OR_MULTI);
	});

	it("keeps Kanıt Rolü on the relation, not the Source, with actor and time in history", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const created = await createDecision(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				decision: "Skip Checkout Session.",
				projectId,
				rationale: "Different claim.",
				title: "Skip checkout",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected decision");
		}
		const supporting = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const contradicting = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: created.decision.id,
			targetKind: "Decision",
			workspaceId,
		});
		const decisionsBefore = await prisma.decision.count({
			where: { projectId },
		});
		const worksBefore = await prisma.work.count({
			where: { projectId },
		});
		const setSupporting = await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "role-supporting",
			origin: "human",
			payload: {
				pinId: supporting.id,
				role: EVIDENCE_COPY.supporting,
			},
			workspaceId,
		});
		expect(setSupporting.status).toBe("committed");
		if (setSupporting.status !== "committed") {
			throw new Error("expected role");
		}
		expect(setSupporting.pin.role).toBe(EVIDENCE_COPY.supporting);
		expect(setSupporting.pin.roleActorId).toBe(actorId);
		expect(setSupporting.pin.roleSetAt).toBeInstanceOf(Date);
		const setContradicting = await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "role-contradicting",
			origin: "human",
			payload: {
				pinId: contradicting.id,
				role: EVIDENCE_COPY.contradicting,
			},
			workspaceId,
		});
		if (setContradicting.status !== "committed") {
			throw new Error("expected contradicting role");
		}
		expect(setContradicting.pin.role).toBe(EVIDENCE_COPY.contradicting);
		const sourcePins = await listEvidenceOnSource(prisma, "Source", source.id);
		expect(sourcePins.map((row) => row.role).sort()).toEqual([
			EVIDENCE_COPY.contradicting,
			EVIDENCE_COPY.supporting,
		]);
		const still = await getSource(prisma, source.id);
		expect(still?.capturedContent).toBe(
			"Checkout Session creates a payment page."
		);
		const history = await prisma.evidenceRelationHistory.findMany({
			orderBy: { occurredAt: "asc" },
			where: { pinId: supporting.id },
		});
		expect(history).toEqual([
			expect.objectContaining({
				actorId,
				fieldKey: "role",
				nextValue: EVIDENCE_COPY.supporting,
				previousValue: EVIDENCE_COPY.unspecified,
			}),
		]);
		expect(await prisma.decision.count({ where: { projectId } })).toBe(
			decisionsBefore
		);
		expect(await prisma.work.count({ where: { projectId } })).toBe(worksBefore);
	});

	it("keeps Founder interpretation off the source text and previous values in relation history", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const body = "Checkout Session creates a payment page.";
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: body,
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const pin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const first = await setEvidenceFounderInterpretation(prisma, {
			actorId,
			idempotencyKey: "note-1",
			origin: "human",
			payload: {
				founderInterpretation: "This supports the claim.",
				pinId: pin.id,
			},
			workspaceId,
		});
		expect(first.status).toBe("committed");
		if (first.status !== "committed") {
			throw new Error("expected interpretation");
		}
		expect(first.pin.founderInterpretation).toBe("This supports the claim.");
		expect(first.pin.interpretationActorId).toBe(actorId);
		expect(first.pin.role).toBe(EVIDENCE_COPY.unspecified);
		expect(JSON.stringify(first.pin)).not.toMatch(AI_OR_MULTI);
		const second = await setEvidenceFounderInterpretation(prisma, {
			actorId,
			idempotencyKey: "note-2",
			origin: "human",
			payload: {
				founderInterpretation: "Revised: still checkout.",
				pinId: pin.id,
			},
			workspaceId,
		});
		if (second.status !== "committed") {
			throw new Error("expected edit");
		}
		expect(second.pin.founderInterpretation).toBe("Revised: still checkout.");
		const history = await prisma.evidenceRelationHistory.findMany({
			orderBy: { occurredAt: "asc" },
			where: { fieldKey: "founderInterpretation", pinId: pin.id },
		});
		expect(history.map((row) => row.previousValue)).toEqual([
			"",
			"This supports the claim.",
		]);
		expect(history.map((row) => row.nextValue)).toEqual([
			"This supports the claim.",
			"Revised: still checkout.",
		]);
		const still = await getSource(prisma, source.id);
		expect(still?.capturedContent).toBe(body);
		expect(await prisma.researchSessionNote.count()).toBe(0);
	});

	it("does not reinterpret Kanıt Rolü on a new Source version", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const pin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "role-keep",
			origin: "human",
			payload: { pinId: pin.id, role: EVIDENCE_COPY.providesContext },
			workspaceId,
		});
		const saved = await saveSourceVersion(prisma, {
			actorId,
			baseRevision: source.revision,
			idempotencyKey: "v2",
			origin: "human",
			payload: {
				capturedContent: "Checkout Session now contradicts fees.",
				sourceId: source.id,
				title: "Stripe Checkout",
				url: "https://docs.stripe.com/payments/checkout",
			},
		});
		if (saved.status !== "committed") {
			throw new Error("expected version");
		}
		const previewed = await previewRebindEvidence(prisma, {
			pinId: pin.id,
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected rebind preview");
		}
		const rebound = await rebindEvidence(prisma, {
			actorId,
			idempotencyKey: "rebind-role",
			origin: "human",
			payload: {
				pinId: pin.id,
				previewFingerprint: previewed.preview.fingerprint,
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (rebound.status !== "committed") {
			throw new Error("expected rebind");
		}
		expect(rebound.pin.role).toBe(EVIDENCE_COPY.providesContext);
		expect(rebound.pin.sourceVersionNumber).toBe(2);
	});

	it("groups the target surface by Kanıt Rolü without a score or suggested Decision", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const fees = await committedSource(prisma, {
			actorId,
			capturedContent: "Fees remain unclear.",
			projectId,
		});
		const secret = await committedSource(prisma, {
			actorId,
			capturedContent: "Secret quote about fees.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const supporting = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const extra = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Fees remain unclear.",
			sourceId: fees.id,
			sourceKind: "Source",
			sourceVersionId: fees.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const hidden = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Secret quote about fees.",
			sourceId: secret.id,
			sourceKind: "Source",
			sourceVersionId: secret.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "g-s",
			origin: "human",
			payload: { pinId: supporting.id, role: EVIDENCE_COPY.supporting },
			workspaceId,
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "g-i",
			origin: "human",
			payload: { pinId: extra.id, role: EVIDENCE_COPY.inconclusive },
			workspaceId,
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "g-c",
			origin: "human",
			payload: { pinId: hidden.id, role: EVIDENCE_COPY.contradicting },
			workspaceId,
		});
		await redactEvidenceContent(prisma, {
			actorId,
			idempotencyKey: "g-redact",
			origin: "human",
			payload: { pinId: hidden.id },
			workspaceId,
		});
		const surface = await listEvidenceOnTargetSurface(prisma, "Work", work.id);
		expect(surface.majorityResult).toBeNull();
		expect(surface.suggestedDecision).toBe(false);
		expect(surface.totalScore).toBeNull();
		expect(surface.groups.map((group) => group.role)).toEqual([
			...EVIDENCE_ROLES,
		]);
		expect(
			openEvidenceRoleSet(surface, EVIDENCE_COPY.supporting).map(
				(row) => row.id
			)
		).toEqual([supporting.id]);
		expect(
			openEvidenceRoleSet(surface, EVIDENCE_COPY.inconclusive)
		).toHaveLength(1);
		expect(openEvidenceRoleSet(surface, EVIDENCE_COPY.contradicting)).toEqual(
			[]
		);
		expect(
			surface.groups.find((group) => group.role === EVIDENCE_COPY.supporting)
				?.count
		).toBe(1);
	});

	it("keeps share fields separate and withholds Kanıt Rolü when inaccessible", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const pin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "share-role",
			origin: "human",
			payload: { pinId: pin.id, role: EVIDENCE_COPY.supporting },
			workspaceId,
		});
		await setEvidenceFounderInterpretation(prisma, {
			actorId,
			idempotencyKey: "share-note",
			origin: "human",
			payload: {
				founderInterpretation: "Founder note",
				pinId: pin.id,
			},
			workspaceId,
		});
		const loaded = await getEvidencePin(prisma, pin.id);
		if (!loaded) {
			throw new Error("expected pin");
		}
		const exported = presentEvidenceShare(loaded, { audience: "owner" });
		expect(exported.role).toBe(EVIDENCE_COPY.supporting);
		expect(exported.founderInterpretation).toBe("Founder note");
		expect(exported.source).toEqual({ id: source.id, kind: "Source" });
		expect(exported.target).toEqual({ id: work.id, kind: "Work" });
		expect(exported.versionRange?.textRange).toEqual(loaded.textRange);
		const withheld = presentEvidenceShare(loaded, { audience: "inaccessible" });
		expect(withheld.role).toBeNull();
		expect(withheld.founderInterpretation).toBeNull();
		expect(withheld.versionRange).toBeNull();
		expect(withheld.historicalBindExists).toBe(true);
		expect(JSON.stringify(withheld)).not.toContain(EVIDENCE_COPY.supporting);
		expect(JSON.stringify(withheld)).not.toContain("Founder note");
		await redactEvidenceContent(prisma, {
			actorId,
			idempotencyKey: "share-redact",
			origin: "human",
			payload: { pinId: pin.id },
			workspaceId,
		});
		const redacted = await getEvidencePin(prisma, pin.id);
		if (!redacted) {
			throw new Error("expected redacted pin");
		}
		const ownerRedacted = presentEvidenceShare(redacted, { audience: "owner" });
		expect(ownerRedacted.role).toBeNull();
		expect(JSON.stringify(ownerRedacted)).not.toContain(
			EVIDENCE_COPY.supporting
		);
	});

	it("does not copy Geri Bildirim Kanıt niteliği into Kanıt Rolü", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Fees are too high.",
			projectId,
		});
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Pricing claim",
		});
		const pin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Fees are too high.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "fb-1",
			origin: "human",
			payload: {
				channel: "Intercom",
				originalMessage: "Fees are too high.",
				projectId,
			},
		});
		expect(feedback.status).toBe("committed");
		const after = await getEvidencePin(prisma, pin.id);
		expect(after?.role).toBe(EVIDENCE_COPY.unspecified);
		expect(after).not.toHaveProperty("reportedProblem");
		expect(after).not.toHaveProperty("impactSeverity");
		expect(after).not.toHaveProperty("evidenceQuality");
	});
});

describe("Evidence Flow of explicit Kanıtı relations", () => {
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

	it("lists only explicit Kanıtı rows in relation time with clocks kept apart", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		const document = await committedFeesDocument(prisma, {
			actorId,
			projectId,
			workspaceId,
		});
		const first = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const second = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "The fee is 2%.",
			sourceId: document.id,
			sourceKind: "Document",
			sourceVersionId: document.versionId,
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		await prisma.sourceVersion.update({
			data: { accessedAt: new Date("2020-01-02T00:00:00.000Z") },
			where: { id: source.versions[0]?.id ?? "" },
		});
		await setEvidenceRole(prisma, {
			actorId,
			idempotencyKey: "flow-role",
			origin: "human",
			payload: { pinId: first.id, role: EVIDENCE_COPY.supporting },
			workspaceId,
		});
		await setEvidenceFounderInterpretation(prisma, {
			actorId,
			idempotencyKey: "flow-note",
			origin: "human",
			payload: {
				founderInterpretation: "This quote backs the claim.",
				pinId: first.id,
			},
			workspaceId,
		});
		await createRelation(prisma, {
			actorId,
			from: { id: source.id, kind: "Source" },
			idempotencyKey: "related-not-evidence",
			origin: "human",
			previewAcknowledged: true,
			to: { id: work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		const pinCount = await prisma.evidencePin.count();
		const flow = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(flow.label).toBe(EVIDENCE_COPY.evidenceFlow);
		expect(flow.storedSnapshot).toBe(false);
		expect(flow).not.toHaveProperty("theme");
		expect(flow).not.toHaveProperty("Insight");
		expect(flow).not.toHaveProperty("summary");
		expect(flow).not.toHaveProperty("strength");
		expect(flow.sourceKinds).toEqual([...EVIDENCE_SOURCE_KIND]);
		expect(flow.rows.map((row) => row.pinId)).toEqual([first.id, second.id]);
		expect(flow.rows[0]?.sourceKind).toBe("Source");
		expect(flow.rows[1]?.sourceKind).toBe("Document");
		expect(flow.rows[0]?.eventTime.toISOString()).toBe(
			"2020-01-02T00:00:00.000Z"
		);
		expect(flow.rows[0]?.relationTime.getTime()).toBeGreaterThan(
			flow.rows[0]?.eventTime.getTime() ?? 0
		);
		expect(flow.rows[0]?.role).toBe(EVIDENCE_COPY.supporting);
		expect(flow.rows[0]?.founderInterpretation).toBe(
			"This quote backs the claim."
		);
		expect(flow.rows[0]?.eventTime.getTime()).not.toBe(
			flow.rows[0]?.relationTime.getTime()
		);
		expect(JSON.stringify(flow.rows)).not.toMatch(FLOW_INVENTION);
		const filtered = await listEvidenceFlow(prisma, {
			sourceKind: "Source",
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(filtered.rows.map((row) => row.pinId)).toEqual([first.id]);
		expect(filtered.sourceKindFilter).toBe("Source");
		expect(await prisma.evidencePin.count()).toBe(pinCount);
		const stillWork = await getWork(prisma, work.id);
		expect(stillWork?.title).toBe("Checkout claim");
	});

	it("keeps İlgili, Hedefe katkı, and observation binds out of a parent Release flow", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Checkout Session creates a payment page.",
			projectId,
		});
		await createRelation(prisma, {
			actorId,
			from: { id: source.id, kind: "Source" },
			idempotencyKey: "only-related",
			origin: "human",
			previewAcknowledged: true,
			to: { id: work.id, kind: "Work" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		const emptyWork = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(emptyWork.rows).toEqual([]);
		const goals = createProjectGoals({
			accountId: actorId,
			prisma,
			workspaceId,
		});
		const goal = await goals.create({
			description: "Ship checkout.",
			idempotencyKey: "goal-1",
			projectId,
			title: "Reach checkout",
		});
		expect(goal.status).toBe("committed");
		if (goal.status !== "committed") {
			throw new Error("expected goal");
		}
		const contributed = await goals.contributeToGoal({
			from: { id: work.id, kind: "Work" },
			goalId: goal.goal.id,
			idempotencyKey: "contrib-work",
		});
		expect(contributed.status).toBe("committed");
		const evidenceAsGoal = await goals.contributeToGoal({
			from: { id: source.id, kind: "Source" },
			goalId: goal.goal.id,
			idempotencyKey: "contrib-source",
		});
		expect(evidenceAsGoal).toMatchObject({
			reason: "ends-not-allowed",
			status: "rejected",
		});
		expect(
			(
				await listEvidenceFlow(prisma, {
					targetId: work.id,
					targetKind: "Work",
					viewerWorkspaceId: workspaceId,
				})
			).rows
		).toEqual([]);
		const observationId = crypto.randomUUID();
		const releaseId = crypto.randomUUID();
		const onObservation = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Checkout Session",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: observationId,
			targetKind: "Access observation",
			workspaceId,
		});
		expect(onObservation.targetKind).toBe("Access observation");
		expect(
			(
				await listEvidenceFlow(prisma, {
					targetId: work.id,
					targetKind: "Work",
					viewerWorkspaceId: workspaceId,
				})
			).rows
		).toEqual([]);
		const releaseFlow = await listEvidenceFlow(prisma, {
			targetId: releaseId,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(releaseFlow.rows).toEqual([]);
		const observationPins = await listEvidenceOnTarget(
			prisma,
			"Access observation",
			observationId
		);
		expect(observationPins.map((pin) => pin.id)).toEqual([onObservation.id]);
	});

	it("shows archived sources and uses broken presentation for trash, redaction, and gone ends", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const document = await committedFeesDocument(prisma, {
			actorId,
			projectId,
			workspaceId,
		});
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Secret quote about fees.",
			projectId,
		});
		const file = await committedTextAttachment(prisma, {
			body: "Invoice excerpt",
			projectId,
			workspaceId,
		});
		const archivedPin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "The fee is 2%.",
			sourceId: document.id,
			sourceKind: "Document",
			sourceVersionId: document.versionId,
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const redactedPin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Secret quote about fees.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const filePin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Invoice excerpt",
			sourceId: file.id,
			sourceKind: "File Attachment",
			sourceVersionId: file.versionId,
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		await archiveDocument(prisma, {
			actorId,
			baseRevision: document.revision,
			idempotencyKey: "archive-doc",
			origin: "human",
			payload: { documentId: document.id },
			workspaceId,
		});
		await redactEvidenceContent(prisma, {
			actorId,
			idempotencyKey: "redact-flow",
			origin: "human",
			payload: { pinId: redactedPin.id },
			workspaceId,
		});
		await setFileLifecycle(prisma, {
			fileAttachmentId: file.id,
			lifecycle: FILE_LIFECYCLE.trash,
		});
		const flow = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		const archived = flow.rows.find((row) => row.pinId === archivedPin.id);
		const redacted = flow.rows.find((row) => row.pinId === redactedPin.id);
		const trashed = flow.rows.find((row) => row.pinId === filePin.id);
		expect(archived).toMatchObject({
			openSourceRecord: EVIDENCE_COPY.openSourceRecord,
			presentation: "archived",
			rangeText: "The fee is 2%.",
			sourceStatusLabel: RELATIONS_COPY.archived,
		});
		expect(redacted).toMatchObject({
			brokenReason: RELATIONS_COPY.redactedForSecurity,
			openSourceRecord: null,
			presentation: "broken",
			rangeText: "",
		});
		expect(JSON.stringify(redacted)).not.toContain("Secret quote");
		expect(trashed).toMatchObject({
			brokenReason: RELATIONS_COPY.inTrash,
			openSourceRecord: null,
			presentation: "broken",
			rangeText: "",
		});
		await permanentlyDeleteFileAttachment(prisma, file.id);
		const gone = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(gone.rows.find((row) => row.pinId === filePin.id)).toMatchObject({
			brokenReason: RELATIONS_COPY.permanentlyDeleted,
			presentation: "broken",
			rangeText: "",
		});
		const hidden = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: crypto.randomUUID(),
		});
		expect(
			hidden.rows.every(
				(row) => row.presentation === "broken" && row.rangeText === ""
			)
		).toBe(true);
		expect(
			hidden.rows
				.filter((row) => row.pinId !== filePin.id)
				.every((row) => row.brokenReason === RELATIONS_COPY.noAccess)
		).toBe(true);
	});

	it("includes Feedback, research, validation, Session Test, and Origin Location tombstone", async () => {
		const { actorId, projectId, workspaceId } = await openPayments(prisma);
		const work = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checkout claim",
		});
		const assumptionCreated = await createAssumption(prisma, {
			actorId,
			idempotencyKey: "assumption-1",
			origin: "human",
			payload: {
				projectId,
				rationale: "Merchants accept the fee.",
				statement: "Fee is acceptable.",
			},
		});
		if (assumptionCreated.status !== "committed") {
			throw new Error("expected assumption");
		}
		const feedback = await createFeedback(prisma, {
			actorId,
			idempotencyKey: "fb-flow",
			origin: "human",
			payload: {
				channel: "Intercom",
				occurredAt: "2019-06-01T12:00:00.000Z",
				originalMessage: "Fees are too high.",
				projectId,
			},
		});
		if (feedback.status !== "committed") {
			throw new Error("expected feedback");
		}
		const session = await createResearchSession(prisma, {
			actorId,
			idempotencyKey: "session-flow",
			origin: "human",
			payload: {
				channel: "Interview",
				consent: CONSENT.allowed,
				facilitator: "Founder",
				projectId,
				purpose: "Fees",
				questionGuide: "Why leave?",
				scheduledAt: "2018-03-01T00:00:00.000Z",
				scopeNote: "One merchant",
				title: "Checkout interview",
			},
		});
		if (session.status !== "committed") {
			throw new Error("expected session");
		}
		const note = await writeObservation(prisma, {
			actorId,
			baseRevision: session.session.revision,
			idempotencyKey: "note-flow",
			origin: "human",
			payload: {
				body: "Paused on the pay button.",
				sessionId: session.session.id,
			},
		});
		if (note.status !== "committed") {
			throw new Error("expected note");
		}
		const validation = await createValidationRecord(prisma, {
			actorId,
			idempotencyKey: "validation-flow",
			origin: "human",
			payload: {
				method: "Interview",
				projectId,
				result: "Merchants stalled.",
				title: "Fee interview",
			},
			viewerWorkspaceId: workspaceId,
		});
		if (validation.status !== "committed") {
			throw new Error("expected validation");
		}
		const feedbackPin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Fees are too high.",
			sourceId: feedback.feedback.id,
			sourceKind: "Feedback",
			sourceVersionId: feedback.feedback.id,
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const sessionPin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Paused on the pay button.",
			sourceId: session.session.id,
			sourceKind: "User Research Session",
			sourceVersionId: String(note.session.revision),
			targetId: work.id,
			targetKind: "Work",
			workspaceId,
		});
		const validationPin = await bindQuotedEvidence(prisma, {
			actorId,
			selectedText: "Merchants stalled.",
			sourceId: validation.validationRecord.id,
			sourceKind: "Experiment/Validation",
			sourceVersionId: String(validation.validationRecord.revision),
			targetId: assumptionCreated.assumption.id,
			targetKind: "Assumption",
			workspaceId,
		});
		await setFeedbackStatus(prisma, {
			actorId,
			baseRevision: feedback.feedback.revision,
			idempotencyKey: "fb-archive",
			origin: "human",
			payload: {
				feedbackId: feedback.feedback.id,
				status: FEEDBACK_STATUS.archived,
			},
		});
		const sessionTestId = crypto.randomUUID();
		await insertCatalogPin(prisma, {
			rangeText: "Session click path",
			sourceId: sessionTestId,
			sourceKind: "Session Test",
			targetId: work.id,
			targetKind: "Work",
		});
		const host = await committedWork(prisma, {
			actorId,
			projectId,
			title: "Checklist host",
		});
		const source = await committedSource(prisma, {
			actorId,
			capturedContent: "Fee is 2%.",
			projectId,
		});
		const added = await addChecklistItem(prisma, {
			actorId,
			baseRevision: host.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			title: "Quote item",
			workId: host.id,
		});
		if (added.status !== "committed") {
			throw new Error("expected item");
		}
		const itemId = added.checklist.items[0]?.id ?? "";
		const previewed = await previewBindEvidence(prisma, {
			originLocation: {
				componentId: itemId,
				ownerId: host.id,
				ownerKind: "Work",
				sourceVersion: String(host.revision),
			},
			selectedText: "Fee is 2%.",
			sourceId: source.id,
			sourceKind: "Source",
			sourceVersionId: source.versions[0]?.id ?? "",
			targetId: host.id,
			targetKind: "Work",
			workspaceId,
		});
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		const bound = await bindEvidence(prisma, {
			actorId,
			idempotencyKey: "origin-flow",
			origin: "human",
			payload: {
				originLocation: {
					componentId: itemId,
					ownerId: host.id,
					ownerKind: "Work",
					sourceVersion: String(host.revision),
				},
				previewFingerprint: previewed.preview.fingerprint,
				selectedText: "Fee is 2%.",
				sourceId: source.id,
				sourceKind: "Source",
				sourceVersionId: source.versions[0]?.id ?? "",
				targetId: host.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		if (bound.status !== "committed") {
			throw new Error("expected bind");
		}
		await removeChecklistItem(prisma, {
			actorId,
			baseRevision: (await getWork(prisma, host.id))?.revision ?? 1,
			idempotencyKey: crypto.randomUUID(),
			itemId,
			origin: "human",
			workId: host.id,
		});
		const workFlow = await listEvidenceFlow(prisma, {
			targetId: work.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(workFlow.rows.map((row) => row.sourceKind).sort()).toEqual([
			"Feedback",
			"Session Test",
			"User Research Session",
		]);
		expect(
			workFlow.rows.find((row) => row.pinId === feedbackPin.id)
		).toMatchObject({
			eventTime: new Date("2019-06-01T12:00:00.000Z"),
			presentation: "archived",
			sourceKind: "Feedback",
			sourceStatusLabel: RELATIONS_COPY.archived,
		});
		expect(
			workFlow.rows
				.find((row) => row.pinId === sessionPin.id)
				?.eventTime.toISOString()
		).toBe("2018-03-01T00:00:00.000Z");
		const assumptionFlow = await listEvidenceFlow(prisma, {
			targetId: assumptionCreated.assumption.id,
			targetKind: "Assumption",
			viewerWorkspaceId: workspaceId,
		});
		expect(assumptionFlow.rows.map((row) => row.pinId)).toEqual([
			validationPin.id,
		]);
		const tombstone = await listEvidenceFlow(prisma, {
			targetId: host.id,
			targetKind: "Work",
			viewerWorkspaceId: workspaceId,
		});
		expect(tombstone.rows[0]?.originLocation?.missingLabel).toBe(
			EVIDENCE_COPY.sourceElementNoLongerExists
		);
	});
});

async function committedFeesDocument(
	prisma: PrismaClient,
	input: { actorId: string; projectId: string; workspaceId: string }
) {
	const document = await createDocument(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: "The fee is 2%.",
			scope: { kind: "project", projectId: input.projectId },
			title: "Fees",
			type: "Spec",
		},
		workspaceId: input.workspaceId,
	});
	if (document.status !== "committed") {
		throw new Error("expected document");
	}
	const version = await prisma.documentVersion.findFirst({
		where: { documentId: document.document.id },
	});
	return {
		id: document.document.id,
		revision: document.document.revision,
		versionId: version?.id ?? "",
	};
}

async function committedTextAttachment(
	prisma: PrismaClient,
	input: { body: string; projectId: string; workspaceId: string }
) {
	const id = crypto.randomUUID();
	const versionId = crypto.randomUUID();
	await prisma.fileAttachment.create({
		data: {
			id,
			lifecycle: FILE_LIFECYCLE.active,
			projectId: input.projectId,
			revision: 1,
			scopeKind: "project",
			title: "Invoice",
			versions: {
				create: {
					byteLength: input.body.length,
					contentHash: `sha256:${id}`,
					filename: input.body,
					id: versionId,
					kind: "text",
					mimeType: "text/plain",
					objectKey: `files/${id}`,
					versionNumber: 1,
				},
			},
			workspaceId: input.workspaceId,
		},
	});
	return { id, versionId };
}

async function insertCatalogPin(
	prisma: PrismaClient,
	input: {
		rangeText: string;
		sourceId: string;
		sourceKind: string;
		targetId: string;
		targetKind: string;
	}
) {
	const relationId = crypto.randomUUID();
	await prisma.typedRelation.create({
		data: {
			fromId: input.sourceId,
			fromKind: input.sourceKind,
			id: relationId,
			revision: 1,
			toId: input.targetId,
			toKind: input.targetKind,
			type: RELATIONS_COPY.evidence,
		},
	});
	await prisma.evidencePin.create({
		data: {
			id: crypto.randomUUID(),
			rangeEnd: input.rangeText.length,
			rangeStart: 0,
			rangeText: input.rangeText,
			relationId,
			sourceId: input.sourceId,
			sourceKind: input.sourceKind,
			sourceVersionId: input.sourceId,
			sourceVersionNumber: 1,
			surroundingText: input.rangeText,
			targetId: input.targetId,
			targetKind: input.targetKind,
		},
	});
}
