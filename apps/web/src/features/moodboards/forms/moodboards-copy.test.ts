import { expect, test } from "vitest";

import { MOODBOARDS_COPY } from "./moodboards-copy";

const SOCIAL_OR_SECOND_SOURCE =
	/comment thread|reaction|mention|task|file description/i;
const FOREIGN_SURFACE =
	/User Flow|Wireframe|design system|Screen|production asset/i;
const STOCK_OR_AUTO_SUGGEST =
	/stock image|unsplash|auto(?:matic)? color suggest|color suggestion/i;
const OUT_OF_SCOPE_SHARE = /Build in Public|share link/i;

test("English Moodboard labels stay Moodboard, Caption, Presentation Mode, and origin kinds", () => {
	expect(MOODBOARDS_COPY.moodboard).toBe("Moodboard");
	expect(MOODBOARDS_COPY.createMoodboard).toBe("Create Moodboard");
	expect(MOODBOARDS_COPY.caption).toBe("Caption");
	expect(MOODBOARDS_COPY.fileAttachment).toBe("File Attachment");
	expect(MOODBOARDS_COPY.externalLink).toBe("External link");
	expect(MOODBOARDS_COPY.addVisual).toBe("Add visual");
	expect(MOODBOARDS_COPY.fitView).toBe("Fit View");
	expect(MOODBOARDS_COPY.openSourceRecord).toBe("Open Source Record");
	expect(MOODBOARDS_COPY.outline).toBe("Outline");
	expect(MOODBOARDS_COPY.group).toBe("Group");
	expect(MOODBOARDS_COPY.presentationMode).toBe("Presentation Mode");
	expect(MOODBOARDS_COPY.exitPresentationMode).toBe("Exit Presentation Mode");
	expect(MOODBOARDS_COPY.snapshot).toBe("Snapshot");
	expect(MOODBOARDS_COPY.png).toBe("PNG");
	expect(MOODBOARDS_COPY.pdf).toBe("PDF");
	expect(MOODBOARDS_COPY.crop).toBe("Crop");
	expect(MOODBOARDS_COPY.rotate).toBe("Rotate 90°");
	expect(MOODBOARDS_COPY.noLiveSourceLinks).toBe(
		"Output carries no live source links."
	);
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(SOCIAL_OR_SECOND_SOURCE);
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(FOREIGN_SURFACE);
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(OUT_OF_SCOPE_SHARE);
});

test("English Color Swatch labels stay Color Swatch and color input kinds", () => {
	expect(MOODBOARDS_COPY.colorSwatch).toBe("Color Swatch");
	expect(MOODBOARDS_COPY.addColorSwatch).toBe("Add Color Swatch");
	expect(MOODBOARDS_COPY.paletteGroup).toBe("Palette group");
	expect(MOODBOARDS_COPY.addPaletteGroup).toBe("Add palette group");
	expect(MOODBOARDS_COPY.note).toBe("Note");
	expect(MOODBOARDS_COPY.picker).toBe("Picker");
	expect(MOODBOARDS_COPY.eyedrop).toBe("Eyedrop");
	expect(MOODBOARDS_COPY.hex).toBe("HEX");
	expect(MOODBOARDS_COPY.rgb).toBe("RGB");
	expect(MOODBOARDS_COPY.hsl).toBe("HSL");
	expect(JSON.stringify(MOODBOARDS_COPY)).not.toMatch(STOCK_OR_AUTO_SUGGEST);
});
