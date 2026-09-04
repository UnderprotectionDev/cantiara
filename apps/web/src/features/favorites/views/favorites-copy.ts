import { MUTATION_COPY } from "../../../lib/mutation";

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

export const FAVORITE_SOURCE_TYPES = [
	"Project",
	"Document",
	"Work",
	"Decision",
	"Smart Collection",
] as const;

export type FavoriteSourceType = (typeof FAVORITE_SOURCE_TYPES)[number];

export type FavoriteWriteOutcome =
	| { status: "committed" }
	| { status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

export function presentFavoriteWriteError(
	outcome: FavoriteWriteOutcome
): string | null {
	if (outcome.status === "committed") {
		return null;
	}
	if (outcome.status === "invalid") {
		return outcome.reason;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	return FAVORITES_COPY.sourceRequired;
}
