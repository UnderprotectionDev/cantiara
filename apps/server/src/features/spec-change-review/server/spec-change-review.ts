import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	presentChangedSections,
	type SpecChangeReviewView,
} from "./spec-change-review-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

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
			newVersion: true,
			previousVersion: true,
		},
		orderBy: { newRevision: "asc" },
		where: {
			documentId: input.documentId,
			workspaceId: input.workspaceId,
		},
	});
	return rows.map((row) => toView(row));
}

function toView(row: {
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
}): SpecChangeReviewView {
	return {
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
