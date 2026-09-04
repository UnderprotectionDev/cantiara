import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { getSource } from "./sources";
import {
	bindSourceEvidenceCommandSchema,
	SOURCE_EVIDENCE_REVIEW,
	SOURCE_VERSION_IN_USE_SIGNAL_ID,
	SOURCE_VERSION_IN_USE_SIGNAL_SECTION,
	SOURCES_COPY,
	type SourceEvidenceUseOutcome,
	type SourceEvidenceUseView,
	type SourceFreshnessView,
	type SourceVersionInUseSignalView,
	sourceEvidenceUseCommandSchema,
} from "./sources-model";

type PrismaTransaction = Prisma.TransactionClient;

export async function bindSourceEvidenceUse(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceEvidenceUseOutcome> {
	const parsed = bindSourceEvidenceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction(async (tx) => {
		const existing = await tx.mutationReceipt.findUnique({
			where: { commandKey },
		});
		if (existing) {
			if (existing.payloadFingerprint !== fingerprint) {
				return { conflict: MUTATION_COPY.conflict, status: "conflict" };
			}
			const freshness = await inspectSourceFreshness(
				tx as unknown as PrismaClient,
				parsed.data.payload.sourceId
			);
			if (!freshness) {
				return { reason: "source-not-found", status: "rejected" };
			}
			return { freshness, status: "replayed" };
		}
		const source = await tx.source.findUnique({
			where: { id: parsed.data.payload.sourceId },
		});
		const version = await tx.sourceVersion.findUnique({
			where: { id: parsed.data.payload.sourceVersionId },
		});
		if (!(source && version) || version.sourceId !== source.id) {
			return { reason: "source-not-found", status: "rejected" };
		}
		const relation = await tx.typedRelation.create({
			data: {
				fromId: source.id,
				fromKind: "Source",
				id: crypto.randomUUID(),
				revision: 1,
				toId: parsed.data.payload.targetId,
				toKind: parsed.data.payload.targetKind,
				type: RELATIONS_COPY.evidence,
			},
		});
		await tx.sourceEvidencePin.create({
			data: {
				id: crypto.randomUUID(),
				rangeText: parsed.data.payload.rangeText,
				relationId: relation.id,
				sourceId: source.id,
				sourceVersionId: version.id,
				targetId: parsed.data.payload.targetId,
				targetKind: parsed.data.payload.targetKind,
			},
		});
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			targetId: relation.id,
		});
		await syncSourceVersionInUseTx(tx, source.id);
		const freshness = await inspectSourceFreshness(
			tx as unknown as PrismaClient,
			source.id
		);
		if (!freshness) {
			return { reason: "source-not-found", status: "rejected" };
		}
		return { freshness, status: "committed" };
	});
}

export async function keepSourceEvidenceUse(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceEvidenceUseOutcome> {
	return await decideSourceEvidenceUse(prisma, command, "keep");
}

export async function rebindSourceEvidenceUse(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceEvidenceUseOutcome> {
	return await decideSourceEvidenceUse(prisma, command, "rebind");
}

export async function inspectSourceFreshness(
	prisma: PrismaClient,
	sourceId: string
): Promise<SourceFreshnessView | null> {
	const source = await getSource(prisma, sourceId);
	if (!source) {
		return null;
	}
	const checks = await prisma.sourceCheck.findMany({
		orderBy: { startedAt: "asc" },
		where: { sourceId },
	});
	const uses = await listEvidenceUses(
		prisma,
		sourceId,
		source.approvedVersionNumber
	);
	const openUses = uses.filter(
		(use) => use.newerSourceVersionExists && !use.reviewed
	);
	return {
		checks: checks.map(toCheckViewRow),
		signal: toSignalView(sourceId, openUses),
		source,
		uses,
	};
}

export async function syncSourceVersionInUse(
	prisma: PrismaClient,
	sourceId: string
): Promise<void> {
	await prisma.$transaction((tx) => syncSourceVersionInUseTx(tx, sourceId));
}

async function decideSourceEvidenceUse(
	prisma: PrismaClient,
	command: unknown,
	kind: "keep" | "rebind"
): Promise<SourceEvidenceUseOutcome> {
	const parsed = sourceEvidenceUseCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		kind,
		...parsed.data.payload,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		decideInTransaction(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			kind,
			pinId: parsed.data.payload.pinId,
		})
	);
}

async function decideInTransaction(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		kind: "keep" | "rebind";
		pinId: string;
	}
): Promise<SourceEvidenceUseOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey: input.commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== input.fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return await freshnessForPin(tx, input.pinId, "replayed");
	}
	const pin = await tx.sourceEvidencePin.findUnique({
		where: { id: input.pinId },
	});
	if (!pin) {
		return { reason: "pin-not-found", status: "rejected" };
	}
	const source = await tx.source.findUnique({
		where: { id: pin.sourceId },
	});
	if (!source) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const applied = await applyEvidenceDecision(tx, {
		actorId: input.actorId,
		kind: input.kind,
		pin,
		source,
	});
	if (applied) {
		return applied;
	}
	await writeReceipt(tx, {
		actorId: input.actorId,
		commandKey: input.commandKey,
		fingerprint: input.fingerprint,
		targetId: pin.id,
	});
	await syncSourceVersionInUseTx(tx, source.id);
	return await freshnessForPin(tx, pin.id, "committed");
}

async function freshnessForPin(
	tx: PrismaTransaction,
	pinId: string,
	status: "committed" | "replayed"
): Promise<SourceEvidenceUseOutcome> {
	const pin = await tx.sourceEvidencePin.findUnique({
		where: { id: pinId },
	});
	if (!pin) {
		return { reason: "pin-not-found", status: "rejected" };
	}
	const freshness = await inspectSourceFreshness(
		tx as unknown as PrismaClient,
		pin.sourceId
	);
	if (!freshness) {
		return { reason: "source-not-found", status: "rejected" };
	}
	return { freshness, status };
}

async function applyEvidenceDecision(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		kind: "keep" | "rebind";
		pin: {
			id: string;
			rangeText: string;
			sourceId: string;
		};
		source: { approvedVersionNumber: number; id: string };
	}
): Promise<SourceEvidenceUseOutcome | null> {
	if (input.kind === "rebind") {
		const approved = await tx.sourceVersion.findFirst({
			where: {
				sourceId: input.source.id,
				versionNumber: input.source.approvedVersionNumber,
			},
		});
		if (!approved?.capturedContent.includes(input.pin.rangeText)) {
			return {
				copy: {
					noMatchInCandidateVersion: SOURCES_COPY.noMatchInCandidateVersion,
				},
				reason: "no-match-in-candidate-version",
				status: "rejected",
			};
		}
		await tx.sourceEvidencePin.update({
			data: {
				reviewedAgainstVersionNumber: input.source.approvedVersionNumber,
				reviewedAt: new Date(),
				reviewedById: input.actorId,
				reviewKind: SOURCE_EVIDENCE_REVIEW.rebind,
				sourceVersionId: approved.id,
			},
			where: { id: input.pin.id },
		});
		return null;
	}
	await tx.sourceEvidencePin.update({
		data: {
			reviewedAgainstVersionNumber: input.source.approvedVersionNumber,
			reviewedAt: new Date(),
			reviewedById: input.actorId,
			reviewKind: SOURCE_EVIDENCE_REVIEW.keep,
		},
		where: { id: input.pin.id },
	});
	return null;
}

async function listEvidenceUses(
	prisma: PrismaClient,
	sourceId: string,
	approvedVersionNumber: number
): Promise<SourceEvidenceUseView[]> {
	const pins = await prisma.sourceEvidencePin.findMany({
		include: { sourceVersion: true },
		orderBy: { createdAt: "asc" },
		where: { sourceId },
	});
	return pins.map((pin) => {
		const newer = pin.sourceVersion.versionNumber < approvedVersionNumber;
		const reviewed = pin.reviewedAgainstVersionNumber === approvedVersionNumber;
		return {
			accessedAt: pin.sourceVersion.accessedAt.toISOString(),
			id: pin.id,
			newerSourceVersionExists: newer,
			rangeText: pin.rangeText,
			reviewed,
			sourceVersionNumber: pin.sourceVersion.versionNumber,
			targetId: pin.targetId,
			targetKind: pin.targetKind,
		};
	});
}

async function syncSourceVersionInUseTx(
	tx: PrismaTransaction,
	sourceId: string
): Promise<void> {
	const source = await tx.source.findUnique({
		where: { id: sourceId },
	});
	if (!source) {
		return;
	}
	const uses = await listEvidenceUses(
		tx as unknown as PrismaClient,
		sourceId,
		source.approvedVersionNumber
	);
	const openUses = uses.filter(
		(use) => use.newerSourceVersionExists && !use.reviewed
	);
	const existing = await tx.sourceVersionInUseSignal.findUnique({
		where: { sourceId },
	});
	if (openUses.length === 0) {
		if (existing) {
			await tx.sourceVersionInUseSignal.delete({
				where: { sourceId },
			});
		}
		return;
	}
	if (existing) {
		await tx.sourceVersionInUseSignal.update({
			data: {
				section: SOURCE_VERSION_IN_USE_SIGNAL_SECTION,
				signalId: SOURCE_VERSION_IN_USE_SIGNAL_ID,
			},
			where: { sourceId },
		});
		return;
	}
	await tx.sourceVersionInUseSignal.create({
		data: {
			id: crypto.randomUUID(),
			section: SOURCE_VERSION_IN_USE_SIGNAL_SECTION,
			signalId: SOURCE_VERSION_IN_USE_SIGNAL_ID,
			sourceId,
		},
	});
}

function toSignalView(
	sourceId: string,
	openUses: SourceEvidenceUseView[]
): SourceVersionInUseSignalView | null {
	if (openUses.length === 0) {
		return null;
	}
	return {
		section: SOURCE_VERSION_IN_USE_SIGNAL_SECTION,
		signalId: SOURCE_VERSION_IN_USE_SIGNAL_ID,
		sourceId,
		uses: openUses,
	};
}

function toCheckViewRow(row: {
	actorId: string;
	candidateAccessedAt: Date | null;
	candidateContent: string | null;
	candidateTitle: string | null;
	candidateUrl: string | null;
	comparedApprovedVersionNumber: number;
	contentType: string | null;
	disposition: string;
	failureReason: string | null;
	finalUrl: string | null;
	fingerprint: string | null;
	httpResult: string;
	id: string;
	sourceId: string;
	startUrl: string;
	startedAt: Date;
}) {
	return {
		actorId: row.actorId,
		candidate:
			row.candidateContent !== null &&
			row.candidateTitle !== null &&
			row.candidateUrl !== null &&
			row.candidateAccessedAt !== null
				? {
						accessedAt: row.candidateAccessedAt.toISOString(),
						capturedContent: row.candidateContent,
						title: row.candidateTitle,
						url: row.candidateUrl,
					}
				: null,
		comparedApprovedVersionNumber: row.comparedApprovedVersionNumber,
		contentType: row.contentType,
		disposition: row.disposition as "kept" | "open" | "saved",
		failureReason: row.failureReason,
		finalUrl: row.finalUrl,
		fingerprint: row.fingerprint,
		httpResult: row.httpResult,
		id: row.id,
		presentsOldContentAsCurrent: false as const,
		sourceId: row.sourceId,
		startedAt: row.startedAt.toISOString(),
		startUrl: row.startUrl,
	};
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		targetId: string;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: input.targetId,
			targetId: input.targetId,
		},
	});
}
