import { expect, test } from "vitest";

import { MUTATION_COPY } from "../../../lib/mutation";

import {
	FAVORITE_SOURCE_TYPES,
	FAVORITES_COPY,
	presentFavoriteWriteError,
} from "./favorites-copy";

const FORBIDDEN_SURFACE =
	/bookmark queue|Active Working Set|Save for Later|planning membership/i;

test("English Favorites copy uses Add to Favorites and Remove from Favorites", () => {
	expect(FAVORITES_COPY.favorites).toBe("Favorites");
	expect(FAVORITES_COPY.addToFavorites).toBe("Add to Favorites");
	expect(FAVORITES_COPY.removeFromFavorites).toBe("Remove from Favorites");
	expect(FAVORITE_SOURCE_TYPES).toEqual([
		"Project",
		"Document",
		"Work",
		"Decision",
		"Smart Collection",
	]);
	expect(JSON.stringify(FAVORITES_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});

test("a missing source is not shown as Conflict", () => {
	expect(presentFavoriteWriteError({ status: "committed" })).toBeNull();
	expect(presentFavoriteWriteError({ status: "conflict" })).toBe(
		MUTATION_COPY.conflict
	);
	expect(
		presentFavoriteWriteError({
			reason: FAVORITES_COPY.unsupportedSource,
			status: "invalid",
		})
	).toBe(FAVORITES_COPY.unsupportedSource);
	expect(presentFavoriteWriteError({ status: "not-found" })).toBe(
		FAVORITES_COPY.sourceRequired
	);
	expect(presentFavoriteWriteError({ status: "not-found" })).not.toBe(
		MUTATION_COPY.conflict
	);
});
