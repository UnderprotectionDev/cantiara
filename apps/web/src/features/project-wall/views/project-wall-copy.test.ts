import { expect, test } from "vitest";

import { PROJECT_WALL_COPY, PROJECT_WALL_DENSITIES } from "./project-wall-copy";

const FOREIGN_SURFACE = /Wireframe|Moodboard|Wiki|CSS/i;
const SKETCH_COPY = /Sketch/i;

test("English UI uses Project Wall densities, Open Source Record, Create Persistent Relation, and Lock Position", () => {
	expect(PROJECT_WALL_COPY.projectWall).toBe("Project Wall");
	expect(PROJECT_WALL_COPY.compact).toBe("Compact");
	expect(PROJECT_WALL_COPY.preview).toBe("Preview");
	expect(PROJECT_WALL_COPY.detailed).toBe("Detailed");
	expect(PROJECT_WALL_COPY.openSourceRecord).toBe("Open Source Record");
	expect(PROJECT_WALL_COPY.createPersistentRelation).toBe(
		"Create Persistent Relation"
	);
	expect(PROJECT_WALL_COPY.lockPosition).toBe("Lock Position");
	expect(PROJECT_WALL_COPY.visualLink).toBe("Visual link");
	expect(PROJECT_WALL_DENSITIES).toEqual(["Compact", "Preview", "Detailed"]);
	expect(JSON.stringify(PROJECT_WALL_COPY)).not.toMatch(FOREIGN_SURFACE);
	expect(JSON.stringify(PROJECT_WALL_COPY)).not.toMatch(SKETCH_COPY);
});
