import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	advisoryKeys,
	HUMAN_ORIGIN,
	isRecord,
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	ALWAYS_ON_SURFACES,
	appliedStructureFor,
	type CreateProjectCommand,
	type CreateProjectPayload,
	createProjectCommandSchema,
	type DismissFirstOpenExplanationCommand,
	dismissFirstOpenExplanationCommandSchema,
	firstOpenExplanationFor,
	isProjectAreaName,
	isStarterConfiguration,
	normalizeShortCode,
	optionalDate,
	optionalText,
	PROJECT_AREAS,
	PROJECT_LIFECYCLE,
	PROTECTED_WORK_STATUSES,
	type ProjectAreaName,
	type ProjectShellOutcome,
	type ProjectView,
	projectViewSchema,
	STAGE_STATE,
	type STARTER_CONFIGURATIONS,
	suggestAvailableShortCode,
	type UpdateShortCodeCommand,
	updateShortCodeCommandSchema,
} from "./project-shell-model";

type PrismaTransaction = Prisma.TransactionClient;

interface ProjectRow {
	areaSettings: Array<{
		enabled: boolean;
		name: string;
		pinOrder: number | null;
		pinned: boolean;
	}>;
	firstOpenExplanationDismissed: boolean;
	hasWork: boolean;
	id: string;
	lifecycleStatus: string;
	logoFileName: string | null;
	name: string;
	problem: string | null;
	purpose: string | null;
	revision: number;
	scope: string | null;
	shortCode: string;
	stages: Array<{ name: string; sortOrder: number }>;
	starterConfiguration: string;
	targetDate: string | null;
	workStatuses: Array<{ semantic: string; sortOrder: number }>;
	workspaceId: string;
	workViews: Array<{ name: string; sortOrder: number }>;
}

const PROJECT_STRUCTURE_INCLUDE = {
	areaSettings: true,
	stages: true,
	workStatuses: true,
	workViews: true,
} as const;

export async function createProject(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectShellOutcome> {
	const parsed = parseCreateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint(parsed.command.payload);
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		createInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function updateShortCode(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectShellOutcome> {
	const parsed = parseUpdateCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		shortCode: parsed.command.shortCode,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		updateInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function dismissFirstOpenExplanation(
	prisma: PrismaClient,
	command: unknown
): Promise<ProjectShellOutcome> {
	const parsed = parseDismissCommand(command);
	if (parsed.status !== "ok") {
		return parsed.outcome;
	}
	const fingerprint = payloadFingerprint({
		dismiss: true,
		projectId: parsed.command.projectId,
	});
	const commandKey = commandKeyFor(
		parsed.command.actorId,
		parsed.command.idempotencyKey
	);
	return await prisma.$transaction((tx) =>
		dismissInTransaction(tx, parsed.command, commandKey, fingerprint)
	);
}

export async function suggestShortCode(
	prisma: PrismaClient,
	workspaceId: string,
	name: string
): Promise<string> {
	const reserved = await reservedCodes(prisma, workspaceId);
	return suggestAvailableShortCode(name, reserved);
}

export async function getProject(
	prisma: PrismaClient,
	projectId: string
): Promise<ProjectView | null> {
	const row = await prisma.project.findUnique({
		include: PROJECT_STRUCTURE_INCLUDE,
		where: { id: projectId },
	});
	if (!row) {
		return null;
	}
	return toView(await hydrateStructure(prisma, row));
}

export async function listProjects(
	prisma: PrismaClient,
	workspaceId: string
): Promise<ProjectView[]> {
	const rows = await prisma.project.findMany({
		include: PROJECT_STRUCTURE_INCLUDE,
		orderBy: { createdAt: "asc" },
		where: { workspaceId },
	});
	return await Promise.all(
		rows.map(async (row) => toView(await hydrateStructure(prisma, row)))
	);
}

export async function recordWorkExists(
	prisma: PrismaClient,
	projectId: string
): Promise<ProjectView | null> {
	return await prisma.$transaction(async (tx) => {
		await lockProject(tx, projectId);
		const current = await loadProject(tx, projectId);
		if (!current) {
			return null;
		}
		if (current.hasWork) {
			return toView(current);
		}
		const updated = await tx.project.update({
			data: {
				hasWork: true,
				revision: current.revision + 1,
			},
			include: PROJECT_STRUCTURE_INCLUDE,
			where: { id: projectId },
		});
		return toView(updated);
	});
}

export async function permanentlyDeleteProject(
	prisma: PrismaClient,
	projectId: string
): Promise<void> {
	await prisma.$transaction(async (tx) => {
		await tx.workspaceShortCodeReservation.updateMany({
			data: { projectId: null },
			where: { projectId },
		});
		await tx.project.deleteMany({ where: { id: projectId } });
	});
}

function parseCreateCommand(
	command: unknown
):
	| { command: CreateProjectCommand; status: "ok" }
	| { outcome: ProjectShellOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = createProjectCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseUpdateCommand(
	command: unknown
):
	| { command: UpdateShortCodeCommand; status: "ok" }
	| { outcome: ProjectShellOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = updateShortCodeCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

function parseDismissCommand(
	command: unknown
):
	| { command: DismissFirstOpenExplanationCommand; status: "ok" }
	| { outcome: ProjectShellOutcome; status: "rejected" } {
	if (!isRecord(command)) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		typeof command.idempotencyKey !== "string" ||
		command.idempotencyKey.length === 0
	) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	const parsed = dismissFirstOpenExplanationCommandSchema.safeParse(command);
	if (!parsed.success) {
		return {
			outcome: { reason: "missing-idempotency-key", status: "rejected" },
			status: "rejected",
		};
	}
	return { command: parsed.data, status: "ok" };
}

async function createInTransaction(
	tx: PrismaTransaction,
	command: CreateProjectCommand,
	commandKey: string,
	fingerprint: string
): Promise<ProjectShellOutcome> {
	await lockWorkspace(tx, command.workspaceId);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const validated = validateCreatePayload(command.payload);
	if (validated.status !== "ok") {
		return validated.outcome;
	}
	const reserved = await reservedCodes(tx, command.workspaceId);
	const shortCode = resolveShortCode(
		validated.shortCode,
		validated.name,
		reserved
	);
	if (shortCode.status !== "ok") {
		return shortCode.outcome;
	}
	const projectId = crypto.randomUUID();
	const claimed = await claimShortCode(
		tx,
		command.workspaceId,
		projectId,
		shortCode.value
	);
	if (claimed === "taken") {
		return { reason: "short-code-taken", status: "rejected" };
	}
	await tx.project.create({
		data: {
			firstOpenExplanationDismissed: false,
			hasWork: false,
			id: projectId,
			lifecycleStatus: PROJECT_LIFECYCLE.active,
			logoFileName: validated.logoFileName,
			name: validated.name,
			problem: validated.problem,
			purpose: validated.purpose,
			revision: 1,
			scope: validated.scope,
			shortCode: shortCode.value,
			starterConfiguration: validated.starterConfiguration,
			targetDate: validated.targetDate,
			workspaceId: command.workspaceId,
		},
	});
	await persistAppliedStructure(tx, projectId, validated.starterConfiguration);
	const row = await loadProject(tx, projectId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = toView(row);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		project,
	});
	return { project, status: "committed" };
}

async function updateInTransaction(
	tx: PrismaTransaction,
	command: UpdateShortCodeCommand,
	commandKey: string,
	fingerprint: string
): Promise<ProjectShellOutcome> {
	const current = await tx.project.findUnique({
		where: { id: command.projectId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, current.workspaceId);
	await lockProject(tx, current.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.project.findUnique({ where: { id: current.id } });
	if (!locked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		const currentView = await loadProject(tx, locked.id);
		if (!currentView) {
			return { reason: "target-not-found", status: "rejected" };
		}
		return {
			current: toView(currentView),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	if (locked.hasWork) {
		return { reason: "short-code-locked", status: "rejected" };
	}
	const shortCode = normalizeShortCode(command.shortCode);
	if (!shortCode) {
		return { reason: "short-code-invalid", status: "rejected" };
	}
	if (shortCode !== locked.shortCode) {
		const claimed = await claimShortCode(
			tx,
			locked.workspaceId,
			locked.id,
			shortCode
		);
		if (claimed === "taken") {
			return { reason: "short-code-taken", status: "rejected" };
		}
	}
	await tx.project.update({
		data: {
			revision: locked.revision + 1,
			shortCode,
		},
		where: { id: locked.id },
	});
	const updated = await loadProject(tx, locked.id);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		project,
	});
	return { project, status: "committed" };
}

async function dismissInTransaction(
	tx: PrismaTransaction,
	command: DismissFirstOpenExplanationCommand,
	commandKey: string,
	fingerprint: string
): Promise<ProjectShellOutcome> {
	const current = await tx.project.findUnique({
		where: { id: command.projectId },
	});
	if (!current) {
		return { reason: "target-not-found", status: "rejected" };
	}
	await lockWorkspace(tx, current.workspaceId);
	await lockProject(tx, current.id);
	const replayed = await replayOrConflict(tx, commandKey, fingerprint);
	if (replayed) {
		return replayed;
	}
	const locked = await tx.project.findUnique({ where: { id: current.id } });
	if (!locked) {
		return { reason: "target-not-found", status: "rejected" };
	}
	if (locked.revision !== command.baseRevision) {
		const currentView = await loadProject(tx, locked.id);
		if (!currentView) {
			return { reason: "target-not-found", status: "rejected" };
		}
		return {
			current: toView(currentView),
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		};
	}
	await tx.project.update({
		data: {
			firstOpenExplanationDismissed: true,
			revision: locked.revision + 1,
		},
		where: { id: locked.id },
	});
	const updated = await loadProject(tx, locked.id);
	if (!updated) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const project = toView(updated);
	await writeReceipt(tx, {
		actorId: command.actorId,
		commandKey,
		fingerprint,
		project,
	});
	return { project, status: "committed" };
}

function validateCreatePayload(payload: CreateProjectPayload):
	| {
			logoFileName: string | null;
			name: string;
			problem: string | null;
			purpose: string | null;
			scope: string | null;
			shortCode: string | null;
			starterConfiguration: (typeof STARTER_CONFIGURATIONS)[number];
			status: "ok";
			targetDate: string | null;
	  }
	| { outcome: ProjectShellOutcome; status: "rejected" } {
	const name = optionalText(payload.name);
	if (!name) {
		return {
			outcome: { reason: "missing-project-name", status: "rejected" },
			status: "rejected",
		};
	}
	if (
		payload.starterConfiguration === undefined ||
		payload.starterConfiguration === ""
	) {
		return {
			outcome: {
				reason: "missing-starter-configuration",
				status: "rejected",
			},
			status: "rejected",
		};
	}
	if (!isStarterConfiguration(payload.starterConfiguration)) {
		return {
			outcome: {
				reason: "unknown-starter-configuration",
				status: "rejected",
			},
			status: "rejected",
		};
	}
	let shortCode: string | null = null;
	if (payload.shortCode !== undefined && payload.shortCode.trim().length > 0) {
		shortCode = normalizeShortCode(payload.shortCode);
		if (!shortCode) {
			return {
				outcome: { reason: "short-code-invalid", status: "rejected" },
				status: "rejected",
			};
		}
	}
	return {
		logoFileName: optionalText(payload.logoFileName),
		name,
		problem: optionalText(payload.problem),
		purpose: optionalText(payload.purpose),
		scope: optionalText(payload.scope),
		shortCode,
		starterConfiguration: payload.starterConfiguration,
		status: "ok",
		targetDate: optionalDate(payload.targetDate),
	};
}

function resolveShortCode(
	requested: string | null,
	name: string,
	reserved: ReadonlySet<string>
):
	| { status: "ok"; value: string }
	| { outcome: ProjectShellOutcome; status: "rejected" } {
	if (requested) {
		if (reserved.has(requested)) {
			return {
				outcome: { reason: "short-code-taken", status: "rejected" },
				status: "rejected",
			};
		}
		return { status: "ok", value: requested };
	}
	return {
		status: "ok",
		value: suggestAvailableShortCode(name, reserved),
	};
}

async function replayOrConflict(
	tx: PrismaTransaction,
	commandKey: string,
	fingerprint: string
): Promise<ProjectShellOutcome | null> {
	const existing = await tx.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== fingerprint) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	const live = await loadProject(tx, existing.targetId);
	if (live) {
		return { project: toView(live), status: "replayed" };
	}
	const stored = storedProject(existing.resultValue);
	if (!stored) {
		return { conflict: MUTATION_COPY.conflict, status: "conflict" };
	}
	return { project: stored, status: "replayed" };
}

async function writeReceipt(
	tx: PrismaTransaction,
	input: {
		actorId: string;
		commandKey: string;
		fingerprint: string;
		project: ProjectView;
	}
): Promise<void> {
	await tx.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.project.revision,
			id: crypto.randomUUID(),
			origin: HUMAN_ORIGIN,
			payloadFingerprint: input.fingerprint,
			resultValue: JSON.stringify(input.project),
			targetId: input.project.id,
		},
	});
}

async function claimShortCode(
	tx: PrismaTransaction,
	workspaceId: string,
	projectId: string,
	shortCode: string
): Promise<"ok" | "taken"> {
	const existing = await tx.workspaceShortCodeReservation.findUnique({
		where: {
			workspaceId_shortCode: { shortCode, workspaceId },
		},
	});
	if (existing) {
		return existing.projectId === projectId ? "ok" : "taken";
	}
	await tx.workspaceShortCodeReservation.create({
		data: {
			id: crypto.randomUUID(),
			projectId,
			shortCode,
			workspaceId,
		},
	});
	return "ok";
}

async function reservedCodes(
	db: PrismaClient | PrismaTransaction,
	workspaceId: string
): Promise<Set<string>> {
	const rows = await db.workspaceShortCodeReservation.findMany({
		select: { shortCode: true },
		where: { workspaceId },
	});
	return new Set(rows.map((row) => row.shortCode));
}

async function lockWorkspace(
	tx: PrismaTransaction,
	workspaceId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:workspace:${workspaceId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

async function lockProject(
	tx: PrismaTransaction,
	projectId: string
): Promise<void> {
	const [lockA, lockB] = advisoryKeys(`project-shell:project:${projectId}`);
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockA}, ${lockB})`;
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

async function loadProject(
	db: PrismaClient | PrismaTransaction,
	projectId: string
): Promise<ProjectRow | null> {
	return await db.project.findUnique({
		include: PROJECT_STRUCTURE_INCLUDE,
		where: { id: projectId },
	});
}

async function hydrateStructure(
	prisma: PrismaClient,
	row: ProjectRow
): Promise<ProjectRow> {
	if (row.workStatuses.length > 0) {
		return row;
	}
	if (!isStarterConfiguration(row.starterConfiguration)) {
		throw new Error("unknown-starter-configuration");
	}
	return await prisma.$transaction(async (tx) => {
		await lockProject(tx, row.id);
		const locked = await loadProject(tx, row.id);
		if (!locked) {
			throw new Error("target-not-found");
		}
		if (locked.workStatuses.length > 0) {
			return locked;
		}
		if (!isStarterConfiguration(locked.starterConfiguration)) {
			throw new Error("unknown-starter-configuration");
		}
		await persistAppliedStructure(tx, locked.id, locked.starterConfiguration);
		const hydrated = await loadProject(tx, locked.id);
		if (!hydrated) {
			throw new Error("target-not-found");
		}
		return hydrated;
	});
}

async function persistAppliedStructure(
	tx: PrismaTransaction,
	projectId: string,
	starterConfiguration: (typeof STARTER_CONFIGURATIONS)[number]
): Promise<void> {
	const applied = appliedStructureFor(starterConfiguration);
	const enabled = new Set<ProjectAreaName>(applied.enabledAreas);
	const pinOrder = new Map(
		applied.pinnedAreas.map((name, index) => [name, index])
	);
	if (applied.stages.length > 0) {
		await tx.projectStage.createMany({
			data: applied.stages.map((name, sortOrder) => ({
				id: crypto.randomUUID(),
				name,
				projectId,
				sortOrder,
				state: STAGE_STATE.notPlanned,
			})),
		});
	}
	await tx.projectAreaSetting.createMany({
		data: PROJECT_AREAS.map((name) => ({
			enabled: enabled.has(name),
			id: crypto.randomUUID(),
			name,
			pinned: pinOrder.has(name),
			pinOrder: pinOrder.get(name) ?? null,
			projectId,
		})),
	});
	await tx.projectWorkView.createMany({
		data: applied.workViews.map((name, sortOrder) => ({
			id: crypto.randomUUID(),
			name,
			projectId,
			sortOrder,
		})),
	});
	await tx.projectWorkStatus.createMany({
		data: PROTECTED_WORK_STATUSES.map((semantic, sortOrder) => ({
			id: crypto.randomUUID(),
			label: semantic,
			projectId,
			semantic,
			sortOrder,
		})),
	});
}

function toView(row: ProjectRow): ProjectView {
	if (!isStarterConfiguration(row.starterConfiguration)) {
		throw new Error("unknown-starter-configuration");
	}
	const settings = new Map(
		row.areaSettings.flatMap((area) =>
			isProjectAreaName(area.name) ? [[area.name, area] as const] : []
		)
	);
	const allToolsAreas = PROJECT_AREAS.map((name) => {
		const setting = settings.get(name);
		return {
			enabled: setting?.enabled ?? false,
			name,
			pinned: setting?.pinned ?? false,
		};
	});
	const enabledAreas = allToolsAreas
		.filter((area) => area.enabled)
		.map((area) => area.name);
	const pinnedAreas = [...row.areaSettings]
		.filter((area) => area.pinned && isProjectAreaName(area.name))
		.sort((left, right) => (left.pinOrder ?? 0) - (right.pinOrder ?? 0))
		.map((area) => area.name as ProjectAreaName);
	const statuses = [...row.workStatuses]
		.sort((left, right) => left.sortOrder - right.sortOrder)
		.map((status) => status.semantic);
	if (
		statuses[0] !== "Not Started" ||
		statuses[1] !== "In Progress" ||
		statuses[2] !== "Blocked" ||
		statuses[3] !== "Closed"
	) {
		throw new Error("protected-work-statuses");
	}
	return {
		allToolsAreas,
		alwaysOnSurfaces: [...ALWAYS_ON_SURFACES],
		enabledAreas,
		firstOpenExplanation: row.firstOpenExplanationDismissed
			? null
			: firstOpenExplanationFor(row.starterConfiguration),
		firstOpenExplanationVisible: !row.firstOpenExplanationDismissed,
		id: row.id,
		lifecycleStatus: PROJECT_LIFECYCLE.active,
		logoFileName: row.logoFileName,
		name: row.name,
		pinnedAreas,
		problem: row.problem,
		purpose: row.purpose,
		revision: row.revision,
		scope: row.scope,
		shortCode: row.shortCode,
		shortCodeLocked: row.hasWork,
		stages: [...row.stages]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((stage) => stage.name),
		starterConfiguration: row.starterConfiguration,
		targetDate: row.targetDate,
		workContextCardLayouts: [],
		workStatuses: ["Not Started", "In Progress", "Blocked", "Closed"],
		workspaceId: row.workspaceId,
		workViews: [...row.workViews]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((view) => view.name),
	};
}

function storedProject(text: string): ProjectView | null {
	try {
		const parsed: unknown = JSON.parse(text);
		const result = projectViewSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}
