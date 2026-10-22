// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Test Handoff and form fields.
import {
  type PlannedTestCaseRecord,
  SESSION_TEST_LABEL,
  TEST_HANDOFF_LABEL,
  type TestHandoffRecord,
  type TestHandoffState,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { errorText } from "../../lib/error-text";
import {
  describeContextRef,
  EMPTY_TEST_HANDOFF_FORM,
  formFromHandoff,
  type TestHandoffFormValues,
} from "../../lib/test-handoff-form";
import type { LoadTestHandoffContextTargets } from "../components/test-handoff-context-field";
import {
  type LoadTestHandoffPackages,
  type PreviewTestHandoffPackage,
  type ProduceTestHandoffPackage,
  TestHandoffPackagePanel,
} from "../components/test-handoff-package-panel";
import {
  HandoffForm,
  LinkArrivingSessionTestForm,
  type LinkTestHandoffSessionTest,
  type SubmitTestHandoff,
} from "../forms/test-handoff-form";

export type TransitionTestHandoff = (
  handoff: TestHandoffRecord,
  to: TestHandoffState,
) => Promise<unknown>;
const CONTEXT_LABELS = [
  ["repository", "Repository"],
  ["branch", "Branch"],
  ["commit", "Commit"],
  ["build", "Build"],
  ["targetEnvironment", "Target environment"],
] as const;

function TransitionControls({
  handoff,
  onTransition,
}: {
  handoff: TestHandoffRecord;
  onTransition: TransitionTestHandoff;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function move(to: TestHandoffState) {
    setError(undefined);
    setPending(true);
    try {
      await onTransition(handoff, to);
    } catch (caught) {
      setError(errorText(caught, `${TEST_HANDOFF_LABEL} did not change.`));
    } finally {
      setPending(false);
    }
  }
  const suggested = handoff.suggestion?.state;
  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {handoff.allowedTransitions.length > 0 ? (
        <>
          <ul
            aria-label={`Change the state of ${handoff.title}`}
            className="flex flex-wrap gap-2"
          >
            {handoff.allowedTransitions.map((to) => (
              <li key={to}>
                <Button
                  disabled={pending}
                  onClick={() => move(to)}
                  size="sm"
                  type="button"
                  variant={to === suggested ? "default" : "outline"}
                >
                  {`Mark as ${to}`}
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Changes only this record. Nothing outside the product is started,
            stopped or contacted.
          </p>
        </>
      ) : null}
    </div>
  );
}

function HandoffItem({
  cases,
  linkable,
  loadContextTargets,
  loadPackages,
  onLink,
  onPreviewPackage,
  onProducePackage,
  onTransition,
  onUpdate,
  readOnly,
  handoff,
}: {
  cases: PlannedTestCaseRecord[];
  handoff: TestHandoffRecord;
  linkable: TestHandoffRecord["sessionTests"];
  loadContextTargets: LoadTestHandoffContextTargets;
  loadPackages: LoadTestHandoffPackages;
  onLink: LinkTestHandoffSessionTest;
  onPreviewPackage: PreviewTestHandoffPackage;
  onProducePackage: ProduceTestHandoffPackage;
  onTransition: TransitionTestHandoff;
  onUpdate: (
    handoff: TestHandoffRecord,
    values: TestHandoffFormValues,
  ) => Promise<unknown>;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const filled = CONTEXT_LABELS.filter(
    ([key]) => handoff.buildContext[key] !== null,
  );
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`test-handoff-${handoff.id}`}
    >
      <h4 className="font-medium">{handoff.title}</h4>
      <p className="text-sm">
        <span className="font-medium">State: </span>
        {handoff.state}
      </p>
      {handoff.suggestion ? (
        <p
          className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm"
          role="status"
        >
          {handoff.suggestion.reason}
        </p>
      ) : null}
      {handoff.resultAfterCancel ? (
        <p
          className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm"
          role="status"
        >
          Result arrived after cancel. The Test Handoff stays Canceled.
        </p>
      ) : null}
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="font-medium">Purpose and scope</dt>
          <dd className="whitespace-pre-wrap">{handoff.purpose}</dd>
        </div>
        {handoff.dueDate ? (
          <div>
            <dt className="font-medium">Due date</dt>
            <dd>{handoff.dueDate}</dd>
          </div>
        ) : null}
        {handoff.targetExecutor ? (
          <div>
            <dt className="font-medium">Target executor</dt>
            <dd>{handoff.targetExecutor}</dd>
          </div>
        ) : null}
        {filled.map(([key, name]) => (
          <div key={key}>
            <dt className="font-medium">{name}</dt>
            <dd>{handoff.buildContext[key]}</dd>
          </div>
        ))}
        <div>
          <dt className="font-medium">Package version</dt>
          <dd>
            {handoff.packageVersion === 0
              ? "No package produced yet"
              : handoff.packageVersion}
          </dd>
        </div>
      </dl>
      {handoff.environmentPreconditions ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Environment preconditions</p>
          <p className="whitespace-pre-wrap">
            {handoff.environmentPreconditions}
          </p>
        </div>
      ) : null}
      {handoff.adHocScope.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Ad hoc scope</p>
          <ul aria-label={`Ad hoc scope of ${handoff.title}`}>
            {handoff.adHocScope.map((item, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Ad hoc items have no identity and are stored and removed by position.
                key={index}
              >
                {`${item.intent} Expected: ${item.expectedBehavior}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {handoff.contextRefs.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Package context</p>
          <ul aria-label={`Package context of ${handoff.title}`}>
            {handoff.contextRefs.map((ref) => (
              <li key={JSON.stringify(ref)}>
                {describeContextRef(ref, ref.label, ref.sectionLabel)}
                {ref.brokenReason
                  ? ` (${ref.brokenReason}: it cannot enter the package until you remove it)`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-1 text-sm">
        <p className="font-medium">Planned Test Case versions</p>
        {handoff.scenarios.length === 0 ? (
          <p className="text-muted-foreground">None selected.</p>
        ) : (
          <ul aria-label={`Versions in ${handoff.title}`}>
            {handoff.scenarios.map((scenario) => (
              <li key={scenario.caseId}>
                {`${scenario.title}: ${scenario.summary}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">{`Linked ${SESSION_TEST_LABEL}s`}</p>
        {handoff.sessionTests.length === 0 ? (
          <p className="text-muted-foreground">None arrived yet.</p>
        ) : (
          <ul aria-label={`Session Tests in ${handoff.title}`}>
            {handoff.sessionTests.map((sessionTest) => (
              <li key={sessionTest.id}>
                {sessionTest.bind
                  ? `${sessionTest.title}, ${sessionTest.bind.summary}`
                  : `${sessionTest.title}, ad hoc`}
              </li>
            ))}
          </ul>
        )}
      </div>
      {readOnly ? null : (
        <>
          <TransitionControls handoff={handoff} onTransition={onTransition} />
          <LinkArrivingSessionTestForm
            candidates={linkable}
            handoff={handoff}
            onLink={onLink}
          />
          {handoff.editable && !editing ? (
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              {`Edit ${handoff.title}`}
            </Button>
          ) : null}
          {editing ? (
            <HandoffForm
              cases={cases}
              idPrefix={`test-handoff-${handoff.id}-edit`}
              initial={formFromHandoff(handoff)}
              label={`Edit ${TEST_HANDOFF_LABEL}`}
              loadContextTargets={loadContextTargets}
              onCancel={() => setEditing(false)}
              onSubmit={async (values) => {
                await onUpdate(handoff, values);
                setEditing(false);
              }}
              submitLabel="Save changes"
            />
          ) : null}
        </>
      )}
      <TestHandoffPackagePanel
        handoff={handoff}
        loadPackages={loadPackages}
        onPreview={onPreviewPackage}
        onProduce={onProducePackage}
        readOnly={readOnly}
      />
    </li>
  );
}

/**
 * Test Handoffs: requested external test work and the Session Tests that come
 * back. States are process labels, never results. The only controls are the
 * founder's own state moves and links; there is no start, run, poll, schedule
 * or remote cancel control, and a linked Session Test only shows a suggestion.
 */
export function TestHandoffsView({
  cases,
  handoffs,
  loadContextTargets,
  loadPackages,
  onCreate,
  onLink,
  onPreviewPackage,
  onProducePackage,
  onTransition,
  onUpdate,
  readOnly,
  sessionTests,
}: {
  cases: PlannedTestCaseRecord[];
  handoffs: TestHandoffRecord[];
  loadContextTargets: LoadTestHandoffContextTargets;
  loadPackages: LoadTestHandoffPackages;
  onCreate: SubmitTestHandoff;
  onLink: LinkTestHandoffSessionTest;
  onPreviewPackage: PreviewTestHandoffPackage;
  onProducePackage: ProduceTestHandoffPackage;
  onTransition: TransitionTestHandoff;
  onUpdate: (
    handoff: TestHandoffRecord,
    values: TestHandoffFormValues,
  ) => Promise<unknown>;
  readOnly: boolean;
  /** Every Session Test of the Project, as candidates to link. */
  sessionTests: TestHandoffRecord["sessionTests"];
}) {
  const arrivedIds = new Set(
    handoffs.flatMap((handoff) => handoff.sessionTests.map(({ id }) => id)),
  );
  return (
    <section
      aria-label={`${TEST_HANDOFF_LABEL}s`}
      className="space-y-6"
      id="test-handoffs"
    >
      <h2 className="font-semibold text-lg">{`${TEST_HANDOFF_LABEL}s`}</h2>
      <p className="text-muted-foreground text-sm">
        A Test Handoff records external test work you asked for and the Session
        Tests that came back. It does not run tests, and it never closes itself.
      </p>
      {readOnly ? null : (
        <HandoffForm
          cases={cases}
          idPrefix="test-handoff-new"
          initial={EMPTY_TEST_HANDOFF_FORM}
          label={`Create ${TEST_HANDOFF_LABEL}`}
          loadContextTargets={loadContextTargets}
          onSubmit={onCreate}
          submitLabel={`Create ${TEST_HANDOFF_LABEL}`}
        />
      )}
      {handoffs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {`No ${TEST_HANDOFF_LABEL}s yet.`}
        </p>
      ) : (
        <ul className="space-y-3">
          {handoffs.map((handoff) => {
            const selected = new Set(
              handoff.scenarios.map(
                ({ caseId, version }) => `${caseId}@${version}`,
              ),
            );
            return (
              <HandoffItem
                cases={cases}
                handoff={handoff}
                key={handoff.id}
                linkable={sessionTests.filter(
                  (candidate) =>
                    !arrivedIds.has(candidate.id) &&
                    (candidate.bind === null ||
                      selected.has(
                        `${candidate.bind.caseId}@${candidate.bind.pinnedVersion}`,
                      )),
                )}
                loadContextTargets={loadContextTargets}
                loadPackages={loadPackages}
                onLink={onLink}
                onPreviewPackage={onPreviewPackage}
                onProducePackage={onProducePackage}
                onTransition={onTransition}
                onUpdate={onUpdate}
                readOnly={readOnly}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
