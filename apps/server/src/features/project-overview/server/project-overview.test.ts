/**
 * Project Overview seam — derived modules from source records,
 * honest empty, no health score, no Workspace overview / Value Chain /
 * Manual Project Update mix, Tests summaries are not the Tests area
 * product, Goals reachable and not a Project area, no Açık Soru
 * uncertainty module. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje overview half).
 */
import { describe, expect, it } from "vitest";

import { PROJECT_AREAS } from "../../project-shell/server/project-shell-model";
import {
	OVERVIEW_MODULE_HEADINGS,
	type OverviewProjectSource,
	type OverviewSources,
	overviewSourcesFromProject,
	projectOverview,
} from "./project-overview";

const ATLAS: OverviewProjectSource = {
	id: "project-atlas",
	lifecycleStatus: "Active",
	name: "Atlas",
	purpose: null,
	stages: [],
	targetDate: null,
};

const HEALTH_KEYS = [
	"atRisk",
	"healthScore",
	"offTrack",
	"onTrack",
	"qualitativeUncertainty",
	"successNarrative",
	"trafficLight",
] as const;

const WORKSPACE_OVERVIEW_HEADINGS = [
	"Active Projects",
	"Attention Required",
	"Upcoming",
	"Recent Work",
] as const;

const FORBIDDEN_HEADINGS = [
	...WORKSPACE_OVERVIEW_HEADINGS,
	"Value Chain",
	"Manual Project Update",
	"On Track",
	"At Risk",
	"Off Track",
	"Open Question",
	"Health",
] as const;

const INVENTED_ROW_PATTERN = /Get started|No \w+ yet|placeholder/i;
const FORBIDDEN_SURFACE_PATTERN =
	/Value Chain|Manual Project Update|Attention Required/;
const TESTS_AREA_PRODUCT_PATTERN = /Planned Test Case|Handoff package/;

function collectKeys(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(collectKeys);
	}
	if (value && typeof value === "object") {
		return [
			...Object.keys(value),
			...Object.values(value).flatMap(collectKeys),
		];
	}
	return [];
}

function headingsOf(
	overview: ReturnType<typeof projectOverview>
): readonly string[] {
	return overview.modules.map((module) => module.heading);
}

function recordsOf(
	overview: ReturnType<typeof projectOverview>,
	heading: (typeof OVERVIEW_MODULE_HEADINGS)[number]
) {
	const module = overview.modules.find((item) => item.heading === heading);
	if (!module) {
		throw new Error(`missing ${heading} module`);
	}
	return module.records;
}

function sourcesFrom(
	project: OverviewProjectSource,
	extras: Partial<Omit<OverviewSources, "project">> = {}
): OverviewSources {
	return overviewSourcesFromProject(project, extras);
}

describe("Project Overview", () => {
	it("keeps every catalog module empty when sources are empty and invents no rows", () => {
		const overview = projectOverview(sourcesFrom(ATLAS));
		expect(headingsOf(overview)).toEqual([...OVERVIEW_MODULE_HEADINGS]);
		expect(recordsOf(overview, "Purpose")).toEqual([]);
		expect(recordsOf(overview, "Lifecycle")).toEqual([
			{ detail: null, id: "project-atlas", title: "Active" },
		]);
		expect(recordsOf(overview, "Goals")).toEqual([]);
		expect(recordsOf(overview, "Stages")).toEqual([]);
		expect(recordsOf(overview, "Milestones")).toEqual([]);
		expect(recordsOf(overview, "Work")).toEqual([]);
		expect(recordsOf(overview, "Documents")).toEqual([]);
		expect(recordsOf(overview, "Decisions")).toEqual([]);
		expect(recordsOf(overview, "Risks")).toEqual([]);
		expect(recordsOf(overview, "Tests")).toEqual([]);
		expect(recordsOf(overview, "Production")).toEqual([]);
		expect(recordsOf(overview, "Blockers")).toEqual([]);
		expect(recordsOf(overview, "Dates")).toEqual([]);
		expect(recordsOf(overview, "Recent changes")).toEqual([]);
		expect(JSON.stringify(overview.modules)).not.toMatch(INVENTED_ROW_PATTERN);
	});

	it("fills modules from seeded source records with source equality", () => {
		const overview = projectOverview(
			sourcesFrom(
				{
					...ATLAS,
					purpose: "Ship the first founder workspace",
					stages: [
						{ id: "stage-discovery", name: "Discovery", state: "Active" },
						{ id: "stage-build", name: "Build", state: "Active" },
						{ id: "stage-operate", name: "Operate", state: "Not Planned" },
					],
					targetDate: "2026-09-01",
				},
				{
					blockers: [{ id: "blocker-1", title: "Waiting on GitHub App" }],
					decisions: [{ id: "decision-1", title: "Use GitHub login" }],
					documents: [{ id: "doc-1", title: "Founder notes" }],
					goals: [{ id: "goal-1", title: "Reach İlk Proje" }],
					milestones: [{ id: "ms-1", title: "Private beta" }],
					productionIncidents: [{ id: "inc-1", title: "Login outage" }],
					recentChanges: [
						{
							at: "2026-08-26T12:00:00.000Z",
							id: "change-1",
							title: "Renamed Short code",
						},
					],
					risks: [{ id: "risk-1", title: "GitHub outage during login" }],
					testGaps: [{ id: "gap-1", title: "No session for capture" }],
					testHandoffs: [{ id: "handoff-1", title: "Manual capture pass" }],
					testSessions: [{ id: "session-1", title: "2026-08-20 session" }],
					work: [{ id: "work-1", title: "Create Project" }],
				}
			)
		);
		expect(recordsOf(overview, "Purpose")).toEqual([
			{
				detail: null,
				id: "project-atlas",
				title: "Ship the first founder workspace",
			},
		]);
		expect(recordsOf(overview, "Goals")).toEqual([
			{ detail: null, id: "goal-1", title: "Reach İlk Proje" },
		]);
		expect(recordsOf(overview, "Stages")).toEqual([
			{ detail: "Active", id: "stage-discovery", title: "Discovery" },
			{ detail: "Active", id: "stage-build", title: "Build" },
			{ detail: "Not Planned", id: "stage-operate", title: "Operate" },
		]);
		expect(recordsOf(overview, "Milestones")).toEqual([
			{ detail: null, id: "ms-1", title: "Private beta" },
		]);
		expect(recordsOf(overview, "Work")).toEqual([
			{ detail: null, id: "work-1", title: "Create Project" },
		]);
		expect(recordsOf(overview, "Documents")).toEqual([
			{ detail: null, id: "doc-1", title: "Founder notes" },
		]);
		expect(recordsOf(overview, "Decisions")).toEqual([
			{ detail: null, id: "decision-1", title: "Use GitHub login" },
		]);
		expect(recordsOf(overview, "Risks")).toEqual([
			{ detail: null, id: "risk-1", title: "GitHub outage during login" },
		]);
		expect(recordsOf(overview, "Tests")).toEqual([
			{ detail: "Test Handoff", id: "handoff-1", title: "Manual capture pass" },
			{ detail: "Test Session", id: "session-1", title: "2026-08-20 session" },
			{ detail: "Test Gap", id: "gap-1", title: "No session for capture" },
		]);
		expect(recordsOf(overview, "Production")).toEqual([
			{ detail: null, id: "inc-1", title: "Login outage" },
		]);
		expect(recordsOf(overview, "Blockers")).toEqual([
			{ detail: null, id: "blocker-1", title: "Waiting on GitHub App" },
		]);
		expect(recordsOf(overview, "Dates")).toEqual([
			{ detail: "2026-09-01", id: "project-atlas", title: "Atlas" },
		]);
		expect(recordsOf(overview, "Recent changes")).toEqual([
			{
				detail: "2026-08-26T12:00:00.000Z",
				id: "change-1",
				title: "Renamed Short code",
			},
		]);
	});

	it("does not add a health score, traffic-light, or success narrative field", () => {
		const overview = projectOverview(
			sourcesFrom({
				...ATLAS,
				purpose: "Keep the summary factual",
			})
		);
		const keys = collectKeys(overview);
		for (const key of HEALTH_KEYS) {
			expect(keys).not.toContain(key);
		}
		expect(headingsOf(overview)).not.toEqual(
			expect.arrayContaining(["Health", "On Track", "At Risk", "Off Track"])
		);
	});

	it("does not mix Workspace overview, Value Chain, or Manual Project Update into this surface", () => {
		const overview = projectOverview(sourcesFrom(ATLAS));
		const headings = headingsOf(overview);
		for (const heading of FORBIDDEN_HEADINGS) {
			expect(headings).not.toContain(heading);
		}
		expect(JSON.stringify(overview)).not.toMatch(FORBIDDEN_SURFACE_PATTERN);
	});

	it("summarizes Test Handoff, Test Session, and Test Gap sources without a Tests area product", () => {
		const overview = projectOverview(
			sourcesFrom(ATLAS, {
				testHandoffs: [{ id: "handoff-1", title: "Manual capture pass" }],
			})
		);
		expect(recordsOf(overview, "Tests")).toEqual([
			{ detail: "Test Handoff", id: "handoff-1", title: "Manual capture pass" },
		]);
		expect(collectKeys(overview)).not.toContain("plannedTestCases");
		expect(JSON.stringify(overview)).not.toMatch(TESTS_AREA_PRODUCT_PATTERN);
		expect(headingsOf(overview)).not.toContain("Test Plan");
	});

	it("keeps Goals as a named Overview entry and not a hideable Project area", () => {
		const overview = projectOverview(
			sourcesFrom(ATLAS, {
				goals: [{ id: "goal-1", title: "Reach İlk Proje" }],
			})
		);
		expect(headingsOf(overview)).toContain("Goals");
		expect(recordsOf(overview, "Goals")).toEqual([
			{ detail: null, id: "goal-1", title: "Reach İlk Proje" },
		]);
		expect(PROJECT_AREAS).not.toContain("Goals");
	});

	it("does not add an Open Question uncertainty or health module", () => {
		const overview = projectOverview(sourcesFrom(ATLAS));
		expect(headingsOf(overview)).not.toContain("Open Question");
		expect(collectKeys(overview)).not.toContain("openQuestions");
		expect(collectKeys(overview)).not.toContain("qualitativeUncertainty");
	});
});
