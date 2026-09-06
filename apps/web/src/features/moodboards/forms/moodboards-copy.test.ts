import { expect, test } from "vitest";

import { MOODBOARDS_COPY } from "./moodboards-copy";

const SOCIAL_OR_SECOND_SOURCE =
	/comment thread|reaction|mention|task|file description/i;
const FOREIGN_SURFACE =
	/User Flow|Wireframe|design system|Screen|production asset/i;

test("English Moodboard labels stay Moodboard, Caption, and origin kinds", () => {
	expect(MOODBOARDS_COPY.moodboard).toBe("Moodboard");
	expect(MOODBOARDS_COPY.createMoodboard).toBe("Create Moodboard");
	expect(MOODBOARDS_COPY.caption).toBe("Caption");
	expect(MOODBOARDS_COPY.fileAttachment).toBe("File Attachment");
	expect(MOODBOARDS_COPY.externalLink).toBe("External link");
	expect(MOODBOARDS_COPY.addVisual).toBe("Add visual");
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(SOCIAL_OR_SECOND_SOURCE);
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(FOREIGN_SURFACE);
});
