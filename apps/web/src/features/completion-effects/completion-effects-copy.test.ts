import { COMPLETION_EFFECTS_COPY } from "@cantiara/auth/completion-effects-copy";
import { COMPLETION_EFFECT_THEMES } from "@cantiara/auth/completion-effects-model";
import { expect, test } from "vitest";

const FORBIDDEN_COPY = /Random|Moodboard|System|upload|Mario|Pikachu/i;

test("English UI uses Calm, Weave, Arc, Nova, and Preview", () => {
	expect(COMPLETION_EFFECTS_COPY).toMatchObject({
		arc: "Arc",
		calm: "Calm",
		enable: "Enable",
		heading: "Completion effects",
		nova: "Nova",
		preview: "Preview",
		reopen: "Reopen",
		weave: "Weave",
		workCompleted: "Work completed",
	});
	expect(COMPLETION_EFFECT_THEMES).toEqual(["Calm", "Weave", "Arc", "Nova"]);
	expect(JSON.stringify(COMPLETION_EFFECTS_COPY)).not.toMatch(FORBIDDEN_COPY);
});
