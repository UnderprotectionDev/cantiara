// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.

import type {
  PlannedTestCaseRecord,
  SessionTestRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";
import type { TestGapRecord } from "@cantiara/api/test-gaps";
import { AppLink } from "@/components/app-link";
import { relationLabel } from "../../lib/test-gap-form";
import type { LoadGapRelationTargets } from "../components/test-gap-relations-field";

import {
  CloseForm,
  type CloseGap,
  GapForm,
  type LoadDecisions,
  PlanningControls,
  type PlanWithCase,
  type PlanWithHandoff,
  type SubmitGap,
} from "../forms/test-gap-form";

function ClosureDetails({ record }: { record: TestGapRecord }) {
  const { closure } = record;
  if (!closure) {
    return null;
  }
  return (
    <div>
      <dt className="font-medium">Closure</dt>
      <dd className="space-y-1">
        <p>{closure.outcome}</p>
        {closure.rationale ? (
          <p className="whitespace-pre-wrap">{closure.rationale}</p>
        ) : null}
        {closure.sessionTests.length > 0 ? (
          <ul aria-label="Session Tests that met this Test Gap">
            {closure.sessionTests.map((item) => (
              <li key={item.id}>{`Session Test: ${item.title}`}</li>
            ))}
          </ul>
        ) : null}
        {closure.decision ? (
          <p>
            {closure.decision.state === "resolved"
              ? `Decision: ${closure.decision.label}`
              : `Decision: unavailable (${closure.decision.brokenReason ?? "No access"})`}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

function GapItem({
  cases,
  handoffs,
  loadDecisions,
  onClose,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  record,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  loadDecisions: LoadDecisions;
  onClose: CloseGap;
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  record: TestGapRecord;
  sessionTests: SessionTestRecord[];
}) {
  return (
    <li
      className="space-y-2 rounded-lg border border-border/70 p-4"
      id={`source-test-gap-${record.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{record.title}</h4>
        <span className="rounded-md border border-border/70 px-2 py-0.5 text-sm">
          {record.state}
        </span>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Rationale</dt>
          <dd className="whitespace-pre-wrap">{record.rationale}</dd>
        </div>
        <div>
          <dt className="font-medium">Support relations</dt>
          <dd>
            {record.relations.length === 0 ? (
              "No support relations."
            ) : (
              <ul>
                {record.relations.map((relation) => (
                  <li key={relation.id}>{relationLabel(relation)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Planning</dt>
          <dd>
            <PlanningControls
              cases={cases}
              handoffs={handoffs}
              onPlanCase={onPlanCase}
              onPlanHandoff={onPlanHandoff}
              onUnplanCase={onUnplanCase}
              onUnplanHandoff={onUnplanHandoff}
              readOnly={readOnly || record.closure !== null}
              record={record}
            />
          </dd>
        </div>
        <ClosureDetails record={record} />
      </dl>
      {readOnly || record.closure ? null : (
        <CloseForm
          loadDecisions={loadDecisions}
          onClose={onClose}
          record={record}
          sessionTests={sessionTests}
        />
      )}
    </li>
  );
}

/**
 * The Tests area's derived count (spec 55 story 17). The number is read from
 * the same records the list shows, and opening the count reveals exactly the
 * `Open`/`Planned` records that produced it — never a coverage figure.
 */
function OpenAndPlannedGaps({ gaps }: { gaps: TestGapRecord[] }) {
  const openAndPlanned = gaps.filter(
    (gap) => gap.state === "Open" || gap.state === "Planned",
  );
  return (
    <details className="rounded-md border border-border/70 p-3">
      <summary className="cursor-pointer font-medium">
        {`Open and planned Test Gaps: ${openAndPlanned.length}`}
      </summary>
      {openAndPlanned.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No open or planned Test Gaps.
        </p>
      ) : (
        <ul aria-label="Test Gaps in this count" className="space-y-1 text-sm">
          {openAndPlanned.map((gap) => (
            <li key={gap.id}>
              <AppLink
                aria-label={`Open ${gap.title}`}
                className="underline"
                href={`#source-test-gap-${gap.id}`}
              >
                {gap.title}
              </AppLink>
              {` (${gap.state})`}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/**
 * The Tests area's Test Gap list. A management view of records the founder
 * filed: not a phase, a runner or a coverage figure, and nothing here files a
 * Gap on its own.
 */
export function TestGapsView({
  cases,
  gaps,
  handoffs,
  loadDecisions,
  loadTargets,
  onClose,
  onCreate,
  onPlanCase,
  onPlanHandoff,
  onUnplanCase,
  onUnplanHandoff,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  gaps: TestGapRecord[];
  handoffs: TestHandoffRecord[];
  loadDecisions: LoadDecisions;
  loadTargets: LoadGapRelationTargets;
  onClose: CloseGap;
  onCreate: SubmitGap;
  onPlanCase: PlanWithCase;
  onPlanHandoff: PlanWithHandoff;
  onUnplanCase: PlanWithCase;
  onUnplanHandoff: PlanWithHandoff;
  readOnly: boolean;
  sessionTests: SessionTestRecord[];
}) {
  return (
    <section aria-labelledby="test-gaps-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="test-gaps-heading">
        Test Gaps
      </h2>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived. Test Gaps are read-only.
        </p>
      ) : (
        <GapForm loadTargets={loadTargets} onSubmit={onCreate} />
      )}
      <OpenAndPlannedGaps gaps={gaps} />
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Test Gaps filed.</p>
      ) : (
        <ul aria-label="Test Gaps" className="space-y-3">
          {gaps.map((record) => (
            <GapItem
              cases={cases}
              handoffs={handoffs}
              key={record.id}
              loadDecisions={loadDecisions}
              onClose={onClose}
              onPlanCase={onPlanCase}
              onPlanHandoff={onPlanHandoff}
              onUnplanCase={onUnplanCase}
              onUnplanHandoff={onUnplanHandoff}
              readOnly={readOnly}
              record={record}
              sessionTests={sessionTests}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
