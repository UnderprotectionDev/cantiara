/**
 * Evidence seam — version-pinned text range bind, convert preview,
 * Origin Location tombstone, and redaction. Role and Evidence Flow
 * belong to later tickets.
 * docs/specs/45-evidence/spec.md and GitHub #327.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Kanıt akışı).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDocument } from "../../documents/server/documents";
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
	previewBindEvidence,
	previewConvertEvidence,
	previewRebindEvidence,
	rebindEvidence,
	redactEvidenceContent,
} from "./evidence";
import { EVIDENCE_COPY } from "./evidence-model";

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
		expect(redacted.pin.historicalBindExists).toBe(true);
		const onSource = await listEvidenceOnSource(prisma, "Source", source.id);
		expect(onSource).toHaveLength(1);
		expect(onSource[0]?.historicalBindExists).toBe(true);
	});
});
