import type { Prisma, PrismaClient } from "@cantiara/db";

import { usageTargetsFromBody } from "../../documents/server/documents-live";
import { EVIDENCE_COPY } from "../../evidence/server/evidence-model";
import { HUMAN_ORIGIN } from "../../mutation-core/server/mutation-shared";
import { createRelationInTransaction } from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	isUsageKind,
	USAGE_KIND,
	USAGE_KIND_LABEL,
} from "../../relations/server/relations-model";
import { createWorkInTransaction } from "../../work-lifecycle/server/work-lifecycle";
import { DEFAULT_WORK_TYPE } from "../../work-lifecycle/server/work-lifecycle-model";
import {
	headingContainingText,
	headingForSectionId,
	isSpecChangeReviewStatus,
	presentChangedSections,
	SPEC_CHANGE_REVIEW_COPY,
	type SpecChangeReviewCandidateView,
	type SpecChangeReviewFollowUpPreview,
	type SpecChangeReviewView,
} from "./spec-change-review-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

interface CandidateDraft {
	changedSection: string | null;
	documentLevel: boolean;
	recordId: string;
	recordKind: string;
	why: Set<string>;
}

interface CandidateRow {
	changedSection: string | null;
	documentLevel: boolean;
	id: string;
	note: string;
	recordId: string;
	recordKind: string;
	reviewStatus: string;
	why: Prisma.JsonValue;
}

export type MarkSpecChangeReviewCandidateOutcome =
	| { candidate: SpecChangeReviewCandidateView; status: "committed" }
	| { reason: string; status: "rejected" };

export async function openSpecChangeReviewForSavedVersion(
	tx: Prisma.TransactionClient,
	input: { documentId: string; previousRevision: number; workspaceId: string }
): Promise<void> {
	if (
		!("specChangeReview" in tx) ||
		typeof tx.specChangeReview?.createMany !== "function"
	) {
		return;
	}
	const features = await tx.work.findMany({
		select: { id: true },
		where: {
			archived: false,
			primarySpecId: input.documentId,
			trashedAt: null,
			type: "Feature",
		},
	});
	if (features.length === 0) {
		return;
	}
	const previous = await tx.documentVersion.findUnique({
		where: {
			documentId_revision: {
				documentId: input.documentId,
				revision: input.previousRevision,
			},
		},
	});
	const next = await tx.documentVersion.findFirst({
		orderBy: { revision: "desc" },
		where: { documentId: input.documentId },
	});
	if (!(previous && next) || previous.id === next.id) {
		return;
	}
	await tx.specChangeReview.createMany({
		data: features.map((feature) => ({
			documentId: input.documentId,
			featureId: feature.id,
			id: crypto.randomUUID(),
			newRevision: next.revision,
			newVersionId: next.id,
			previousRevision: previous.revision,
			previousVersionId: previous.id,
			workspaceId: input.workspaceId,
		})),
		skipDuplicates: true,
	});
	const reviews = await tx.specChangeReview.findMany({
		where: {
			documentId: input.documentId,
			newVersionId: next.id,
			previousVersionId: previous.id,
		},
	});
	const drafts = await collectRecordedLinkCandidates(tx, {
		documentId: input.documentId,
		newBody: next.body,
		previousBody: previous.body,
	});
	if (
		!("specChangeReviewCandidate" in tx) ||
		typeof tx.specChangeReviewCandidate?.createMany !== "function"
	) {
		return;
	}
	const already = await tx.specChangeReviewCandidate.findMany({
		select: { reviewId: true },
		where: { reviewId: { in: reviews.map((review) => review.id) } },
	});
	const filled = new Set(already.map((row) => row.reviewId));
	const pending = reviews.filter((review) => !filled.has(review.id));
	if (pending.length === 0) {
		return;
	}
	await tx.specChangeReviewCandidate.createMany({
		data: pending.flatMap((review) =>
			drafts.map((draft) => ({
				changedSection: draft.changedSection,
				documentLevel: draft.documentLevel,
				id: crypto.randomUUID(),
				note: "",
				recordId: draft.recordId,
				recordKind: draft.recordKind,
				reviewId: review.id,
				reviewStatus: SPEC_CHANGE_REVIEW_COPY.waiting,
				why: [...draft.why],
			}))
		),
	});
}

export async function listSpecChangeReviews(
	prisma: PrismaLike,
	input: { documentId: string; workspaceId: string }
): Promise<SpecChangeReviewView[]> {
	if (
		!("specChangeReview" in prisma) ||
		typeof prisma.specChangeReview?.findMany !== "function"
	) {
		return [];
	}
	const rows = await prisma.specChangeReview.findMany({
		include: {
			candidates: true,
			newVersion: true,
			previousVersion: true,
		},
		orderBy: { newRevision: "asc" },
		where: {
			documentId: input.documentId,
			workspaceId: input.workspaceId,
		},
	});
	return await Promise.all(
		rows.map((row) => toView(prisma, row, input.workspaceId))
	);
}

export async function markSpecChangeReviewCandidate(
	prisma: PrismaLike,
	input: {
		candidateId: string;
		note: string;
		reviewId: string;
		status: string;
		workspaceId: string;
	}
): Promise<MarkSpecChangeReviewCandidateOutcome> {
	if (!isSpecChangeReviewStatus(input.status)) {
		return { reason: "unknown-review-status", status: "rejected" };
	}
	if (
		!("specChangeReviewCandidate" in prisma) ||
		typeof prisma.specChangeReviewCandidate?.findFirst !== "function"
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const row = await prisma.specChangeReviewCandidate.findFirst({
		include: { review: true },
		where: {
			id: input.candidateId,
			review: { workspaceId: input.workspaceId },
			reviewId: input.reviewId,
		},
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const updated = await prisma.specChangeReviewCandidate.update({
		data: {
			note: input.note,
			reviewStatus: input.status,
		},
		where: { id: row.id },
	});
	return {
		candidate: await presentCandidate(prisma, updated, input.workspaceId),
		status: "committed",
	};
}

export type PreviewSpecChangeReviewFollowUpOutcome =
	| { preview: SpecChangeReviewFollowUpPreview; status: "committed" }
	| { reason: string; status: "rejected" };

export type ConfirmSpecChangeReviewFollowUpOutcome =
	| {
			status: "committed";
			work: {
				id: string;
				projectId: string;
				status: string;
				title: string;
				type: string;
			};
	  }
	| { reason: string; status: "rejected" };

class FollowUpBarrierError extends Error {
	readonly outcome: ConfirmSpecChangeReviewFollowUpOutcome;

	constructor(outcome: ConfirmSpecChangeReviewFollowUpOutcome) {
		super("spec-change-review-follow-up");
		this.outcome = outcome;
	}
}

export async function previewSpecChangeReviewFollowUp(
	prisma: PrismaLike,
	input: { candidateId: string; reviewId: string; workspaceId: string }
): Promise<PreviewSpecChangeReviewFollowUpOutcome> {
	const loaded = await loadFollowUpContext(prisma, input);
	if (loaded.status !== "ok") {
		return loaded;
	}
	return { preview: loaded.preview, status: "committed" };
}

export async function confirmSpecChangeReviewFollowUp(
	prisma: PrismaLike,
	input: {
		actorId: string;
		candidateId: string;
		idempotencyKey: string;
		previewAcknowledged: boolean;
		reviewId: string;
		workspaceId: string;
	}
): Promise<ConfirmSpecChangeReviewFollowUpOutcome> {
	if (input.previewAcknowledged !== true) {
		return { reason: "preview-required", status: "rejected" };
	}
	if (!("work" in prisma) || typeof prisma.work?.create !== "function") {
		return { reason: "target-not-found", status: "rejected" };
	}
	const loaded = await loadFollowUpContext(prisma, input);
	if (loaded.status !== "ok") {
		return loaded;
	}
	try {
		return await prisma.$transaction(async (tx) => {
			const created = await createWorkInTransaction(tx, {
				actorId: input.actorId,
				idempotencyKey: `${input.idempotencyKey}:work`,
				origin: HUMAN_ORIGIN,
				payload: {
					projectId: loaded.preview.project.id,
					title: loaded.preview.followUpWork.title,
					type: loaded.preview.followUpWork.type,
				},
			});
			if (created.status !== "committed" && created.status !== "replayed") {
				throw new FollowUpBarrierError({
					reason: "target-not-found",
					status: "rejected",
				});
			}
			const origin = await createRelationInTransaction(tx, {
				actorId: input.actorId,
				from: { id: loaded.documentId, kind: "Document" },
				idempotencyKey: `${input.idempotencyKey}:origin`,
				origin: HUMAN_ORIGIN,
				originLocation: {
					componentId: loaded.candidateRecordId,
					ownerId: loaded.documentId,
					ownerKind: "Document",
					sourceVersion: `${loaded.preview.specVersions.previous.id}:${loaded.preview.specVersions.new.id}`,
				},
				previewAcknowledged: true,
				to: { id: created.work.id, kind: "Work" },
				type: RELATIONS_COPY.origin,
				viewerWorkspaceId: input.workspaceId,
			});
			if (origin.status !== "committed" && origin.status !== "replayed") {
				throw new FollowUpBarrierError({
					reason: "target-not-found",
					status: "rejected",
				});
			}
			return {
				status: "committed" as const,
				work: {
					id: created.work.id,
					projectId: created.work.projectId,
					status: created.work.status,
					title: created.work.title,
					type: created.work.type,
				},
			};
		});
	} catch (error) {
		if (error instanceof FollowUpBarrierError) {
			return error.outcome;
		}
		throw error;
	}
}

async function loadFollowUpContext(
	prisma: PrismaLike,
	input: { candidateId: string; reviewId: string; workspaceId: string }
): Promise<
	| {
			candidateRecordId: string;
			documentId: string;
			preview: SpecChangeReviewFollowUpPreview;
			status: "ok";
	  }
	| { reason: string; status: "rejected" }
> {
	if (
		!("specChangeReviewCandidate" in prisma) ||
		typeof prisma.specChangeReviewCandidate?.findFirst !== "function"
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const row = await prisma.specChangeReviewCandidate.findFirst({
		include: {
			review: {
				include: {
					feature: { include: { project: true } },
					newVersion: true,
					previousVersion: true,
				},
			},
		},
		where: {
			id: input.candidateId,
			review: { workspaceId: input.workspaceId },
			reviewId: input.reviewId,
		},
	});
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const presented = await presentCandidate(prisma, row, input.workspaceId);
	if (presented.brokenReason || presented.title === null) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const { project } = row.review.feature;
	if (project.workspaceId !== input.workspaceId) {
		return { reason: "target-not-found", status: "rejected" };
	}
	return {
		candidateRecordId: row.recordId,
		documentId: row.review.documentId,
		preview: {
			candidateSourceRelation: {
				origin: RELATIONS_COPY.origin,
				recordKind: row.recordKind,
				why: presented.why,
			},
			followUpWork: {
				startingStatus: SPEC_CHANGE_REVIEW_COPY.startingStatus,
				title: presented.title,
				type: DEFAULT_WORK_TYPE,
			},
			project: { id: project.id, name: project.name },
			specVersions: {
				new: {
					body: row.review.newVersion.body,
					id: row.review.newVersion.id,
					revision: row.review.newVersion.revision,
					title: row.review.newVersion.title,
				},
				previous: {
					body: row.review.previousVersion.body,
					id: row.review.previousVersion.id,
					revision: row.review.previousVersion.revision,
					title: row.review.previousVersion.title,
				},
			},
		},
		status: "ok",
	};
}

type CandidateAdder = (
	recordId: string,
	recordKind: string,
	why: string,
	section: string | null
) => void;

async function collectRecordedLinkCandidates(
	tx: Prisma.TransactionClient,
	input: { documentId: string; newBody: string; previousBody: string }
): Promise<CandidateDraft[]> {
	const drafts = new Map<string, CandidateDraft>();
	const add = createCandidateAdder(drafts, input.documentId);
	await addPrimarySpecBinds(tx, input.documentId, add);
	await addTypedRelationCandidates(tx, input.documentId, add);
	await addUsageLinkCandidates(tx, input, add);
	await addEvidencePinCandidates(tx, input, add);
	return [...drafts.values()];
}

function createCandidateAdder(
	drafts: Map<string, CandidateDraft>,
	documentId: string
): CandidateAdder {
	return (recordId, recordKind, why, section) => {
		if (recordId === documentId) {
			return;
		}
		const key = `${recordKind}:${recordId}`;
		const existing = drafts.get(key);
		if (!existing) {
			drafts.set(key, {
				changedSection: section,
				documentLevel: section === null,
				recordId,
				recordKind,
				why: new Set([why]),
			});
			return;
		}
		existing.why.add(why);
		if (section) {
			existing.documentLevel = false;
			existing.changedSection = existing.changedSection ?? section;
		}
	};
}

async function addPrimarySpecBinds(
	tx: Prisma.TransactionClient,
	documentId: string,
	add: CandidateAdder
): Promise<void> {
	const features = await tx.work.findMany({
		select: { id: true },
		where: { primarySpecId: documentId },
	});
	for (const feature of features) {
		add(feature.id, "Work", SPEC_CHANGE_REVIEW_COPY.primarySpec, null);
	}
}

async function addTypedRelationCandidates(
	tx: Prisma.TransactionClient,
	documentId: string,
	add: CandidateAdder
): Promise<void> {
	if (
		!("typedRelation" in tx) ||
		typeof tx.typedRelation?.findMany !== "function"
	) {
		return;
	}
	const relations = await tx.typedRelation.findMany({
		where: {
			OR: [
				{ fromId: documentId, fromKind: "Document" },
				{ toId: documentId, toKind: "Document" },
			],
		},
	});
	for (const relation of relations) {
		const otherIsFrom =
			relation.toId === documentId && relation.toKind === "Document";
		add(
			otherIsFrom ? relation.fromId : relation.toId,
			otherIsFrom ? relation.fromKind : relation.toKind,
			whyForTypedRelation(relation),
			null
		);
	}
}

async function addUsageLinkCandidates(
	tx: Prisma.TransactionClient,
	input: { documentId: string; newBody: string; previousBody: string },
	add: CandidateAdder
): Promise<void> {
	if (!("usageLink" in tx) || typeof tx.usageLink?.findMany !== "function") {
		return;
	}
	const links = await tx.usageLink.findMany({
		where: {
			OR: [
				{ hostRecordId: input.documentId },
				{ sourceRecordId: input.documentId },
			],
		},
	});
	const previousOnSpec = usageTargetsFromBody(input.previousBody).map(
		(target) => ({
			embedId: target.embedId,
			hostRecordId: input.documentId,
			kind: target.kind,
			sourceRecordId: target.sourceRecordId,
		})
	);
	const recorded = [...links, ...previousOnSpec];
	const kinds = await kindMap(
		tx,
		recorded.flatMap((link) => [link.hostRecordId, link.sourceRecordId])
	);
	for (const link of recorded) {
		const why = isUsageKind(link.kind)
			? USAGE_KIND_LABEL[link.kind]
			: link.kind;
		const kind = isUsageKind(link.kind) ? link.kind : null;
		if (link.hostRecordId === input.documentId) {
			const sectionBound =
				kind === USAGE_KIND.liveContentBlock ||
				kind === USAGE_KIND.inlineRecordReference;
			const section = sectionBound
				? (headingContainingText(input.newBody, link.sourceRecordId) ??
					headingContainingText(input.previousBody, link.sourceRecordId))
				: null;
			add(
				link.sourceRecordId,
				kinds.get(link.sourceRecordId) ?? "Work",
				why,
				section
			);
			continue;
		}
		const sectionId = sectionIdFromEmbed(link.embedId);
		const section =
			kind === USAGE_KIND.stableSectionReference && sectionId
				? (headingForSectionId(input.previousBody, sectionId) ??
					headingForSectionId(input.newBody, sectionId))
				: null;
		add(
			link.hostRecordId,
			kinds.get(link.hostRecordId) ?? "Work",
			why,
			section
		);
	}
}

async function addEvidencePinCandidates(
	tx: Prisma.TransactionClient,
	input: { documentId: string; newBody: string; previousBody: string },
	add: CandidateAdder
): Promise<void> {
	if (
		!("evidencePin" in tx) ||
		typeof tx.evidencePin?.findMany !== "function"
	) {
		return;
	}
	const pins = await tx.evidencePin.findMany({
		where: {
			OR: [{ sourceId: input.documentId }, { targetId: input.documentId }],
		},
	});
	for (const pin of pins) {
		const fromSource = pin.sourceId === input.documentId;
		const section = fromSource
			? (headingContainingText(input.previousBody, pin.rangeText) ??
				headingContainingText(input.newBody, pin.rangeText))
			: null;
		add(
			fromSource ? pin.targetId : pin.sourceId,
			fromSource ? pin.targetKind : pin.sourceKind,
			EVIDENCE_COPY.versionPinnedEvidence,
			section
		);
	}
}

function whyForTypedRelation(relation: {
	originComponentId: string | null;
	type: string;
}): string {
	if (relation.originComponentId === "version-pinned-evidence") {
		return EVIDENCE_COPY.versionPinnedEvidence;
	}
	if (relation.type === RELATIONS_COPY.evidence) {
		return EVIDENCE_COPY.versionPinnedEvidence;
	}
	if (relation.type === RELATIONS_COPY.primarySpec) {
		return SPEC_CHANGE_REVIEW_COPY.primarySpec;
	}
	return relation.type;
}

function sectionIdFromEmbed(embedId: string): string | null {
	const prefix = "live-section:";
	if (!embedId.startsWith(prefix)) {
		return null;
	}
	const rest = embedId.slice(prefix.length);
	const split = rest.indexOf(":");
	if (split < 0) {
		return null;
	}
	return rest.slice(split + 1);
}

async function kindMap(
	tx: Prisma.TransactionClient,
	recordIds: readonly string[]
): Promise<Map<string, string>> {
	const ids = [...new Set(recordIds)];
	const kinds = new Map<string, string>();
	if (ids.length === 0) {
		return kinds;
	}
	const works = await tx.work.findMany({
		select: { id: true },
		where: { id: { in: ids } },
	});
	for (const work of works) {
		kinds.set(work.id, "Work");
	}
	const remaining = ids.filter((id) => !kinds.has(id));
	if (remaining.length === 0) {
		return kinds;
	}
	const documents = await tx.document.findMany({
		select: { id: true },
		where: { id: { in: remaining } },
	});
	for (const document of documents) {
		kinds.set(document.id, "Document");
	}
	return kinds;
}

async function toView(
	prisma: PrismaLike,
	row: {
		candidates?: CandidateRow[];
		documentId: string;
		featureId: string;
		id: string;
		newVersion: {
			body: string;
			id: string;
			revision: number;
			title: string;
		};
		previousVersion: {
			body: string;
			id: string;
			revision: number;
			title: string;
		};
	},
	workspaceId: string
): Promise<SpecChangeReviewView> {
	const presented = await Promise.all(
		(row.candidates ?? []).map((candidate) =>
			presentCandidate(prisma, candidate, workspaceId)
		)
	);
	presented.sort((left, right) => left.recordId.localeCompare(right.recordId));
	return {
		candidates: presented,
		changedSections: presentChangedSections(
			row.previousVersion.body,
			row.newVersion.body
		),
		featureId: row.featureId,
		id: row.id,
		newVersion: {
			body: row.newVersion.body,
			id: row.newVersion.id,
			revision: row.newVersion.revision,
			title: row.newVersion.title,
		},
		previousVersion: {
			body: row.previousVersion.body,
			id: row.previousVersion.id,
			revision: row.previousVersion.revision,
			title: row.previousVersion.title,
		},
		primarySpec: {
			id: row.documentId,
			title: row.newVersion.title,
		},
	};
}

async function presentCandidate(
	prisma: PrismaLike,
	row: CandidateRow,
	workspaceId: string
): Promise<SpecChangeReviewCandidateView> {
	const access = await resolveAccess(
		prisma,
		row.recordKind,
		row.recordId,
		workspaceId
	);
	const why = Array.isArray(row.why)
		? row.why.filter((value): value is string => typeof value === "string")
		: [];
	const reviewStatus = isSpecChangeReviewStatus(row.reviewStatus)
		? row.reviewStatus
		: SPEC_CHANGE_REVIEW_COPY.waiting;
	return {
		brokenReason: access.brokenReason,
		changedSection: row.documentLevel ? null : row.changedSection,
		documentLevel: row.documentLevel,
		id: row.id,
		note: row.note,
		openTarget: access.brokenReason
			? { kind: "broken-reference" as const, reason: access.brokenReason }
			: { kind: "record" as const, title: access.title ?? "" },
		recordId: row.recordId,
		recordKind: row.recordKind,
		reviewStatus,
		title: access.title,
		why,
	};
}

async function resolveAccess(
	prisma: PrismaLike,
	kind: string,
	recordId: string,
	workspaceId: string
): Promise<{ brokenReason: string | null; title: string | null }> {
	if (kind === "Work") {
		const work = await prisma.work.findUnique({
			include: { project: true },
			where: { id: recordId },
		});
		if (!work) {
			return { brokenReason: RELATIONS_COPY.permanentlyDeleted, title: null };
		}
		if (work.project.workspaceId !== workspaceId) {
			return { brokenReason: RELATIONS_COPY.noAccess, title: null };
		}
		if (work.trashedAt) {
			return { brokenReason: RELATIONS_COPY.inTrash, title: null };
		}
		return { brokenReason: null, title: work.title };
	}
	if (kind === "Document") {
		const document = await prisma.document.findUnique({
			where: { id: recordId },
		});
		if (!document) {
			return { brokenReason: RELATIONS_COPY.permanentlyDeleted, title: null };
		}
		if (document.workspaceId !== workspaceId) {
			return { brokenReason: RELATIONS_COPY.noAccess, title: null };
		}
		return { brokenReason: null, title: document.title };
	}
	return { brokenReason: RELATIONS_COPY.permanentlyDeleted, title: null };
}
