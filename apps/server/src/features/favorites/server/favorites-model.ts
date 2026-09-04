import { z } from "zod";

export const FAVORITES_COPY = {
	addToFavorites: "Add to Favorites",
	favorites: "Favorites",
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
