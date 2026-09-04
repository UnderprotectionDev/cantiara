import type { Prisma, PrismaClient } from "@cantiara/db";

import {
	lockMutation,
	readDurableReceipt,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import {
	FAVORITE_SOURCE_TYPE,
	FAVORITES_COPY,
	type FavoriteMembershipView,
	type FavoriteSourceType,
	favoriteMembershipViewSchema,
	favoritesCatalog,
} from "./favorites-model";

type MutationDb = PrismaClient | Prisma.TransactionClient;

export type FavoriteOutcome =
	| { membership: FavoriteMembershipView; status: "committed" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

interface MembershipCommand {
	idempotencyKey: string;
	sourceId: string;
	sourceType: FavoriteSourceType;
}

interface SourceQuery {
	sourceId: string;
	sourceType: FavoriteSourceType;
}

export interface Favorites {
	add: (input: MembershipCommand) => Promise<FavoriteOutcome>;
	catalog: () => ReturnType<typeof favoritesCatalog>;
	list: () => Promise<FavoriteMembershipView[]>;
	listForSource: (query: SourceQuery) => Promise<FavoriteMembershipView[]>;
	remove: (input: MembershipCommand) => Promise<FavoriteOutcome>;
}

export interface CreateFavoritesInput {
	accountId: string;
	prisma: PrismaClient;
	workspaceId: string;
}

interface MembershipRow {
	accountId: string;
	id: string;
	sourceId: string;
	sourceType: string;
}

function toView(row: MembershipRow): FavoriteMembershipView {
	return favoriteMembershipViewSchema.parse({
		accountId: row.accountId,
		id: row.id,
		sourceId: row.sourceId,
		sourceType: row.sourceType,
	});
}

function isSourceType(value: string): value is FavoriteSourceType {
	return (favoritesCatalog().sourceTypes as readonly string[]).includes(value);
}

async function sourceExists(
	db: MutationDb,
	workspaceId: string,
	sourceType: FavoriteSourceType,
	sourceId: string
): Promise<boolean> {
	if (sourceType === FAVORITE_SOURCE_TYPE.project) {
		const project = await db.project.findFirst({
			where: { id: sourceId, workspaceId },
		});
		return project !== null;
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.work) {
		const work = await db.work.findFirst({
			where: { id: sourceId, project: { workspaceId } },
		});
		return work !== null;
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.document) {
		const document = await db.document.findFirst({
			where: { id: sourceId, workspaceId },
		});
		return document !== null;
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.decision) {
		const decision = await db.decision.findFirst({
			where: { id: sourceId, project: { workspaceId } },
		});
		return decision !== null;
	}
	const collection = await db.smartCollection.findFirst({
		where: { id: sourceId, workspaceId },
	});
	return collection !== null;
}

async function listRows(
	db: MutationDb,
	accountId: string,
	query?: SourceQuery
): Promise<MembershipRow[]> {
	return await db.favoriteMembership.findMany({
		orderBy: { createdAt: "asc" },
		select: {
			accountId: true,
			id: true,
			sourceId: true,
			sourceType: true,
		},
		where: {
			accountId,
			...(query
				? { sourceId: query.sourceId, sourceType: query.sourceType }
				: {}),
		},
	});
}

function commandKeyFor(actorId: string, idempotencyKey: string): string {
	return `human:${actorId}:${idempotencyKey}`;
}

export function createFavorites(input: CreateFavoritesInput): Favorites {
	async function list(): Promise<FavoriteMembershipView[]> {
		const rows = await listRows(input.prisma, input.accountId);
		return rows.map(toView);
	}

	async function listForSource(
		query: SourceQuery
	): Promise<FavoriteMembershipView[]> {
		const rows = await listRows(input.prisma, input.accountId, query);
		return rows.map(toView);
	}

	async function add(command: MembershipCommand): Promise<FavoriteOutcome> {
		const sourceId = command.sourceId.trim();
		if (sourceId.length === 0) {
			return {
				reason: FAVORITES_COPY.sourceRequired,
				status: "invalid",
			};
		}
		if (!isSourceType(command.sourceType)) {
			return {
				reason: FAVORITES_COPY.unsupportedSource,
				status: "invalid",
			};
		}
		const payload = {
			sourceId,
			sourceType: command.sourceType,
		};
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(tx, `favorite:${input.accountId}:add`);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as FavoriteOutcome;
			}
			const found = await sourceExists(
				tx,
				input.workspaceId,
				command.sourceType,
				sourceId
			);
			if (!found) {
				return { status: "not-found" };
			}
			const already = await tx.favoriteMembership.findFirst({
				where: {
					accountId: input.accountId,
					sourceId,
					sourceType: command.sourceType,
				},
			});
			const row =
				already ??
				(await tx.favoriteMembership.create({
					data: {
						accountId: input.accountId,
						id: crypto.randomUUID(),
						sourceId,
						sourceType: command.sourceType,
					},
				}));
			const membership = toView(row);
			const outcome: FavoriteOutcome = { membership, status: "committed" };
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "favorite.add",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: row.id,
			});
			return outcome;
		});
	}

	async function remove(command: MembershipCommand): Promise<FavoriteOutcome> {
		const sourceId = command.sourceId.trim();
		if (sourceId.length === 0) {
			return {
				reason: FAVORITES_COPY.sourceRequired,
				status: "invalid",
			};
		}
		if (!isSourceType(command.sourceType)) {
			return {
				reason: FAVORITES_COPY.unsupportedSource,
				status: "invalid",
			};
		}
		const payload = {
			sourceId,
			sourceType: command.sourceType,
		};
		const commandKey = commandKeyFor(input.accountId, command.idempotencyKey);
		return await input.prisma.$transaction(async (tx) => {
			await lockMutation(tx, `favorite:${input.accountId}:remove`);
			const existing = await readDurableReceipt(tx, commandKey, payload);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as FavoriteOutcome;
			}
			const row = await tx.favoriteMembership.findFirst({
				where: {
					accountId: input.accountId,
					sourceId,
					sourceType: command.sourceType,
				},
			});
			if (!row) {
				return { status: "not-found" };
			}
			await tx.favoriteMembership.delete({ where: { id: row.id } });
			const membership = toView(row);
			const outcome: FavoriteOutcome = { membership, status: "committed" };
			await writeDurableReceipt(tx, {
				actorId: input.accountId,
				commandKey,
				kind: "favorite.remove",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: row.id,
			});
			return outcome;
		});
	}

	return {
		add,
		catalog: favoritesCatalog,
		list,
		listForSource,
		remove,
	};
}
