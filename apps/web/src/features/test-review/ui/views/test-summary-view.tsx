// biome-ignore-all lint/performance/noJsxPropsBind: Rows toggle their own record list.

import {
  resultLabel,
  technicalContextUnknown,
} from "@cantiara/api/test-review-signals";
import {
  TEST_SUMMARY_ATTENTION_LABEL,
  TEST_SUMMARY_GITHUB_NOTE,
  TEST_SUMMARY_LABEL,
  TEST_SUMMARY_NEUTRAL_NOTE,
  TESTS_OVERVIEW_LABEL,
  type TestSummary,
  type TestSummaryProvenance,
  type TestSummaryRecord,
  type TestSummarySection,
} from "@cantiara/api/test-review-summary";
import { useId, useState } from "react";
import { AppLink } from "@/components/app-link";
import {
  projectSourceRecordHash,
  testGapRecordHash,
  testsAreaRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

const PROJECT_INTRODUCTION =
  "Live sections over existing records. Each number opens the records behind it. This is not a phase or a CI dashboard.";

/** Where a summary record opens: its owner record, never a copy. */
export function summaryRecordHref(
  projectId: string,
  record: Pick<TestSummaryRecord, "id" | "kind"> & {
    provenance?: { sessionId: string } | null;
  },
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  switch (record.kind) {
    case "Feature":
    case "Follow-up Work":
      return `${base}${workRecordHash(record.id)}`;
    case "Project Release":
      return `${base}${projectSourceRecordHash("Project Release", record.id)}`;
    case "Test Gap":
      return `${base}${testGapRecordHash(record.id)}`;
    case "Session Test":
      return `${base}${testsAreaRecordHash("Test Session", record.provenance?.sessionId ?? record.id)}`;
    default:
      return `${base}${testsAreaRecordHash(record.kind, record.id)}`;
  }
}

function Provenance({
  projectId,
  provenance,
}: {
  projectId: string;
  provenance: TestSummaryProvenance;
}) {
  const context = Object.entries(provenance.context ?? {});
  return (
    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
      <dt>Raw result</dt>
      <dd>{provenance.rawResult ?? "Redacted"}</dd>
      <dt>Normalized result</dt>
      <dd>{provenance.normalizedResult ?? "Not reported"}</dd>
      {provenance.currentResult === provenance.normalizedResult ? null : (
        <>
          <dt>Current result</dt>
          <dd>{resultLabel(provenance.currentResult)}</dd>
        </>
      )}
      <dt>Source session</dt>
      <dd>
        <AppLink
          className="underline underline-offset-2"
          href={`/projects/${encodeURIComponent(projectId)}#${testsAreaRecordHash("Test Session", provenance.sessionId)}`}
        >
          Open Test Session
        </AppLink>
      </dd>
      <dt>Executor</dt>
      <dd>{provenance.executorName}</dd>
      <dt>Reporter</dt>
      <dd>{provenance.reporter ?? "Unknown"}</dd>
      <dt>Reported</dt>
      <dd>{provenance.reportedAt}</dd>
      <dt>Technical context</dt>
      <dd>
        {technicalContextUnknown(provenance.context) && context.length === 0
          ? "Technical context: unknown"
          : context.map(([key, value]) => `${key}: ${value}`).join(", ")}
      </dd>
    </dl>
  );
}

function RecordRow({
  projectId,
  record,
}: {
  projectId: string;
  record: TestSummaryRecord;
}) {
  return (
    <li className="py-1.5">
      <AppLink
        className="font-medium underline underline-offset-2"
        href={summaryRecordHref(projectId, record)}
      >
        {record.label || record.id}
      </AppLink>{" "}
      <span className="text-muted-foreground text-xs">
        {record.kind}
        {record.detail ? ` · ${record.detail}` : ""}
      </span>
      {record.provenance ? (
        <Provenance projectId={projectId} provenance={record.provenance} />
      ) : null}
    </li>
  );
}

/** One count that opens exactly the records it counts, with the filters used. */
function SectionRow({
  projectId,
  section,
}: {
  projectId: string;
  section: TestSummarySection;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = section.records.length;
  return (
    <li className="rounded-md border border-border/70 px-3 py-2">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left text-sm"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="font-medium">{section.label}</span>
        <span className="tabular-nums">{count}</span>
      </button>
      {open ? (
        <section
          aria-label={`${section.label} records`}
          className="mt-2 space-y-2 text-sm"
          id={panelId}
        >
          <p className="text-muted-foreground text-xs">
            Filters:{" "}
            {section.filters
              .map((filter) => `${filter.label}: ${filter.value}`)
              .join("; ")}
          </p>
          {count === 0 ? (
            <p className="text-muted-foreground">No records.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {section.records.map((record) => (
                <RecordRow
                  key={`${record.kind}:${record.id}`}
                  projectId={projectId}
                  record={record}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </li>
  );
}

function SectionList({
  label,
  projectId,
  sections,
}: {
  label: string;
  projectId: string;
  sections: TestSummarySection[];
}) {
  return (
    <ul aria-label={label} className="space-y-2">
      {sections.map((section) => (
        <SectionRow key={section.key} projectId={projectId} section={section} />
      ))}
    </ul>
  );
}

/**
 * The live neutral Test Summary of a Feature or Project Release, or the Tests
 * overview of a Project. Every count opens its exact records. There is no
 * score, coverage, pass/fail verdict, waiver or release gate here, GitHub
 * checks are never Test Sessions, and nothing on this surface writes a record.
 */
export function TestSummaryView({
  projectId,
  summary,
}: {
  projectId: string;
  summary: TestSummary;
}) {
  const headingId = useId();
  const isProject = summary.scope.kind === "Project";
  const introduction = isProject
    ? PROJECT_INTRODUCTION
    : TEST_SUMMARY_NEUTRAL_NOTE;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3"
      id={isProject ? "tests-overview" : undefined}
    >
      <h3 className="font-semibold text-base" id={headingId}>
        {isProject
          ? TESTS_OVERVIEW_LABEL
          : `${TEST_SUMMARY_LABEL}: ${summary.scope.label}`}
      </h3>
      <p className="text-muted-foreground text-sm">{introduction}</p>
      {isProject ? null : (
        <p className="text-muted-foreground text-sm">
          {TEST_SUMMARY_GITHUB_NOTE}
        </p>
      )}
      <SectionList
        label={isProject ? TESTS_OVERVIEW_LABEL : TEST_SUMMARY_LABEL}
        projectId={projectId}
        sections={summary.sections}
      />
      {isProject ? null : (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">
            {TEST_SUMMARY_ATTENTION_LABEL}
          </h4>
          {summary.attention.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing needs attention in the related records.
            </p>
          ) : (
            <SectionList
              label={TEST_SUMMARY_ATTENTION_LABEL}
              projectId={projectId}
              sections={summary.attention}
            />
          )}
        </div>
      )}
    </section>
  );
}
