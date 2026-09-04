import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@cantiara/db";
import { diffLines } from "diff";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	contentTypeIsExecutable,
	fetchIsolatedHttp,
	type IsolatedHopTransport,
} from "./isolated-egress";
import { getSource, saveSourceVersion } from "./sources";
import { syncSourceVersionInUse } from "./sources-evidence";
import {
	keepCurrentVersionCommandSchema,
	recheckSourceCommandSchema,
	SOURCE_CHECK_DISPOSITION,
	SOURCE_CHECK_FAILURE,
	SOURCES_COPY,
	type SourceCheckOutcome,
	type SourceCheckView,
	type SourceCompareView,
	type SourceRecheckPreview,
	saveCheckVersionCommandSchema,
} from "./sources-model";
import { extractCapturedSnapshot } from "./sources-snapshot";

type PrismaTransaction = Prisma.TransactionClient;

const HTML_TYPE = /html|xhtml/i;

export async function previewRecheck(
	prisma: PrismaClient,
	sourceId: string
): Promise<SourceRecheckPreview | null> {
	const source = await getSource(prisma, sourceId);
	if (!source) {
		return null;
	}
	return {
		approvedVersionNumber: source.approvedVersionNumber,
		startUrl: source.url,
		thirdPartyFetchWillOccur: true,
	};
}

export async function recheckSource(
	prisma: PrismaClient,
	command: unknown,
	input: { transport: IsolatedHopTransport }
): Promise<SourceCheckOutcome> {
	const parsed = recheckSourceCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		recheckInTransaction(tx, parsed.data, commandKey, fingerprint, input)
	);
}

export async function keepCurrentSourceVersion(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceCheckOutcome> {
	const parsed = keepCurrentVersionCommandSchema.safeParse(command);
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
			return await replayCheck(tx, existing.targetId);
		}
		const check = await tx.sourceCheck.findUnique({
			where: { id: parsed.data.payload.checkId },
		});
		if (!check) {
			return { reason: "check-not-found", status: "rejected" };
		}
		const updated = await tx.sourceCheck.update({
			data: { disposition: SOURCE_CHECK_DISPOSITION.kept },
			where: { id: check.id },
		});
		const source = await getSource(
			tx as unknown as PrismaClient,
			check.sourceId
		);
		if (!source) {
			return { reason: "source-not-found", status: "rejected" };
		}
		await writeReceipt(tx, {
			actorId: parsed.data.actorId,
			commandKey,
			fingerprint,
			targetId: updated.id,
		});
		return {
			check: toCheckView(updated),
			source,
			status: "committed",
		};
	});
}

export async function saveCheckAsNewSourceVersion(
	prisma: PrismaClient,
	command: unknown
): Promise<SourceCheckOutcome> {
	const parsed = saveCheckVersionCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const check = await prisma.sourceCheck.findUnique({
		where: { id: parsed.data.payload.checkId },
	});
	if (!check) {
		return { reason: "check-not-found", status: "rejected" };
	}
	if (
		check.candidateContent === null ||
		check.candidateTitle === null ||
		check.candidateUrl === null ||
		check.candidateAccessedAt === null
	) {
		return { reason: "candidate-missing", status: "rejected" };
	}
	const saved = await saveSourceVersion(prisma, {
		actorId: parsed.data.actorId,
		baseRevision: parsed.data.baseRevision,
		idempotencyKey: parsed.data.idempotencyKey,
		origin: "human",
		payload: {
			accessedAt: check.candidateAccessedAt.toISOString(),
			capturedContent: check.candidateContent,
			sourceId: check.sourceId,
			title: check.candidateTitle,
			url: check.candidateUrl,
		},
	});
	if (saved.status !== "committed" && saved.status !== "replayed") {
		if (saved.status === "conflict") {
			return saved;
		}
		return { reason: "source-not-found", status: "rejected" };
	}
	await prisma.sourceCheck.update({
		data: { disposition: SOURCE_CHECK_DISPOSITION.saved },
		where: { id: check.id },
	});
	await syncSourceVersionInUse(prisma, check.sourceId);
	const source = await getSource(prisma, check.sourceId);
	if (!source) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const stored = await prisma.sourceCheck.findUnique({
		where: { id: check.id },
	});
	if (!stored) {
		return { reason: "check-not-found", status: "rejected" };
	}
	return {
		check: toCheckView(stored),
		source,
		status: saved.status,
	};
}

export async function compareSourceCheck(
	prisma: PrismaClient,
	checkId: string
): Promise<SourceCompareView | null> {
	const check = await prisma.sourceCheck.findUnique({
		where: { id: checkId },
	});
	if (!check) {
		return null;
	}
	const source = await getSource(prisma, check.sourceId);
	if (!source) {
		return null;
	}
	const approved =
		source.versions.find(
			(version) => version.versionNumber === check.comparedApprovedVersionNumber
		) ?? source.versions.at(-1);
	if (!approved) {
		return null;
	}
	const pins = await prisma.sourceEvidencePin.findMany({
		orderBy: { createdAt: "asc" },
		where: { sourceVersionId: approved.id },
	});
	const candidate = check.candidateContent;
	const pinMatches = pins.map((pin) => ({
		match: candidate?.includes(pin.rangeText)
			? ("exact" as const)
			: ("none" as const),
		pinId: pin.id,
		rangeText: pin.rangeText,
		targetId: pin.targetId,
		targetKind: pin.targetKind,
	}));
	const changed =
		candidate !== null &&
		diffLines(approved.capturedContent, candidate).some(
			(part) => part.added === true || part.removed === true
		);
	return {
		approvedContent: approved.capturedContent,
		candidateContent: candidate,
		changed,
		copy: {
			noMatchInCandidateVersion: SOURCES_COPY.noMatchInCandidateVersion,
		},
		pinMatches,
	};
}

async function recheckInTransaction(
	tx: PrismaTransaction,
	command: {
		actorId: string;
		payload: { sourceId: string };
	},
	commandKey: string,
	fingerprint: string,
	input: { transport: IsolatedHopTransport }
): Promise<SourceCheckOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return await replayCheck(tx, existing.targetId);
	}
	const source = await tx.source.findUnique({
		where: { id: command.payload.sourceId },
	});
	if (!source) {
		return { reason: "source-not-found", status: "rejected" };
	}
	await lockProjectForSource(tx, source.projectId);
	const versions = await tx.sourceVersion.findMany({
		orderBy: { versionNumber: "asc" },
		where: { sourceId: source.id },
	});
	const approved =
		versions.find(
			(version) => version.versionNumber === source.approvedVersionNumber
		) ?? versions.at(-1);
	if (!approved) {
		return { reason: "source-not-found", status: "rejected" };
	}
	const startedAt = new Date();
	const fetched = await fetchIsolatedHttp(approved.url, input.transport);
	const created = await tx.sourceCheck.create({
		data: checkRow({
			actorId: command.actorId,
			approvedVersionNumber: source.approvedVersionNumber,
			fetched,
			sourceId: source.id,
			startedAt,
			startUrl: approved.url,
		}),
	});
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		targetId: created.id,
	});
	const view = await getSource(tx as unknown as PrismaClient, source.id);
	if (!view) {
		return { reason: "source-not-found", status: "rejected" };
	}
	return {
		check: toCheckView(created),
		source: view,
		status: "committed",
	};
}

function checkRow(input: {
	actorId: string;
	approvedVersionNumber: number;
	fetched: Awaited<ReturnType<typeof fetchIsolatedHttp>>;
	sourceId: string;
	startUrl: string;
	startedAt: Date;
}): Prisma.SourceCheckCreateInput {
	if (!input.fetched.ok) {
		return {
			actorId: input.actorId,
			comparedApprovedVersionNumber: input.approvedVersionNumber,
			disposition: SOURCE_CHECK_DISPOSITION.open,
			failureReason: mapFetchFailure(input.fetched.reason),
			httpResult: input.fetched.reason,
			id: crypto.randomUUID(),
			source: { connect: { id: input.sourceId } },
			startedAt: input.startedAt,
			startUrl: input.startUrl,
		};
	}
	if (
		input.fetched.status < 200 ||
		input.fetched.status >= 300 ||
		contentTypeIsExecutable(input.fetched.contentType)
	) {
		return {
			actorId: input.actorId,
			comparedApprovedVersionNumber: input.approvedVersionNumber,
			contentType: input.fetched.contentType,
			disposition: SOURCE_CHECK_DISPOSITION.open,
			failureReason: mapHttpFailure(
				input.fetched.status,
				input.fetched.contentType
			),
			finalUrl: input.fetched.finalUrl,
			httpResult: String(input.fetched.status),
			id: crypto.randomUUID(),
			source: { connect: { id: input.sourceId } },
			startedAt: input.startedAt,
			startUrl: input.startUrl,
		};
	}
	const body = input.fetched.body.toString("utf8");
	const snapshot = HTML_TYPE.test(input.fetched.contentType)
		? extractCapturedSnapshot(body)
		: { capturedContent: body, title: input.startUrl };
	const title = snapshot.title === "" ? input.startUrl : snapshot.title;
	return {
		actorId: input.actorId,
		candidateAccessedAt: input.startedAt,
		candidateContent: snapshot.capturedContent,
		candidateTitle: title,
		candidateUrl: input.fetched.finalUrl,
		comparedApprovedVersionNumber: input.approvedVersionNumber,
		contentType: input.fetched.contentType,
		disposition: SOURCE_CHECK_DISPOSITION.open,
		finalUrl: input.fetched.finalUrl,
		fingerprint: createHash("sha256")
			.update(snapshot.capturedContent)
			.digest("hex"),
		httpResult: String(input.fetched.status),
		id: crypto.randomUUID(),
		source: { connect: { id: input.sourceId } },
		startedAt: input.startedAt,
		startUrl: input.startUrl,
	};
}

function mapFetchFailure(reason: string): string {
	if (reason === "credentials") {
		return SOURCE_CHECK_FAILURE.credentials;
	}
	if (reason === "denied-target") {
		return SOURCE_CHECK_FAILURE.deniedTarget;
	}
	if (reason === "oversized") {
		return SOURCE_CHECK_FAILURE.oversized;
	}
	if (reason === "unsupported" || reason === "redirect-limit") {
		return SOURCE_CHECK_FAILURE.unsupported;
	}
	return SOURCE_CHECK_FAILURE.blocked;
}

function mapHttpFailure(status: number, contentType: string): string {
	if (contentTypeIsExecutable(contentType)) {
		return SOURCE_CHECK_FAILURE.unsupported;
	}
	if (status === 401 || status === 403) {
		return SOURCE_CHECK_FAILURE.auth;
	}
	if (status === 404 || status === 410) {
		return SOURCE_CHECK_FAILURE.deleted;
	}
	return SOURCE_CHECK_FAILURE.blocked;
}

function toCheckView(row: {
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
}): SourceCheckView {
	const disposition =
		row.disposition === SOURCE_CHECK_DISPOSITION.kept ||
		row.disposition === SOURCE_CHECK_DISPOSITION.saved
			? row.disposition
			: SOURCE_CHECK_DISPOSITION.open;
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
		disposition,
		failureReason: row.failureReason,
		finalUrl: row.finalUrl,
		fingerprint: row.fingerprint,
		httpResult: row.httpResult,
		id: row.id,
		presentsOldContentAsCurrent: false,
		sourceId: row.sourceId,
		startedAt: row.startedAt.toISOString(),
		startUrl: row.startUrl,
	};
}

async function replayCheck(
	tx: PrismaTransaction,
	checkId: string
): Promise<SourceCheckOutcome> {
	const check = await tx.sourceCheck.findUnique({
		where: { id: checkId },
	});
	if (!check) {
		return { reason: "check-not-found", status: "rejected" };
	}
	const source = await getSource(tx as unknown as PrismaClient, check.sourceId);
	if (!source) {
		return { reason: "source-not-found", status: "rejected" };
	}
	return {
		check: toCheckView(check),
		source,
		status: "replayed",
	};
}

async function lockProjectForSource(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`sources:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
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
