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
	EXTERNAL_HANDOFFS_COPY,
	type ExternalExecutionHandoffView,
	externalExecutionHandoffViewSchema,
	type GithubContext,
	githubContextSchema,
	HANDOFF_HISTORY_KIND,
	HANDOFF_STATUS,
	type HandoffHistoryEntry,
	type ProduceGoingPackageCommand,
	type ProduceGoingPackageOutcome,
	produceGoingPackageCommandSchema,
	type SelectedVersion,
	type StartHandoffCommand,
	type StartHandoffOutcome,
	selectedVersionSchema,
	startHandoffCommandSchema,
} from "./external-handoffs-model";

type PrismaTransaction = Prisma.TransactionClient;

interface PackageRow {
	markdown: string;
	permittedGithubContext: Prisma.JsonValue;
	producedAt: Date;
	selectedVersionManifest: Prisma.JsonValue;
	version: number;
}

interface HandoffRow {
	constraints: string;
	executorVisibleName: string;
	expectedOutput: string;
	goingPackageMarkdown: string;
	goingPackageProducedAt: Date;
	goingPackages?: PackageRow[];
	id: string;
	permittedGithubContext: Prisma.JsonValue;
	purpose: string;
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

export async function produceGoingPackage(
	prisma: PrismaClient,
	command: unknown
): Promise<ProduceGoingPackageOutcome> {
	const parsed = produceGoingPackageCommandSchema.safeParse(command);
	if (!parsed.success) {
		return { reason: "invalid-command", status: "rejected" };
	}
	const fingerprint = payloadFingerprint(parsed.data.payload);
	const commandKey = commandKeyFor(
		parsed.data.actorId,
		parsed.data.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		produceInTransaction(tx, parsed.data, commandKey, fingerprint)
	);
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
	const packagesByHandoff = await loadGoingPackagesByHandoff(
		prisma,
		rows.map((row) => row.id)
	);
	return rows.flatMap((row) => {
		const view = toView(
			{ ...row, goingPackages: packagesByHandoff.get(row.id) ?? [] },
			work.key
		);
		return view ? [view] : [];
	});
}

export async function listHandoffHistoryForWork(
	prisma: PrismaClient,
	workId: string
): Promise<HandoffHistoryEntry[]> {
	const work = await getWork(prisma, workId);
	if (!work) {
		return [];
	}
	if (!hasHandoffEventDelegate(prisma)) {
		return [];
	}
	const rows = await prisma.externalExecutionHandoffEvent.findMany({
		orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
		where: { workId },
	});
	return rows.flatMap((row) => {
		const entry = toHistoryEntry(row);
		return entry ? [entry] : [];
	});
}

async function startInTransaction(
	tx: PrismaTransaction,
	command: StartHandoffCommand,
	commandKey: string,
	fingerprint: string
): Promise<StartHandoffOutcome> {
	const existing = await replayReceipt(tx, commandKey, fingerprint);
	if (existing) {
		return existing;
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
	const permittedGithubContext = normalizeGithubContext(
		command.payload.permittedGithubContext
	);
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
	await persistPackageVersion(tx, {
		handoffId: created.id,
		markdown,
		permittedGithubContext,
		producedAt,
		selectedVersions,
		version: 1,
	});
	await persistHistoryEvent(tx, {
		actorId: command.actorId,
		handoffId: created.id,
		kind: HANDOFF_HISTORY_KIND.started,
		occurredAt: producedAt,
		packageVersion: null,
		workId: work.id,
	});
	await persistHistoryEvent(tx, {
		actorId: command.actorId,
		handoffId: created.id,
		kind: HANDOFF_HISTORY_KIND.packageExported,
		occurredAt: producedAt,
		packageVersion: 1,
		workId: work.id,
	});
	const view = toView(
		{
			...created,
			goingPackages: [
				{
					markdown,
					permittedGithubContext,
					producedAt,
					selectedVersionManifest: selectedVersions,
					version: 1,
				},
			],
		},
		work.key
	);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		committedRevision: created.revision,
		fingerprint,
		targetId: created.id,
		view,
	});
	return { handoff: view, status: "committed" };
}

async function produceInTransaction(
	tx: PrismaTransaction,
	command: ProduceGoingPackageCommand,
	commandKey: string,
	fingerprint: string
): Promise<ProduceGoingPackageOutcome> {
	const existing = await replayReceipt(tx, commandKey, fingerprint);
	if (existing) {
		return existing;
	}
	const handoff = await tx.externalExecutionHandoff.findUnique({
		where: { id: command.payload.handoffId },
	});
	if (!handoff || handoff.workId !== command.payload.workId) {
		return { reason: "handoff-not-found", status: "rejected" };
	}
	const work = await tx.work.findUnique({
		where: { id: handoff.workId },
	});
	if (!work || work.retiredIntoId) {
		return { reason: "work-not-found", status: "rejected" };
	}
	const selectedVersions = await resolveSelectedVersions(
		tx,
		work.projectId,
		command.payload.selectedVersions
	);
	const permittedGithubContext = normalizeGithubContext(
		command.payload.permittedGithubContext
	);
	const existingPackages = await loadGoingPackages(tx, handoff.id);
	const producedAt = new Date();
	const version =
		existingPackages.reduce(
			(latest, pack) => Math.max(latest, pack.version),
			0
		) + 1;
	const markdown = renderGoingPackage({
		constraints: handoff.constraints,
		executorVisibleName: handoff.executorVisibleName,
		expectedOutput: handoff.expectedOutput,
		handoffId: handoff.id,
		permittedGithubContext,
		producedAt,
		purpose: handoff.purpose,
		selectedVersions,
		workKey: work.key,
	});
	const nextRevision = handoff.revision + 1;
	const updated = await tx.externalExecutionHandoff.update({
		data: {
			goingPackageMarkdown: markdown,
			goingPackageProducedAt: producedAt,
			permittedGithubContext,
			revision: nextRevision,
			selectedVersionManifest: selectedVersions,
		},
		where: { id: handoff.id },
	});
	await persistPackageVersion(tx, {
		handoffId: handoff.id,
		markdown,
		permittedGithubContext,
		producedAt,
		selectedVersions,
		version,
	});
	await persistHistoryEvent(tx, {
		actorId: command.actorId,
		handoffId: handoff.id,
		kind: HANDOFF_HISTORY_KIND.packageExported,
		occurredAt: producedAt,
		packageVersion: version,
		workId: work.id,
	});
	const packages = [
		...existingPackages,
		{
			markdown,
			permittedGithubContext,
			producedAt,
			selectedVersionManifest: selectedVersions,
			version,
		},
	];
	const view = toView({ ...updated, goingPackages: packages }, work.key);
	if (!view) {
		return { reason: "invalid-handoff", status: "rejected" };
	}
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		committedRevision: nextRevision,
		fingerprint,
		targetId: handoff.id,
		view,
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
	if (row.status !== HANDOFF_STATUS.open) {
		return null;
	}
	const selectedVersions = parseSelectedVersions(row.selectedVersionManifest);
	const permittedGithubContext = parseGithubContext(row.permittedGithubContext);
	if (!(selectedVersions && permittedGithubContext)) {
		return null;
	}
	const goingPackageVersions = packageViews(row);
	const latest = goingPackageVersions.at(-1);
	if (!latest) {
		return null;
	}
	return {
		constraints: row.constraints,
		copy: {
			externalExecutionHandoff: EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff,
			open: EXTERNAL_HANDOFFS_COPY.open,
			sourceOfTruth: EXTERNAL_HANDOFFS_COPY.sourceOfTruth,
			startHandoff: EXTERNAL_HANDOFFS_COPY.startHandoff,
		},
		executorVisibleName: row.executorVisibleName,
		expectedOutput: row.expectedOutput,
		goingPackage: latest,
		goingPackageVersions,
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
		status: HANDOFF_STATUS.open,
		workId: row.workId,
		workKey,
	};
}

function packageViews(
	row: HandoffRow
): ExternalExecutionHandoffView["goingPackageVersions"] {
	const stored = row.goingPackages ?? [];
	if (stored.length === 0) {
		return [
			{
				liveSync: false,
				markdown: row.goingPackageMarkdown,
				producedAt: row.goingPackageProducedAt.toISOString(),
				publishArtifact: false,
				repositoryCopy: false,
				version: 1,
			},
		];
	}
	return stored.map((pack) => ({
		liveSync: false,
		markdown: pack.markdown,
		producedAt: pack.producedAt.toISOString(),
		publishArtifact: false,
		repositoryCopy: false,
		version: pack.version,
	}));
}

function toHistoryEntry(row: {
	actorId: string;
	actorType: string;
	handoffId: string;
	id: string;
	kind: string;
	occurredAt: Date;
	packageVersion: number | null;
	workId: string;
}): HandoffHistoryEntry | null {
	if (
		row.kind !== HANDOFF_HISTORY_KIND.started &&
		row.kind !== HANDOFF_HISTORY_KIND.packageExported
	) {
		return null;
	}
	if (row.actorType !== MUTATION_ACTOR.user) {
		return null;
	}
	return {
		actorId: row.actorId,
		actorType: MUTATION_ACTOR.user,
		copy: {
			goingPackage: EXTERNAL_HANDOFFS_COPY.goingPackage,
			startHandoff: EXTERNAL_HANDOFFS_COPY.startHandoff,
		},
		handoffId: row.handoffId,
		id: row.id,
		kind: row.kind,
		occurredAt: row.occurredAt.toISOString(),
		packageVersion: row.packageVersion,
		workId: row.workId,
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

function normalizeGithubContext(
	items: GithubContext[] | undefined
): GithubContext[] {
	return (items ?? [])
		.map((item) => item.identifier.trim())
		.filter((identifier) => identifier.length > 0)
		.map((identifier) => ({ identifier }));
}

async function replayReceipt(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<StartHandoffOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const replayed = storedView(existing.resultValue);
	if (!replayed) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { handoff: replayed, status: "replayed" };
}

function prismaDelegates(prisma: PrismaClient | PrismaTransaction): {
	externalExecutionGoingPackage?: { create: unknown; findMany: unknown };
	externalExecutionHandoffEvent?: { create: unknown; findMany: unknown };
} {
	return prisma as {
		externalExecutionGoingPackage?: { create: unknown; findMany: unknown };
		externalExecutionHandoffEvent?: { create: unknown; findMany: unknown };
	};
}

function hasGoingPackageDelegate(
	prisma: PrismaClient | PrismaTransaction
): boolean {
	const { externalExecutionGoingPackage } = prismaDelegates(prisma);
	return typeof externalExecutionGoingPackage?.findMany === "function";
}

function hasHandoffEventDelegate(
	prisma: PrismaClient | PrismaTransaction
): boolean {
	const { externalExecutionHandoffEvent } = prismaDelegates(prisma);
	return typeof externalExecutionHandoffEvent?.findMany === "function";
}

async function loadGoingPackages(
	prisma: PrismaClient | PrismaTransaction,
	handoffId: string
): Promise<PackageRow[]> {
	if (!hasGoingPackageDelegate(prisma)) {
		return [];
	}
	return await prisma.externalExecutionGoingPackage.findMany({
		orderBy: { version: "asc" },
		where: { handoffId },
	});
}

async function loadGoingPackagesByHandoff(
	prisma: PrismaClient | PrismaTransaction,
	handoffIds: string[]
): Promise<Map<string, PackageRow[]>> {
	const grouped = new Map<string, PackageRow[]>();
	if (handoffIds.length === 0 || !hasGoingPackageDelegate(prisma)) {
		return grouped;
	}
	const rows = await prisma.externalExecutionGoingPackage.findMany({
		orderBy: { version: "asc" },
		where: { handoffId: { in: handoffIds } },
	});
	for (const row of rows) {
		const current = grouped.get(row.handoffId) ?? [];
		current.push(row);
		grouped.set(row.handoffId, current);
	}
	return grouped;
}

async function persistPackageVersion(
	tx: PrismaTransaction,
	input: {
		handoffId: string;
		markdown: string;
		permittedGithubContext: GithubContext[];
		producedAt: Date;
		selectedVersions: SelectedVersion[];
		version: number;
	}
): Promise<void> {
	if (!hasGoingPackageDelegate(tx)) {
		return;
	}
	await tx.externalExecutionGoingPackage.create({
		data: {
			handoffId: input.handoffId,
			id: crypto.randomUUID(),
			markdown: input.markdown,
			permittedGithubContext: input.permittedGithubContext,
			producedAt: input.producedAt,
			selectedVersionManifest: input.selectedVersions,
			version: input.version,
		},
	});
}

async function persistHistoryEvent(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		handoffId: string;
		kind: (typeof HANDOFF_HISTORY_KIND)[keyof typeof HANDOFF_HISTORY_KIND];
		occurredAt: Date;
		packageVersion: number | null;
		workId: string;
	}
): Promise<void> {
	if (!hasHandoffEventDelegate(tx)) {
		return;
	}
	await tx.externalExecutionHandoffEvent.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			handoffId: input.handoffId,
			id: crypto.randomUUID(),
			kind: input.kind,
			occurredAt: input.occurredAt,
			packageVersion: input.packageVersion,
			workId: input.workId,
		},
	});
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		committedRevision: number;
		fingerprint: string;
		targetId: string;
		view: ExternalExecutionHandoffView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.committedRevision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.view),
			targetId: input.targetId,
		},
	});
}
