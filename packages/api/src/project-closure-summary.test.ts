import { describe, expect, test } from "vitest";

import {
  CLOSURE_SUMMARY_DRAFT_NOTE,
  type ClosureSummaryCandidate,
  closureSummaryDraftInputSchema,
  deriveClosureSummaryPreview,
  groupClosureSummaryCandidates,
  PROJECT_CLOSURE_SUMMARY_LABEL,
  renderClosureSummaryMarkdown,
  saveClosureSummaryInputSchema,
} from "./project-closure-summary";

const DRAFT_LINE = /^(## [A-Za-z ]+|- \[.*\]\(\S+\))$/;

const candidate = (
  recordType: ClosureSummaryCandidate["recordType"],
  recordId: string,
  label: string,
): ClosureSummaryCandidate => ({ label, recordId, recordType });

const hrefOf = (source: ClosureSummaryCandidate) =>
  `/projects/p1#${source.recordType}-${source.recordId}`;

describe("Project Closure Summary contract", () => {
  test("lists a group for every source type with Completed Work last", () => {
    const groups = groupClosureSummaryCandidates([
      candidate("Work", "w1", "P-1 Ship"),
    ]);
    expect(groups.map((group) => group.heading)).toEqual([
      "Decisions",
      "Risks",
      "Project Releases",
      "Documents",
      "Production Incidents",
      "Completed Work",
    ]);
  });

  test("previews which source lands under which heading", () => {
    const preview = deriveClosureSummaryPreview("p1", [
      candidate("Work", "w1", "P-1 Ship"),
      candidate("Decision", "d1", "Use Postgres"),
      candidate("Decision", "d1", "Use Postgres"),
    ]);
    expect(
      preview.sections.map((section) => [
        section.heading,
        section.sources.map((source) => source.recordId),
      ]),
    ).toEqual([
      ["Decisions", ["d1"]],
      ["Completed Work", ["w1"]],
    ]);
  });

  test("renders only headings and readable links, no narrative", () => {
    const preview = deriveClosureSummaryPreview("p1", [
      candidate("Decision", "d1", "Use [Postgres] (v2)"),
      candidate("Risk", "r1", "Vendor lock-in"),
    ]);
    const markdown = renderClosureSummaryMarkdown(preview.sections, hrefOf);
    expect(markdown).toBe(
      [
        "## Decisions",
        "",
        "- [Use \\[Postgres\\] (v2)](/projects/p1#Decision-d1)",
        "",
        "## Risks",
        "",
        "- [Vendor lock-in](/projects/p1#Risk-r1)",
      ].join("\n"),
    );
    for (const line of markdown.split("\n").filter(Boolean)) {
      expect(line).toMatch(DRAFT_LINE);
    }
  });

  test("an empty selection renders an empty draft", () => {
    expect(
      renderClosureSummaryMarkdown(
        deriveClosureSummaryPreview("p1", []).sections,
        hrefOf,
      ),
    ).toBe("");
  });

  test("the draft note promises no conclusions and the input is strict", () => {
    expect(CLOSURE_SUMMARY_DRAFT_NOTE).toBe(
      "The draft contains only headings and links to your records. It writes no conclusions.",
    );
    expect(
      closureSummaryDraftInputSchema.safeParse({
        projectId: "p1",
        sources: [],
        summary: "A great success",
      }).success,
    ).toBe(false);
  });

  test("save defaults the title only when omitted and rejects a blank one", () => {
    const base = {
      baseRevision: 0,
      body: "",
      clientIdempotencyKey: "k1",
      projectId: "p1",
    };
    expect(saveClosureSummaryInputSchema.parse(base).title).toBe(
      PROJECT_CLOSURE_SUMMARY_LABEL,
    );
    for (const title of ["", "   "]) {
      expect(
        saveClosureSummaryInputSchema.safeParse({ ...base, title }).success,
      ).toBe(false);
    }
  });
});
