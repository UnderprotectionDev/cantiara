import { expect, test } from "vitest";

import { eyedropScreenColor } from "./moodboard-eyedrop";

test("eyedrop returns null when EyeDropper is absent", async () => {
	expect(await eyedropScreenColor()).toBeNull();
});

test("eyedrop samples an sRGB hex from EyeDropper when present", async () => {
	(
		globalThis as {
			EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
		}
	).EyeDropper = class {
		open() {
			return Promise.resolve({ sRGBHex: "#8b5a2b" });
		}
	};
	expect(await eyedropScreenColor()).toBe("#8B5A2B");
	Reflect.deleteProperty(globalThis, "EyeDropper");
});
