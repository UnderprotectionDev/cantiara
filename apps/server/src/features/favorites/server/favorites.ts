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
	type FavoriteBrokenReason,
	type FavoriteMembershipView,
	type FavoriteOpenList,
	type FavoriteOpenRow,
	type FavoriteOpenTarget,
	type FavoriteSourceType,
	favoriteMembershipViewSchema,
	favoriteOpenListSchema,
	favoriteOpenRowSchema,
	favoriteSourceHref,
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
	openList: () => Promise<FavoriteOpenList>;
	openSource: (membershipId: string) => Promise<FavoriteOpenRow | null>;
	remove: (input: MembershipCommand) => Promise<FavoriteOutcome>;
}

export interface CreateFavoritesInput {
	accountId: string;
	prisma: PrismaClient;
	workspaceId: string;
}

interface MembershipRow {
	accountId: string;
	createdAt: Date;
	id: string;
	sourceId: string;
	sourceType: string;
}

interface ResolvedSource {
	href: string | null;
	reason: FavoriteBrokenReason | null;
	title: string | null;
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

function openTargetFrom(resolved: ResolvedSource): FavoriteOpenTarget {
	if (resolved.reason === null) {
		if (!resolved.href) {
			return {
				href: null,
				kind: "broken-reference",
				openSourceRecord: null,
				reason: FAVORITES_COPY.permanentlyDeleted,
			};
		}
		return {
			href: resolved.href,
			kind: "record",
			openSourceRecord: FAVORITES_COPY.openSourceRecord,
		};
	}
	const keepOpen =
		resolved.reason === FAVORITES_COPY.archived ||
		resolved.reason === FAVORITES_COPY.inTrash;
	return {
		href: keepOpen ? resolved.href : null,
		kind: "broken-reference",
		openSourceRecord: keepOpen ? FAVORITES_COPY.openSourceRecord : null,
		reason: resolved.reason,
	};
}

function titleFor(resolved: ResolvedSource): string | null {
	if (
		resolved.reason === FAVORITES_COPY.permanentlyDeleted ||
		resolved.reason === FAVORITES_COPY.noAccess ||
		resolved.reason === FAVORITES_COPY.redactedForSecurity
	) {
		return null;
	}
	return resolved.title;
}

function gone(): ResolvedSource {
	return {
		href: null,
		reason: FAVORITES_COPY.permanentlyDeleted,
		title: null,
	};
}

function inaccessible(): ResolvedSource {
	return { href: null, reason: FAVORITES_COPY.noAccess, title: null };
}

async function resolveProject(
	db: MutationDb,
	workspaceId: string,
	sourceId: string
): Promise<ResolvedSource> {
	const project = await db.project.findFirst({
		select: { archivedAt: true, name: true, workspaceId: true },
		where: { id: sourceId },
	});
	if (!project) {
		return gone();
	}
	if (project.workspaceId !== workspaceId) {
		return inaccessible();
	}
	const href = favoriteSourceHref({
		projectId: null,
		sourceId,
		sourceType: FAVORITE_SOURCE_TYPE.project,
	});
	if (project.archivedAt) {
		return { href, reason: FAVORITES_COPY.archived, title: project.name };
	}
	return { href, reason: null, title: project.name };
}

async function resolveWork(
	db: MutationDb,
	workspaceId: string,
	sourceId: string
): Promise<ResolvedSource> {
	const work = await db.work.findFirst({
		select: {
			archived: true,
			project: { select: { workspaceId: true } },
			projectId: true,
			title: true,
			trashedAt: true,
		},
		where: { id: sourceId },
	});
	if (!work) {
		return gone();
	}
	if (work.project.workspaceId !== workspaceId) {
		return inaccessible();
	}
	const href = favoriteSourceHref({
		projectId: work.projectId,
		sourceId,
		sourceType: FAVORITE_SOURCE_TYPE.work,
	});
	if (work.trashedAt) {
		return { href, reason: FAVORITES_COPY.inTrash, title: work.title };
	}
	if (work.archived) {
		return { href, reason: FAVORITES_COPY.archived, title: work.title };
	}
	return { href, reason: null, title: work.title };
}

async function resolveDocument(
	db: MutationDb,
	workspaceId: string,
	sourceId: string
): Promise<ResolvedSource> {
	const document = await db.document.findFirst({
		select: {
			archivedAt: true,
			projectId: true,
			title: true,
			workspaceId: true,
		},
		where: { id: sourceId },
	});
	if (!document) {
		return gone();
	}
	if (document.workspaceId !== workspaceId) {
		return inaccessible();
	}
	const href = favoriteSourceHref({
		projectId: document.projectId,
		sourceId,
		sourceType: FAVORITE_SOURCE_TYPE.document,
	});
	if (document.archivedAt) {
		return { href, reason: FAVORITES_COPY.archived, title: document.title };
	}
	return { href, reason: null, title: document.title };
}

async function resolveDecision(
	db: MutationDb,
	workspaceId: string,
	sourceId: string
): Promise<ResolvedSource> {
	const decision = await db.decision.findFirst({
		select: {
			project: { select: { workspaceId: true } },
			projectId: true,
			title: true,
		},
		where: { id: sourceId },
	});
	if (!decision) {
		return gone();
	}
	if (decision.project.workspaceId !== workspaceId) {
		return inaccessible();
	}
	return {
		href: favoriteSourceHref({
			projectId: decision.projectId,
			sourceId,
			sourceType: FAVORITE_SOURCE_TYPE.decision,
		}),
		reason: null,
		title: decision.title,
	};
}

async function resolveSmartCollection(
	db: MutationDb,
	workspaceId: string,
	sourceId: string
): Promise<ResolvedSource> {
	const collection = await db.smartCollection.findFirst({
		select: { name: true, workspaceId: true },
		where: { id: sourceId },
	});
	if (!collection) {
		return gone();
	}
	if (collection.workspaceId !== workspaceId) {
		return inaccessible();
	}
	return {
		href: favoriteSourceHref({
			projectId: null,
			sourceId,
			sourceType: FAVORITE_SOURCE_TYPE.smartCollection,
		}),
		reason: null,
		title: collection.name,
	};
}

async function resolveSource(
	db: MutationDb,
	workspaceId: string,
	sourceType: FavoriteSourceType,
	sourceId: string
): Promise<ResolvedSource> {
	if (sourceType === FAVORITE_SOURCE_TYPE.project) {
		return await resolveProject(db, workspaceId, sourceId);
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.work) {
		return await resolveWork(db, workspaceId, sourceId);
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.document) {
		return await resolveDocument(db, workspaceId, sourceId);
	}
	if (sourceType === FAVORITE_SOURCE_TYPE.decision) {
		return await resolveDecision(db, workspaceId, sourceId);
	}
	return await resolveSmartCollection(db, workspaceId, sourceId);
}

async function toOpenRow(
	db: MutationDb,
	workspaceId: string,
	row: MembershipRow
): Promise<FavoriteOpenRow> {
	const sourceType = row.sourceType as FavoriteSourceType;
	const resolved = await resolveSource(
		db,
		workspaceId,
		sourceType,
		row.sourceId
	);
	return favoriteOpenRowSchema.parse({
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		openTarget: openTargetFrom(resolved),
		sourceId: row.sourceId,
		sourceType,
		title: titleFor(resolved),
	});
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
			createdAt: true,
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

	async function openList(): Promise<FavoriteOpenList> {
		const rows = await listRows(input.prisma, input.accountId);
		const openRows = await Promise.all(
			rows.map((row) => toOpenRow(input.prisma, input.workspaceId, row))
		);
		return favoriteOpenListSchema.parse({
			copy: {
				favorites: FAVORITES_COPY.favorites,
				openSourceRecord: FAVORITES_COPY.openSourceRecord,
			},
			membershipWrite: false,
			rows: openRows,
			secondCopy: false,
			title: FAVORITES_COPY.favorites,
		});
	}

	async function openSource(
		membershipId: string
	): Promise<FavoriteOpenRow | null> {
		const rows = await listRows(input.prisma, input.accountId);
		const row = rows.find((entry) => entry.id === membershipId);
		if (!row) {
			return null;
		}
		return await toOpenRow(input.prisma, input.workspaceId, row);
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
		openList,
		openSource,
		remove,
	};
}
