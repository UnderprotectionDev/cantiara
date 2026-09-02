import { expect, test } from "vitest";

import {
	openProjectIdFromLocation,
	searchLinkSearch,
} from "./search-open-project";

test("Search keeps the founder’s open Project when leaving a Project page", () => {
	expect(
		openProjectIdFromLocation({
			pathname: "/projects/proj_atlas",
			projectFromPath: "proj_atlas",
			search: {},
		})
	).toBe("proj_atlas");
	expect(searchLinkSearch("proj_atlas")).toEqual({ project: "proj_atlas" });
	expect(
		openProjectIdFromLocation({
			pathname: "/search",
			projectFromPath: null,
			search: { project: "proj_atlas" },
		})
	).toBe("proj_atlas");
	expect(searchLinkSearch(null)).toBeUndefined();
});
