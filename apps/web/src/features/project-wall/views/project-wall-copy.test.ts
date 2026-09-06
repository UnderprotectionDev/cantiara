import { expect, test } from "vitest";

import { PROJECT_WALL_COPY, PROJECT_WALL_DENSITIES } from "./project-wall-copy";

const FOREIGN_SURFACE = /Wireframe|Moodboard|Wiki|CSS/i;

test("English UI uses Project Wall, Sitemap, Customer Journey, densities, and Open Source Record", () => {
	expect(PROJECT_WALL_COPY.projectWall).toBe("Project Wall");
	expect(PROJECT_WALL_COPY.sitemap).toBe("Sitemap");
	expect(PROJECT_WALL_COPY.customerJourney).toBe("Customer Journey");
	expect(PROJECT_WALL_COPY.compact).toBe("Compact");
	expect(PROJECT_WALL_COPY.preview).toBe("Preview");
	expect(PROJECT_WALL_COPY.detailed).toBe("Detailed");
	expect(PROJECT_WALL_COPY.openSourceRecord).toBe("Open Source Record");
	expect(PROJECT_WALL_DENSITIES).toEqual(["Compact", "Preview", "Detailed"]);
	expect(JSON.stringify(PROJECT_WALL_COPY)).not.toMatch(FOREIGN_SURFACE);
});
