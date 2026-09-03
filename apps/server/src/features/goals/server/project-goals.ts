import type { PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	optionalOutcome,
	PROJECT_GOAL_COPY,
	type ProjectGoalView,
	projectGoalCatalog,
} from "./project-goals-model";

export type ProjectGoalOutcome =
	| { goal: ProjectGoalView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

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

export function createProjectGoals(input: {
	accountId: string;
	prisma: PrismaClient;
	workspaceId: string;
}) {
	return {
		catalog: () => projectGoalCatalog(),
		create: (command: CreateCommand) => createGoal(input, command),
		get: (goalId: string) => getGoal(input, goalId),
		list: (projectId: string) => listGoals(input, projectId),
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
	const rows = await input.prisma.projectGoal.findMany({
		orderBy: { createdAt: "asc" },
		where: { projectId },
	});
	return rows.map(toView);
}

async function getGoal(
	input: {
		prisma: PrismaClient;
		workspaceId: string;
	},
	goalId: string
): Promise<ProjectGoalView | null> {
	const row = await input.prisma.projectGoal.findFirst({
		where: {
			id: goalId,
			project: { workspaceId: input.workspaceId },
		},
	});
	return row ? toView(row) : null;
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
		const created = await tx.projectGoal.create({
			data: {
				description,
				id: crypto.randomUUID(),
				intendedOutcome,
				observedOutcome,
				projectId: command.projectId,
				revision: 1,
				title,
			},
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
		const row = await tx.projectGoal.findFirst({
			where: {
				id: command.goalId,
				project: { workspaceId: input.workspaceId },
			},
		});
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
		const updated = await tx.projectGoal.update({
			data: {
				description,
				intendedOutcome,
				observedOutcome,
				revision: row.revision + 1,
				title,
			},
			where: { id: row.id },
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
