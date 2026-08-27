import { expect, test } from "vitest";

import { projectIdFromPath } from "./project-id-from-path";

test("Sessions and Projects list are not treated as a Project", () => {
	expect(projectIdFromPath("/sessions")).toBeNull();
	expect(projectIdFromPath("/projects")).toBeNull();
	expect(projectIdFromPath("/projects/")).toBeNull();
	expect(projectIdFromPath("/projects/new")).toBeNull();
	expect(projectIdFromPath("/dashboard")).toBeNull();
});

test("a Project route still yields the Project id", () => {
	expect(projectIdFromPath("/projects/proj_1")).toBe("proj_1");
});
