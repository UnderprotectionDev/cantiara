import { expect, test } from "vitest";
import { favoriteOpenHref } from "./favorite-open";
import { FAVORITES_COPY } from "./favorites-copy";

test("Open source record uses the source href and stays off a broken deleted row", () => {
	expect(
		favoriteOpenHref({
			href: "/projects/proj_1?work=work_1#work",
			openSourceRecord: FAVORITES_COPY.openSourceRecord,
		})
	).toBe("/projects/proj_1?work=work_1#work");
	expect(
		favoriteOpenHref({
			href: null,
			openSourceRecord: null,
		})
	).toBeNull();
	expect(
		favoriteOpenHref({
			href: "/projects/other#overview",
			openSourceRecord: null,
		})
	).toBeNull();
});
