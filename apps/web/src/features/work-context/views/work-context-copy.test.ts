import { expect, test } from "vitest";

import { STARTER_CONFIGURATIONS } from "../../project-shell/forms/project-shell-copy";
import { WORK_TYPES } from "../../work-lifecycle/forms/work-lifecycle-copy";

import {
	presentWorkContextCard,
	revealPreparedSection,
	WORK_CONTEXT_COPY,
} from "./work-context-copy";

const PREPARED_BY_TYPE = {
	Bug: [
		"Observed/Expected Behavior",
		"Affected Releases",
		"Evidence",
		"GitHub & Tests",
	],
	Feature: [
		"Problem/Opportunity",
		"Expected Outcome",
		"Evidence & Decisions",
		"Risks & Open Questions",
		"Included Work",
		"GitHub & Tests",
		"Target Release",
	],
	Improvement: [
		"Current Situation",
		"Expected Outcome",
		"Evidence",
		"GitHub & Tests",
	],
	Research: [
		"Research Question",
		"Sources & Evidence",
		"Decisions",
		"Related Work",
	],
	Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

const DASHBOARD_PATTERN = /dashboard|readiness score|wsjf|free query/i;

test("English prepared section names and Add Context match the PRD table", () => {
	expect(WORK_CONTEXT_COPY.addContext).toBe("Add Context");
	expect(WORK_CONTEXT_COPY.hide).toBe("Hide");
	expect(WORK_CONTEXT_COPY.addCustomSection).toBe("Add custom section");
	expect(WORK_CONTEXT_COPY.problemOpportunity).toBe("Problem/Opportunity");
	expect(JSON.stringify(WORK_CONTEXT_COPY)).not.toMatch(DASHBOARD_PATTERN);
	for (const workType of WORK_TYPES) {
		for (const starterConfiguration of STARTER_CONFIGURATIONS) {
			expect(
				presentWorkContextCard({ starterConfiguration, workType })
					.preparedSections
			).toEqual(PREPARED_BY_TYPE[workType]);
		}
	}
});

test("Add Context reveals a hidden prepared section without gating save", () => {
	const opened = revealPreparedSection(
		presentWorkContextCard({
			starterConfiguration: "Open Source Library",
			workType: "Task",
		}),
		"Description"
	);
	expect(opened.visiblePreparedSections).toEqual(["Description"]);
	expect(opened.initiallyVisibleFields).toEqual([
		"Title",
		"Type",
		"Status",
		"Planning",
	]);
	expect(opened.gates).toEqual({ create: false, statusTransition: false });
});

test("Why am I doing this work? and empty visible sections stay English and ungated", () => {
	expect(WORK_CONTEXT_COPY.whyAmIDoingThisWork).toBe(
		"Why am I doing this work?"
	);
	expect(WORK_CONTEXT_COPY.emptySection).toBe("Nothing here yet.");
	expect(WORK_CONTEXT_COPY.openSourceRecord).toBe("Open source record");
	const opened = revealPreparedSection(
		presentWorkContextCard({
			starterConfiguration: "Blank Project",
			workType: "Feature",
		}),
		"Problem/Opportunity"
	);
	expect(opened.whyChain.label).toBe("Why am I doing this work?");
	expect(opened.visibleSections[0]).toMatchObject({
		action: { kind: "add", label: "Add" },
		empty: true,
		emptyState: "Nothing here yet.",
		name: "Problem/Opportunity",
	});
	expect(opened.effects.completenessScore).toBe(false);
	expect(opened.writes.contextRecord).toBe(false);
});
