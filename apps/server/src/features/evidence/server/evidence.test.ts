/**
 * Evidence seam — version-pinned text range bind, convert preview,
 * Origin Location tombstone, redaction, Kanıt Rolü, and Founder
 * interpretation. Evidence Flow listing belongs to a later ticket.
 * docs/specs/45-evidence/spec.md and GitHub #328.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDecision } from "../../decisions/server/decisions";
import { createDocument } from "../../documents/server/documents";
import { createFeedback } from "../../feedback/server/feedback";
import { createProject } from "../../project-shell/server/project-shell";
import { listRelations } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	createSource,
	getSource,
	saveSourceVersion,
} from "../../sources-and-freshness/server/sources";
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
import { EVIDENCE_COPY, EVIDENCE_ROLES } from "./evidence-model";

const DATABASE_URL = localTestDatabaseUrl();
const AI_OR_MULTI = /\bAI\b|multi-create|classifier/i;

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
		sourceKind: "Source" | "Document";
		sourceVersionId: string;
		targetId: string;
		targetKind: "Work" | "Decision" | "Risk" | "Assumption" | "Question";
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
		const exported = presentEvidenceShare(loaded, { accessible: true });
		expect(exported.role).toBe(EVIDENCE_COPY.supporting);
		expect(exported.founderInterpretation).toBe("Founder note");
		expect(exported.source).toEqual({ id: source.id, kind: "Source" });
		expect(exported.target).toEqual({ id: work.id, kind: "Work" });
		expect(exported.versionRange?.textRange).toEqual(loaded.textRange);
		const withheld = presentEvidenceShare(loaded, { accessible: false });
		expect(withheld.role).toBeNull();
		expect(withheld.founderInterpretation).toBeNull();
		expect(withheld.versionRange).toBeNull();
		expect(withheld.historicalBindExists).toBe(true);
		expect(JSON.stringify(withheld)).not.toContain(EVIDENCE_COPY.supporting);
		expect(JSON.stringify(withheld)).not.toContain("Founder note");
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
