import { expect, test } from "vitest";

import {
	hasStarterSkeletonWalls,
	PROJECT_WALL_COPY,
	PROJECT_WALL_DENSITIES,
} from "./project-wall-copy";

const FOREIGN_SURFACE =
	/Wireframe|Moodboard|Wiki|CSS|Link sharing|Build in Public/i;

const SKETCH_COPY = /Sketch|freehand|Freehand/i;

test("English UI uses Project Wall, Sitemap, Customer Journey, Presentation Mode, and Open Source Record", () => {
	expect(PROJECT_WALL_COPY.projectWall).toBe("Project Wall");
	expect(PROJECT_WALL_COPY.sitemap).toBe("Sitemap");
	expect(PROJECT_WALL_COPY.customerJourney).toBe("Customer Journey");
	expect(PROJECT_WALL_COPY.compact).toBe("Compact");
	expect(PROJECT_WALL_COPY.preview).toBe("Preview");
	expect(PROJECT_WALL_COPY.detailed).toBe("Detailed");
	expect(PROJECT_WALL_COPY.openSourceRecord).toBe("Open Source Record");
	expect(PROJECT_WALL_COPY.createPersistentRelation).toBe(
		"Create Persistent Relation"
	);
	expect(PROJECT_WALL_COPY.lockPosition).toBe("Lock Position");
	expect(PROJECT_WALL_COPY.visualLink).toBe("Visual link");
	expect(PROJECT_WALL_COPY.from).toBe("From");
	expect(PROJECT_WALL_COPY.to).toBe("To");
	expect(PROJECT_WALL_COPY.unbind).toBe("Unbind");
	expect(PROJECT_WALL_COPY.presentationMode).toBe("Presentation Mode");
	expect(PROJECT_WALL_COPY.frozenCopy).toBe("Frozen copy");
	expect(PROJECT_WALL_COPY.openAllInSource).toBe("Open all in source");
	expect(PROJECT_WALL_COPY.fitView).toBe("Fit View");
	expect(PROJECT_WALL_COPY.outline).toBe("Outline");
	expect(PROJECT_WALL_COPY.inspect).toBe("Inspect");
	expect(PROJECT_WALL_DENSITIES).toEqual(["Compact", "Preview", "Detailed"]);
	expect(JSON.stringify(PROJECT_WALL_COPY)).not.toMatch(FOREIGN_SURFACE);
	expect(JSON.stringify(PROJECT_WALL_COPY)).not.toMatch(SKETCH_COPY);
});

test("starter skeletons are present only when both Sitemap and Customer Journey exist", () => {
	expect(hasStarterSkeletonWalls([])).toBe(false);
	expect(hasStarterSkeletonWalls([{ name: PROJECT_WALL_COPY.sitemap }])).toBe(
		false
	);
	expect(
		hasStarterSkeletonWalls([
			{ name: PROJECT_WALL_COPY.sitemap },
			{ name: PROJECT_WALL_COPY.customerJourney },
		])
	).toBe(true);
});
