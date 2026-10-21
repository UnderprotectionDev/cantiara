// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project and the selected Planned Test Case.
import type {
  PlannedTestRelationTargetType,
  TestHandoffContextKind,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type CaseFormValues,
  toRelationInputs,
} from "../../lib/planned-test-form";
import { toHandoffInput } from "../../lib/test-handoff-form";
import { PlannedTestsView } from "../views/planned-tests-view";
import { SessionTestsView } from "../views/session-tests-view";
import { TestHandoffsView } from "../views/test-handoffs-view";

function definition(values: CaseFormValues) {
  return {
    expectedBehavior: values.expectedBehavior,
    notes: values.notes,
    preconditions: values.preconditions,
    purpose: values.purpose,
    relations: toRelationInputs(values.relations),
    scope: values.scope,
    title: values.title,
  };
}

/** The Tests area's Planned Test Case list; it starts, schedules and runs nothing. */
export default function PlannedTestsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectPlannedTestCases.queryOptions({
    input: { projectId },
  });
  const cases = useQuery(options);
  const sessionOptions = orpc.projectSessionTests.queryOptions({
    input: { projectId },
  });
  const sessionTests = useQuery(sessionOptions);
  const handoffOptions = orpc.projectTestHandoffs.queryOptions({
    input: { projectId },
  });
  const handoffs = useQuery(handoffOptions);
  const refreshHandoffs = () =>
    queryClient.invalidateQueries({ queryKey: handoffOptions.queryKey });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  const refreshSessionTests = () =>
    queryClient.invalidateQueries({ queryKey: sessionOptions.queryKey });
  const loadTargets = useCallback(
    (targetType: PlannedTestRelationTargetType) =>
      client.plannedTestRelationTargets({ projectId, targetType }),
    [projectId],
  );
  const loadContextTargets = useCallback(
    (kind: TestHandoffContextKind) =>
      client.testHandoffContextTargets({ kind, projectId }),
    [projectId],
  );
  const loadPackages = useCallback(
    async (handoff: { id: string }) =>
      (
        await client.projectTestHandoffPackages({
          handoffId: handoff.id,
          projectId,
        })
      ).packages,
    [projectId],
  );
  if (cases.isPending) {
    return <p role="status">Loading Planned Test Cases…</p>;
  }
  if (!cases.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Planned Test Cases are unavailable.</p>
        <Button onClick={() => cases.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <PlannedTestsView
        cases={cases.data.cases}
        loadTargets={loadTargets}
        onCreate={async (values) => {
          await runOnlineOnlyWrite(() =>
            client.createPlannedTestCase({ projectId, ...definition(values) }),
          );
          await refresh();
        }}
        onCreateVersion={async (record, values) => {
          try {
            await runOnlineOnlyWrite(() =>
              client.createPlannedTestCaseVersion({
                caseId: record.id,
                changeKind: values.changeKind,
                expectedVersion: record.current.version,
                projectId,
                ...definition(values),
              }),
            );
          } finally {
            await refresh();
          }
        }}
        readOnly={cases.data.readOnly}
      />
      {handoffs.isPending || sessionTests.isPending ? (
        <p role="status">Loading Test Handoffs…</p>
      ) : null}
      {handoffs.data && sessionTests.data ? (
        <TestHandoffsView
          cases={cases.data.cases}
          handoffs={handoffs.data.handoffs}
          loadContextTargets={loadContextTargets}
          loadPackages={loadPackages}
          onCreate={async (values) => {
            await runOnlineOnlyWrite(() =>
              client.createTestHandoff({
                projectId,
                ...toHandoffInput(values, cases.data.cases),
              }),
            );
            await refreshHandoffs();
          }}
          onLink={async (handoff, sessionTestId) => {
            try {
              await runOnlineOnlyWrite(() =>
                client.linkTestHandoffSessionTest({
                  handoffId: handoff.id,
                  projectId,
                  sessionTestId,
                }),
              );
            } finally {
              await refreshHandoffs();
            }
          }}
          onPreviewPackage={(handoff) =>
            client.previewTestHandoffPackage({
              handoffId: handoff.id,
              projectId,
            })
          }
          onProducePackage={async (handoff, preview) => {
            try {
              return await runOnlineOnlyWrite(() =>
                client.produceTestHandoffPackage({
                  expectedPackageVersion: preview.nextPackageVersion,
                  handoffId: handoff.id,
                  previewFingerprint: preview.fingerprint ?? "",
                  projectId,
                }),
              );
            } finally {
              await refreshHandoffs();
            }
          }}
          onTransition={async (handoff, to) => {
            try {
              await runOnlineOnlyWrite(() =>
                client.transitionTestHandoff({
                  expectedState: handoff.state,
                  handoffId: handoff.id,
                  projectId,
                  to,
                }),
              );
            } finally {
              await refreshHandoffs();
            }
          }}
          onUpdate={async (handoff, values) => {
            try {
              await runOnlineOnlyWrite(() =>
                client.updateTestHandoff({
                  handoffId: handoff.id,
                  projectId,
                  ...toHandoffInput(values, cases.data.cases),
                }),
              );
            } finally {
              await refreshHandoffs();
            }
          }}
          readOnly={handoffs.data.readOnly}
          sessionTests={sessionTests.data.sessionTests}
        />
      ) : null}
      {handoffs.isPending ||
      sessionTests.isPending ||
      (handoffs.data && sessionTests.data) ? null : (
        <div className="space-y-3">
          <p role="alert">Test Handoffs are unavailable.</p>
          <Button
            onClick={() => {
              handoffs.refetch().catch(() => undefined);
              sessionTests.refetch().catch(() => undefined);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {sessionTests.isPending ? (
        <p role="status">Loading Session Tests…</p>
      ) : null}
      {sessionTests.data ? (
        <SessionTestsView
          cases={cases.data.cases}
          onLink={async (sessionTestId, ref) => {
            try {
              await runOnlineOnlyWrite(() =>
                client.linkSessionTest({ ...ref, projectId, sessionTestId }),
              );
            } finally {
              await refreshSessionTests();
            }
          }}
          onRecord={async (values) => {
            await runOnlineOnlyWrite(() =>
              client.recordSessionTest(
                values.binding
                  ? {
                      binding: values.binding,
                      projectId,
                      title: values.title,
                    }
                  : {
                      expectedBehavior: values.expectedBehavior,
                      projectId,
                      purpose: values.purpose,
                      title: values.title,
                    },
              ),
            );
            await refreshSessionTests();
          }}
          readOnly={sessionTests.data.readOnly}
          sessionTests={sessionTests.data.sessionTests}
        />
      ) : null}
      {sessionTests.isPending || sessionTests.data ? null : (
        <div className="space-y-3">
          <p role="alert">Session Tests are unavailable.</p>
          <Button onClick={() => sessionTests.refetch().catch(() => undefined)}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
