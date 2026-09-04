import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	createRelation,
	deleteRelation,
	listRelations,
	type PresentedEnd,
	type PresentedRelation,
} from "../../relations/server/relations";
import {
	RELATIONS_COPY,
	type RecordKind,
} from "../../relations/server/relations-catalog";
import {
	emptyGoalLiveSummary,
	type GoalContribution,
	type GoalLiveSummary,
	type GoalRelatedOpenItem,
	type GoalStatusMixItem,
	isStatusMixWorkType,
	optionalOutcome,
	PROJECT_GOAL_COPY,
	type ProjectGoalDetailView,
	type ProjectGoalView,
	projectGoalCatalog,
} from "./project-goals-model";

export type ProjectGoalOutcome =
	| { goal: ProjectGoalView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

export type GoalMembershipOutcome =
	| { goal: ProjectGoalDetailView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| {
			reason: "ends-not-allowed" | "target-not-found";
			status: "rejected";
	  };

interface CreateCommand {
	description: string;
	idempotencyKey: string;
	intendedOutcome?: string;
	observedOutcome?: string;
	projectId: string;
	title: string;
}

interface UpdateCommand {
	description: string;
	goalId: string;
	idempotencyKey: string;
	intendedOutcome?: string;
	observedOutcome?: string;
	title: string;
}

interface ContributeCommand {
	from: { id: string; kind: RecordKind };
	goalId: string;
	idempotencyKey: string;
}

interface RemoveContributionCommand {
	idempotencyKey: string;
	relationId: string;
}

type MutationDb = PrismaClient | Prisma.TransactionClient;

function hasProjectGoalDelegate(db: MutationDb): boolean {
	const delegate = (
		db as unknown as Record<
			string,
			{ create?: unknown; findMany?: unknown } | undefined
		>
	).projectGoal;
	if (!delegate) {
		return false;
	}
	return (
		typeof delegate.findMany === "function" &&
		typeof delegate.create === "function"
	);
}

interface ProjectGoalRow {
	description: string;
	id: string;
	intendedOutcome: string | null;
	observedOutcome: string | null;
	projectId: string;
	revision: number;
	title: string;
}

async function listGoalRows(
	db: MutationDb,
	projectId: string
): Promise<ProjectGoalRow[]> {
	if (hasProjectGoalDelegate(db)) {
		return await db.projectGoal.findMany({
			orderBy: { createdAt: "asc" },
			where: { projectId },
		});
	}
	return await db.$queryRaw<ProjectGoalRow[]>`
		SELECT
			"id",
			"projectId",
			"title",
			"description",
			"intendedOutcome",
			"observedOutcome",
			"revision"
		FROM "project_goal"
		WHERE "projectId" = ${projectId}
		ORDER BY "createdAt" ASC
	`;
}

async function getGoalRow(
	db: MutationDb,
	workspaceId: string,
	goalId: string
): Promise<ProjectGoalRow | null> {
	if (hasProjectGoalDelegate(db)) {
		return await db.projectGoal.findFirst({
			where: {
				id: goalId,
				project: { workspaceId },
			},
		});
	}
	const rows = await db.$queryRaw<ProjectGoalRow[]>`
		SELECT
			g."id",
			g."projectId",
			g."title",
			g."description",
			g."intendedOutcome",
			g."observedOutcome",
			g."revision"
		FROM "project_goal" g
		INNER JOIN "project" p ON p."id" = g."projectId"
		WHERE g."id" = ${goalId} AND p."workspaceId" = ${workspaceId}
		LIMIT 1
	`;
	const [row] = rows;
	return row ?? null;
}

async function insertGoalRow(
	db: MutationDb,
	row: ProjectGoalRow
): Promise<ProjectGoalRow> {
	if (hasProjectGoalDelegate(db)) {
		return await db.projectGoal.create({
			data: {
				description: row.description,
				id: row.id,
				intendedOutcome: row.intendedOutcome,
				observedOutcome: row.observedOutcome,
				projectId: row.projectId,
				revision: row.revision,
				title: row.title,
			},
		});
	}
	const rows = await db.$queryRaw<ProjectGoalRow[]>`
		INSERT INTO "project_goal" (
			"id",
			"projectId",
			"title",
			"description",
			"intendedOutcome",
			"observedOutcome",
			"revision",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${row.id},
			${row.projectId},
			${row.title},
			${row.description},
			${row.intendedOutcome},
			${row.observedOutcome},
			${row.revision},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		RETURNING
			"id",
			"projectId",
			"title",
			"description",
			"intendedOutcome",
			"observedOutcome",
			"revision"
	`;
	const [created] = rows;
	if (!created) {
		throw new Error("Project Goal insert returned no row");
	}
	return created;
}

async function updateGoalRow(
	db: MutationDb,
	row: ProjectGoalRow
): Promise<ProjectGoalRow> {
	if (hasProjectGoalDelegate(db)) {
		return await db.projectGoal.update({
			data: {
				description: row.description,
				intendedOutcome: row.intendedOutcome,
				observedOutcome: row.observedOutcome,
				revision: row.revision,
				title: row.title,
			},
			where: { id: row.id },
		});
	}
	const rows = await db.$queryRaw<ProjectGoalRow[]>`
		UPDATE "project_goal"
		SET
			"title" = ${row.title},
			"description" = ${row.description},
			"intendedOutcome" = ${row.intendedOutcome},
			"observedOutcome" = ${row.observedOutcome},
			"revision" = ${row.revision},
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${row.id}
		RETURNING
			"id",
			"projectId",
			"title",
			"description",
			"intendedOutcome",
			"observedOutcome",
			"revision"
	`;
	const [updated] = rows;
	if (!updated) {
		throw new Error("Project Goal update returned no row");
	}
	return updated;
}

export function createProjectGoals(input: {
	accountId: string;
	prisma: PrismaClient;
	workspaceId: string;
}) {
	return {
		catalog: () => projectGoalCatalog(),
		contributeToGoal: (command: ContributeCommand) =>
			contributeToGoal(input, command),
		create: (command: CreateCommand) => createGoal(input, command),
		get: (goalId: string) => getGoal(input, goalId),
		list: (projectId: string) => listGoals(input, projectId),
		removeContribution: (command: RemoveContributionCommand) =>
			removeContribution(input, command),
		update: (command: UpdateCommand) => updateGoal(input, command),
	};
}

async function listGoals(
	input: {
		prisma: PrismaClient;
		workspaceId: string;
	},
	projectId: string
): Promise<ProjectGoalView[]> {
	const project = await input.prisma.project.findFirst({
		where: { id: projectId, workspaceId: input.workspaceId },
	});
	if (!project) {
		return [];
	}
	const rows = await listGoalRows(input.prisma, projectId);
	return rows.map(toView);
}

async function getGoal(
	input: {
		prisma: PrismaClient;
		workspaceId: string;
	},
	goalId: string
): Promise<ProjectGoalDetailView | null> {
	const row = await getGoalRow(input.prisma, input.workspaceId, goalId);
	if (!row) {
		return null;
	}
	return await toDetailView(input.prisma, input.workspaceId, row);
}

async function createGoal(
	input: {
		accountId: string;
		prisma: PrismaClient;
		workspaceId: string;
	},
	command: CreateCommand
): Promise<ProjectGoalOutcome> {
	const title = command.title.trim();
	const description = command.description.trim();
	if (title.length === 0) {
		return {
			reason: PROJECT_GOAL_COPY.titleRequired,
			status: "invalid",
		};
	}
	if (description.length === 0) {
		return {
			reason: PROJECT_GOAL_COPY.descriptionRequired,
			status: "invalid",
		};
	}
	const intendedOutcome = optionalOutcome(command.intendedOutcome);
	const observedOutcome = optionalOutcome(command.observedOutcome);
	const payload = {
		description,
		intendedOutcome,
		observedOutcome,
		projectId: command.projectId,
		title,
	};
	return await input.prisma.$transaction(async (tx) => {
		const project = await tx.project.findFirst({
			where: { id: command.projectId, workspaceId: input.workspaceId },
		});
		if (!project) {
			return { status: "not-found" };
		}
		await lockMutation(tx, `project-goal:${command.projectId}:create`);
		const existing = await readDurableReceipt(
			tx,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return JSON.parse(existing.resultValue) as ProjectGoalOutcome;
		}
		const created = await insertGoalRow(tx, {
			description,
			id: crypto.randomUUID(),
			intendedOutcome,
			observedOutcome,
			projectId: command.projectId,
			revision: 1,
			title,
		});
		const outcome: ProjectGoalOutcome = {
			goal: toView(created),
			status: "committed",
		};
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: "project-goal-create",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: created.id,
		});
		return outcome;
	});
}

async function updateGoal(
	input: {
		accountId: string;
		prisma: PrismaClient;
		workspaceId: string;
	},
	command: UpdateCommand
): Promise<ProjectGoalOutcome> {
	const title = command.title.trim();
	const description = command.description.trim();
	if (title.length === 0) {
		return {
			reason: PROJECT_GOAL_COPY.titleRequired,
			status: "invalid",
		};
	}
	if (description.length === 0) {
		return {
			reason: PROJECT_GOAL_COPY.descriptionRequired,
			status: "invalid",
		};
	}
	const intendedOutcome = optionalOutcome(command.intendedOutcome);
	const observedOutcome = optionalOutcome(command.observedOutcome);
	const payload = {
		description,
		goalId: command.goalId,
		intendedOutcome,
		observedOutcome,
		title,
	};
	return await input.prisma.$transaction(async (tx) => {
		const row = await getGoalRow(tx, input.workspaceId, command.goalId);
		if (!row) {
			return { status: "not-found" };
		}
		await lockMutation(tx, `project-goal:${row.id}:update`);
		const existing = await readDurableReceipt(
			tx,
			command.idempotencyKey,
			payload
		);
		if (existing?.kind === "conflict") {
			return { reason: MUTATION_COPY.conflict, status: "conflict" };
		}
		if (existing?.kind === "replay") {
			return JSON.parse(existing.resultValue) as ProjectGoalOutcome;
		}
		const updated = await updateGoalRow(tx, {
			description,
			id: row.id,
			intendedOutcome,
			observedOutcome,
			projectId: row.projectId,
			revision: row.revision + 1,
			title,
		});
		const outcome: ProjectGoalOutcome = {
			goal: toView(updated),
			status: "committed",
		};
		await writeDurableReceipt(tx, {
			actorId: input.accountId,
			commandKey: command.idempotencyKey,
			kind: "project-goal-update",
			payload,
			resultValue: JSON.stringify(outcome),
			targetId: updated.id,
		});
		return outcome;
	});
}

function toView(row: {
	description: string;
	id: string;
	intendedOutcome: string | null;
	observedOutcome: string | null;
	projectId: string;
	revision: number;
	title: string;
}): ProjectGoalView {
	return {
		copy: PROJECT_GOAL_COPY,
		description: row.description,
		id: row.id,
		intendedOutcome: row.intendedOutcome,
		observedOutcome: row.observedOutcome,
		projectId: row.projectId,
		revision: row.revision,
		title: row.title,
	};
}

async function contributeToGoal(
	input: {
		accountId: string;
		prisma: PrismaClient;
		workspaceId: string;
	},
	command: ContributeCommand
): Promise<GoalMembershipOutcome> {
	const row = await getGoalRow(input.prisma, input.workspaceId, command.goalId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const memberOk = await memberInProject(
		input.prisma,
		command.from,
		row.projectId
	);
	if (
		!memberOk &&
		(command.from.kind === "Work" || command.from.kind === "Milestone")
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const existing = await input.prisma.typedRelation.findFirst({
		where: {
			fromId: command.from.id,
			fromKind: command.from.kind,
			toId: row.id,
			toKind: "Project Goal",
			type: RELATIONS_COPY.contributesToGoal,
		},
	});
	if (existing) {
		const goal = await toDetailView(input.prisma, input.workspaceId, row);
		return { goal, status: "committed" };
	}
	const linked = await createRelation(input.prisma, {
		actorId: input.accountId,
		from: command.from,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		previewAcknowledged: true,
		to: { id: row.id, kind: "Project Goal" },
		type: RELATIONS_COPY.contributesToGoal,
		viewerWorkspaceId: input.workspaceId,
	});
	if (linked.status === "conflict") {
		return { reason: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (linked.status === "rejected") {
		return {
			reason:
				linked.reason === "ends-not-allowed"
					? "ends-not-allowed"
					: "target-not-found",
			status: "rejected",
		};
	}
	const goal = await toDetailView(input.prisma, input.workspaceId, row);
	return { goal, status: "committed" };
}

async function removeContribution(
	input: {
		accountId: string;
		prisma: PrismaClient;
		workspaceId: string;
	},
	command: RemoveContributionCommand
): Promise<GoalMembershipOutcome> {
	const relation = await input.prisma.typedRelation.findUnique({
		where: { id: command.relationId },
	});
	if (
		!relation ||
		relation.type !== RELATIONS_COPY.contributesToGoal ||
		relation.toKind !== "Project Goal"
	) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const row = await getGoalRow(input.prisma, input.workspaceId, relation.toId);
	if (!row) {
		return { reason: "target-not-found", status: "rejected" };
	}
	const removed = await deleteRelation(input.prisma, {
		actorId: input.accountId,
		idempotencyKey: command.idempotencyKey,
		origin: "human",
		relationId: command.relationId,
		viewerWorkspaceId: input.workspaceId,
	});
	if (removed.status === "conflict") {
		return { reason: MUTATION_COPY.conflict, status: "conflict" };
	}
	if (removed.status === "rejected") {
		return { reason: "target-not-found", status: "rejected" };
	}
	const goal = await toDetailView(input.prisma, input.workspaceId, row);
	return { goal, status: "committed" };
}

async function memberInProject(
	db: MutationDb,
	from: { id: string; kind: RecordKind },
	projectId: string
): Promise<boolean> {
	if (from.kind === "Work") {
		const work = await db.work.findUnique({ where: { id: from.id } });
		return work?.projectId === projectId;
	}
	if (from.kind === "Milestone") {
		if (
			!("milestone" in db) ||
			typeof db.milestone?.findUnique !== "function"
		) {
			return false;
		}
		const milestone = await db.milestone.findUnique({
			where: { id: from.id },
		});
		return milestone?.projectId === projectId;
	}
	return from.kind === "Project Release";
}

async function toDetailView(
	prisma: PrismaClient,
	workspaceId: string,
	row: ProjectGoalRow
): Promise<ProjectGoalDetailView> {
	const relations = await listRelations(prisma, {
		record: { id: row.id, kind: "Project Goal" },
		viewerWorkspaceId: workspaceId,
	});
	const contributions: GoalContribution[] = [];
	const relatedOpen: GoalRelatedOpenItem[] = [];
	const mixMembers: PresentedEnd[] = [];
	for (const relation of relations) {
		const member = otherEnd(relation, row.id);
		if (relation.type === RELATIONS_COPY.contributesToGoal) {
			contributions.push({
				from: contributionFrom(member),
				id: relation.id,
				type: PROJECT_GOAL_COPY.contributesToGoal,
			});
			mixMembers.push(member);
			continue;
		}
		if (relation.type !== RELATIONS_COPY.related) {
			continue;
		}
		if (member.kind !== "Risk" && member.kind !== "Question") {
			continue;
		}
		relatedOpen.push({
			contributes: false,
			id: member.id,
			kind: member.kind,
			openSourceRecord: member.status === "resolved",
			title: member.status === "resolved" ? member.title : undefined,
		});
	}
	const mixItems = await Promise.all(
		mixMembers.map((member) => statusMixItem(prisma, member))
	);
	const statusMix = mixItems.filter(
		(item): item is GoalStatusMixItem => item !== null
	);
	const liveSummary: GoalLiveSummary = {
		...emptyGoalLiveSummary(),
		relatedOpen,
		statusMix,
	};
	return {
		...toView(row),
		contributions,
		liveSummary,
	};
}

function otherEnd(relation: PresentedRelation, goalId: string): PresentedEnd {
	return relation.to.id === goalId ? relation.from : relation.to;
}

function contributionFrom(member: PresentedEnd): GoalContribution["from"] {
	if (member.status === "broken") {
		return {
			id: member.id,
			kind: member.kind,
			reason: member.reason,
			status: "broken",
		};
	}
	return {
		id: member.id,
		kind: member.kind,
		status: "resolved",
		title: member.title,
	};
}

async function statusMixItem(
	prisma: PrismaClient,
	member: PresentedEnd
): Promise<GoalStatusMixItem | null> {
	if (member.status !== "resolved") {
		return null;
	}
	if (member.kind === "Work") {
		const work = await prisma.work.findUnique({ where: { id: member.id } });
		if (!(work && isStatusMixWorkType(work.type))) {
			return null;
		}
		return {
			id: work.id,
			kind: "Work",
			openSourceRecord: true,
			status: work.status,
			title: work.title,
			workType: work.type,
		};
	}
	if (member.kind === "Milestone") {
		if (
			!("milestone" in prisma) ||
			typeof prisma.milestone?.findUnique !== "function"
		) {
			return null;
		}
		const milestone = await prisma.milestone.findUnique({
			where: { id: member.id },
		});
		if (!milestone) {
			return null;
		}
		return {
			id: milestone.id,
			kind: "Milestone",
			openSourceRecord: true,
			status: milestone.status,
			title: milestone.title,
		};
	}
	return null;
}
