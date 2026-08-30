import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	type CancelHandoffCommand,
	type CancelHandoffOutcome,
	cancelHandoffCommandSchema,
	EXTERNAL_HANDOFFS_COPY,
	type ExternalExecutionHandoffView,
	externalExecutionHandoffViewSchema,
	type GithubContext,
	githubContextSchema,
	HANDOFF_SEPARATIONS,
	HANDOFF_STATUS,
	type HandoffStatus,
	isHandoffStatus,
	isTerminalHandoffStatus,
	type NonClosingHandoffEventOutcome,
	nonClosingHandoffEventSchema,
	type SelectedVersion,
	type StartHandoffCommand,
	type StartHandoffOutcome,
	selectedVersionSchema,
	startHandoffCommandSchema,
} from "./external-handoffs-model";

type PrismaTransaction = Prisma.TransactionClient;

interface HandoffRow {
	cancelReason: string | null;
	constraints: string;
	executorVisibleName: string;
	expectedOutput: string;
	goingPackageMarkdown: string;
	goingPackageProducedAt: Date;
	id: string;
	permittedGithubContext: Prisma.JsonValue;
	purpose: string;
	revision: number;
	selectedVersionManifest: Prisma.JsonValue;
	status: string;
	workId: string;
}

export async function startHandoff(
	prisma: PrismaClient,
	command: unknown
): Promise<StartHandoffOutcome> {
	const parsed = startHandoffCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		startInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
}

export async function cancelHandoff(
	prisma: PrismaClient,
	command: unknown
): Promise<CancelHandoffOutcome> {
	const parsed = cancelHandoffCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const reason = parsed.data.payload.reason.trim();
	if (reason.length === 0) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint({
		handoffId: parsed.data.payload.handoffId,
		reason,
	});
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		cancelInTransaction(tx, parsed.data, reason, commandKey, fingerprint)
	);
}

export async function applyNonClosingHandoffEvent(
	prisma: PrismaClient,
	command: unknown
): Promise<NonClosingHandoffEventOutcome> {
	const parsed = nonClosingHandoffEventSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const row = await prisma.externalExecutionHandoff.findUnique({
		where: { id: parsed.data.handoffId },
	});
	if (!row) {
		return { reason: "handoff-not-found", status: "rejected" };
	}
	const work = await getWork(prisma, row.workId);
	if (!work) {
		return { reason: "work-not-found", status: "rejected" };
	}
	const view = toView(row, work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	return {
		handoff: view,
		reason: "not-a-terminal-event",
		status: "ignored",
	};
}

export async function listHandoffsForWork(
	prisma: PrismaClient,
	workId: string
): Promise<ExternalExecutionHandoffView[]> {
	const work = await getWork(prisma, workId);
	if (!work) {
		return [];
	}
	const rows = await prisma.externalExecutionHandoff.findMany({
		orderBy: { createdAt: "asc" },
		where: { workId },
	});
	return rows.flatMap((row) => {
		const view = toView(row, work.key);
		return view ? [view] : [];
	});
}

async function startInTransaction(
	tx: PrismaTransaction,
	command: StartHandoffCommand,
	commandKey: string,
	fingerprint: string
): Promise<StartHandoffOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const replayed = storedView(existing.resultValue);
		if (!replayed) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { handoff: replayed, status: "replayed" };
	}
	const work = await tx.work.findUnique({
		where: { id: command.payload.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "work-not-found", status: "rejected" };
	}
	const selectedVersions = await resolveSelectedVersions(
		tx,
		work.projectId,
		command.payload.selectedVersions
	);
	const permittedGithubContext = (command.payload.permittedGithubContext ?? [])
		.map((item) => item.identifier.trim())
		.filter((identifier) => identifier.length > 0)
		.map((identifier) => ({ identifier }));
	const producedAt = new Date();
	const id = crypto.randomUUID();
	const markdown = renderGoingPackage({
		constraints: command.payload.constraints,
		executorVisibleName: command.payload.executorVisibleName,
		expectedOutput: command.payload.expectedOutput,
		handoffId: id,
		permittedGithubContext,
		producedAt,
		purpose: command.payload.purpose,
		selectedVersions,
		workKey: work.key,
	});
	const created = await tx.externalExecutionHandoff.create({
		data: {
			constraints: command.payload.constraints,
			executorVisibleName: command.payload.executorVisibleName,
			expectedOutput: command.payload.expectedOutput,
			goingPackageMarkdown: markdown,
			goingPackageProducedAt: producedAt,
			id,
			permittedGithubContext,
			purpose: command.payload.purpose,
			revision: 1,
			selectedVersionManifest: selectedVersions,
			status: HANDOFF_STATUS.open,
			workId: work.id,
		},
	});
	const view = toView(created, work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: created.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(view),
			targetId: created.id,
		},
	});
	return { handoff: view, status: "committed" };
}

async function cancelInTransaction(
	tx: PrismaTransaction,
	command: CancelHandoffCommand,
	reason: string,
	commandKey: string,
	fingerprint: string
): Promise<CancelHandoffOutcome> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (existing) {
		if (existing.payloadFingerprint !== fingerprint) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		const replayed = storedView(existing.resultValue);
		if (!replayed) {
			return { conflict: MUTATION_COPY.conflict, status: "conflict" };
		}
		return { handoff: replayed, status: "replayed" };
	}
	const row = await tx.externalExecutionHandoff.findUnique({
		where: { id: command.payload.handoffId },
	});
	if (!row) {
		return { reason: "handoff-not-found", status: "rejected" };
	}
	const work = await tx.work.findUnique({
		where: { id: row.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "work-not-found", status: "rejected" };
	}
	if (isTerminalHandoffStatus(row.status)) {
		return { reason: "already-terminal", status: "rejected" };
	}
	const updated = await tx.externalExecutionHandoff.update({
		data: {
			cancelReason: reason,
			revision: row.revision + 1,
			status: HANDOFF_STATUS.canceled,
		},
		where: { id: row.id },
	});
	const view = toView(updated, work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await tx.mutationReceipt.create({
		data: {
			actorId: command.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey,
			committedRevision: updated.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: fingerprint,
			resultValue: JSON.stringify(view),
			targetId: updated.id,
		},
	});
	return { handoff: view, status: "committed" };
}

function sanitizeSelectedVersions(
	versions: SelectedVersion[]
): SelectedVersion[] {
	return versions.map((version) => {
		const fields = (version.fields ?? []).filter(
			(field) => !(field.inaccessible || field.secret)
		);
		return {
			...(version.body ? { body: version.body } : {}),
			...(fields.length > 0 ? { fields } : {}),
			kind: version.kind,
			recordId: version.recordId,
			title: version.title,
			versionId: version.versionId,
		};
	});
}

async function resolveSelectedVersions(
	tx: PrismaTransaction,
	projectId: string,
	versions: SelectedVersion[]
): Promise<SelectedVersion[]> {
	const sanitized = sanitizeSelectedVersions(versions);
	const workIds = sanitized
		.filter((version) => version.kind === "Work")
		.map((version) => version.recordId);
	const liveWorks =
		workIds.length === 0
			? []
			: await tx.work.findMany({
					where: {
						id: { in: workIds },
						projectId,
					},
				});
	const liveById = new Map(
		liveWorks.filter((row) => !row.retiredIntoId).map((row) => [row.id, row])
	);
	return sanitized.flatMap((version) => {
		if (version.kind !== "Work") {
			return [version];
		}
		const live = liveById.get(version.recordId);
		if (!live) {
			return [];
		}
		const body = live.description ?? version.body;
		return [
			{
				...(body ? { body } : {}),
				...(version.fields && version.fields.length > 0
					? { fields: version.fields }
					: {}),
				kind: version.kind,
				recordId: live.id,
				title: live.title,
				versionId: String(live.revision),
			},
		];
	});
}

function renderGoingPackage(input: {
	constraints: string;
	executorVisibleName: string;
	expectedOutput: string;
	handoffId: string;
	permittedGithubContext: GithubContext[];
	producedAt: Date;
	purpose: string;
	selectedVersions: SelectedVersion[];
	workKey: string;
}): string {
	const selected = input.selectedVersions.map((version) => {
		const fieldLines = (version.fields ?? []).map(
			(field) => `${field.name}: ${field.value}`
		);
		const body = [version.body, ...fieldLines].filter(Boolean).join("\n");
		return [`### ${version.kind} ${version.title} (${version.versionId})`, body]
			.filter((part) => part.length > 0)
			.join("\n");
	});
	const github = input.permittedGithubContext.map(
		(item) => `- ${item.identifier}`
	);
	return [
		`# ${EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff}`,
		"",
		`Work: ${input.workKey}`,
		`${EXTERNAL_HANDOFFS_COPY.handoff}: ${input.handoffId}`,
		`${EXTERNAL_HANDOFFS_COPY.producedAt}: ${input.producedAt.toISOString()}`,
		EXTERNAL_HANDOFFS_COPY.sourceOfTruth,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.purpose}`,
		input.purpose,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.expectedOutput}`,
		input.expectedOutput,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.executor}`,
		input.executorVisibleName,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.constraints}`,
		input.constraints,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.selectedVersions}`,
		...selected,
		"",
		`## ${EXTERNAL_HANDOFFS_COPY.github}`,
		...github,
	].join("\n");
}

function toView(
	row: HandoffRow,
	workKey: string
): ExternalExecutionHandoffView | null {
	if (!isHandoffStatus(row.status)) {
		return null;
	}
	const selectedVersions = parseSelectedVersions(row.selectedVersionManifest);
	const permittedGithubContext = parseGithubContext(row.permittedGithubContext);
	if (!(selectedVersions && permittedGithubContext)) {
		return null;
	}
	const status: HandoffStatus = row.status;
	return {
		cancelReason: row.cancelReason,
		constraints: row.constraints,
		copy: {
			canceled: EXTERNAL_HANDOFFS_COPY.canceled,
			cancelHandoff: EXTERNAL_HANDOFFS_COPY.cancelHandoff,
			externalExecutionHandoff: EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff,
			open: EXTERNAL_HANDOFFS_COPY.open,
			reconciled: EXTERNAL_HANDOFFS_COPY.reconciled,
			resultReturned: EXTERNAL_HANDOFFS_COPY.resultReturned,
			sourceOfTruth: EXTERNAL_HANDOFFS_COPY.sourceOfTruth,
			startHandoff: EXTERNAL_HANDOFFS_COPY.startHandoff,
		},
		executorVisibleName: row.executorVisibleName,
		expectedOutput: row.expectedOutput,
		goingPackage: {
			liveSync: false,
			markdown: row.goingPackageMarkdown,
			producedAt: row.goingPackageProducedAt.toISOString(),
			publishArtifact: false,
			repositoryCopy: false,
		},
		id: row.id,
		identity: {
			independentLifecycle: false,
			independentMainRecord: false,
			ownedByWorkId: row.workId,
			searchableApartFromWork: false,
			shareableApartFromWork: false,
		},
		permittedGithubContext,
		purpose: row.purpose,
		runner: {
			ci: false,
			externalAgent: false,
			ide: false,
			repository: false,
			telemetry: false,
			terminal: false,
		},
		selectedVersions,
		separations: { ...HANDOFF_SEPARATIONS },
		status,
		terminal: isTerminalHandoffStatus(status),
		workId: row.workId,
		workKey,
	};
}

function parseSelectedVersions(
	value: Prisma.JsonValue
): SelectedVersion[] | null {
	const parsed = z.array(selectedVersionSchema).safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseGithubContext(value: Prisma.JsonValue): GithubContext[] | null {
	const parsed = z.array(githubContextSchema).safeParse(value);
	return parsed.success ? parsed.data : null;
}

function storedView(value: string): ExternalExecutionHandoffView | null {
	try {
		return externalExecutionHandoffViewSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}
