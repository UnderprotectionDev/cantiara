import { z } from "zod";

export const FAVORITES_COPY = {
	addToFavorites: "Add to Favorites",
	archived: "Archived",
	favorites: "Favorites",
	inTrash: "In Trash",
	noAccess: "No access",
	openSourceRecord: "Open source record",
	permanentlyDeleted: "Permanently deleted",
	redactedForSecurity: "Redacted for security",
	removeFromFavorites: "Remove from Favorites",
	sourceRequired: "A Favorite needs a supported source record.",
	unsupportedSource: "This record type cannot be a Favorite.",
} as const;

export const FAVORITE_SOURCE_TYPE = {
	decision: "Decision",
	document: "Document",
	project: "Project",
	smartCollection: "Smart Collection",
	work: "Work",
} as const;

export const FAVORITE_SOURCE_TYPES = [
	FAVORITE_SOURCE_TYPE.project,
	FAVORITE_SOURCE_TYPE.document,
	FAVORITE_SOURCE_TYPE.work,
	FAVORITE_SOURCE_TYPE.decision,
	FAVORITE_SOURCE_TYPE.smartCollection,
] as const;

export type FavoriteSourceType = (typeof FAVORITE_SOURCE_TYPES)[number];

export const FAVORITES_COUNTERPARTS = {
	activeWorkingSet: false,
	backlog: false,
	dailyFocus: false,
	focusPeriod: false,
	secondCopy: false,
	shellMembershipStore: false,
} as const;

export const FAVORITES_SOURCE_WRITES = {
	backlogOrder: false,
	closure: false,
	project: false,
	scope: false,
	status: false,
	type: false,
} as const;

export function favoritesCatalog() {
	return {
		copy: FAVORITES_COPY,
		counterparts: FAVORITES_COUNTERPARTS,
		kind: "favorites",
		sourceTypes: FAVORITE_SOURCE_TYPES,
		sourceWrites: FAVORITES_SOURCE_WRITES,
	};
}

export const favoriteMembershipViewSchema = z.object({
	accountId: z.string().min(1),
	id: z.string().min(1),
	sourceId: z.string().min(1),
	sourceType: z.enum(FAVORITE_SOURCE_TYPES),
});

export type FavoriteMembershipView = z.infer<
	typeof favoriteMembershipViewSchema
>;

export const FAVORITE_BROKEN_REASONS = [
	FAVORITES_COPY.archived,
	FAVORITES_COPY.inTrash,
	FAVORITES_COPY.permanentlyDeleted,
	FAVORITES_COPY.redactedForSecurity,
	FAVORITES_COPY.noAccess,
] as const;

export type FavoriteBrokenReason = (typeof FAVORITE_BROKEN_REASONS)[number];

export function favoriteSourceHref(input: {
	projectId: string | null;
	sourceId: string;
	sourceType: FavoriteSourceType;
}): string {
	if (input.sourceType === FAVORITE_SOURCE_TYPE.project) {
		return `/projects/${input.sourceId}#overview`;
	}
	if (input.sourceType === FAVORITE_SOURCE_TYPE.work && input.projectId) {
		return `/projects/${input.projectId}?work=${encodeURIComponent(input.sourceId)}#work`;
	}
	if (input.sourceType === FAVORITE_SOURCE_TYPE.decision && input.projectId) {
		return `/projects/${input.projectId}?decision=${encodeURIComponent(input.sourceId)}#decisions`;
	}
	if (input.sourceType === FAVORITE_SOURCE_TYPE.document) {
		if (input.projectId) {
			return `/projects/${input.projectId}#documents`;
		}
		return "/wiki";
	}
	return "/smart-collections";
}

const openSourceAction = z.literal(FAVORITES_COPY.openSourceRecord);

export const favoriteOpenTargetSchema = z.discriminatedUnion("kind", [
	z.object({
		href: z.string().min(1),
		kind: z.literal("record"),
		openSourceRecord: openSourceAction,
	}),
	z.object({
		href: z.string().min(1).nullable(),
		kind: z.literal("broken-reference"),
		openSourceRecord: openSourceAction.nullable(),
		reason: z.enum(FAVORITE_BROKEN_REASONS),
	}),
]);

export const favoriteOpenRowSchema = z.object({
	createdAt: z.string().datetime(),
	id: z.string().min(1),
	openTarget: favoriteOpenTargetSchema,
	sourceId: z.string().min(1),
	sourceType: z.enum(FAVORITE_SOURCE_TYPES),
	title: z.string().min(1).nullable(),
});

export const favoriteOpenListSchema = z.object({
	copy: z.object({
		favorites: z.literal(FAVORITES_COPY.favorites),
		openSourceRecord: openSourceAction,
	}),
	membershipWrite: z.literal(false),
	rows: z.array(favoriteOpenRowSchema),
	secondCopy: z.literal(false),
	title: z.literal(FAVORITES_COPY.favorites),
});

export type FavoriteOpenTarget = z.infer<typeof favoriteOpenTargetSchema>;
export type FavoriteOpenRow = z.infer<typeof favoriteOpenRowSchema>;
export type FavoriteOpenList = z.infer<typeof favoriteOpenListSchema>;
