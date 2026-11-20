// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project and the selected Planned Test Case.
import type {
  PlannedTestRelationTargetType,
  TestHandoffContextKind,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
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
  const createPlannedTestCaseMutation = useMutation(
    orpc.createPlannedTestCase.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createPlannedTestCase(input),
      onSuccess: () => refresh(),
    }),
  );
  const createTestHandoffMutation = useMutation(
    orpc.createTestHandoff.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createTestHandoff(input),
      onSuccess: () => refreshHandoffs(),
    }),
  );
  const linkTestHandoffSessionTestMutation = useMutation(
    orpc.linkTestHandoffSessionTest.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.linkTestHandoffSessionTest(input),
      onSettled: () => refreshHandoffs(),
    }),
  );
  const updateTestHandoffMutation = useMutation(
    orpc.updateTestHandoff.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateTestHandoff(input),
      onSettled: () => refreshHandoffs(),
    }),
  );
  const linkSessionTestMutation = useMutation(
    orpc.linkSessionTest.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.linkSessionTest(input),
      onSettled: () => refreshSessionTests(),
    }),
  );
  const recordSessionTestMutation = useMutation(
    orpc.recordSessionTest.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordSessionTest(input),
      onSuccess: () => refreshSessionTests(),
    }),
  );
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
  // The Test Summary reads this area's records, so it is read again with them.
  const refreshSummary = () =>
    queryClient.invalidateQueries({ queryKey: orpc.projectTestSummary.key() });
  const refreshHandoffs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: handoffOptions.queryKey }),
      refreshSummary(),
    ]);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      refreshSummary(),
    ]);
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
  if (cases.status === "pending") {
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
          await createPlannedTestCaseMutation.mutateAsync({
            projectId,
            ...definition(values),
          });
        }}
        onCreateVersion={async (record, values) => {
          await client.createPlannedTestCaseVersion({
            caseId: record.id,
            changeKind: values.changeKind,
            expectedVersion: record.current.version,
            projectId,
            ...definition(values),
          });
        }}
        projectId={projectId}
        readOnly={cases.data.readOnly}
      />
      {handoffs.status === "pending" || sessionTests.isPending ? (
        <p role="status">Loading Test Handoffs…</p>
      ) : null}
      {handoffs.data && sessionTests.data ? (
        <TestHandoffsView
          cases={cases.data.cases}
          handoffs={handoffs.data.handoffs}
          loadContextTargets={loadContextTargets}
          loadPackages={loadPackages}
          onCreate={async (values) => {
            await createTestHandoffMutation.mutateAsync({
              projectId,
              ...toHandoffInput(values, cases.data.cases),
            });
          }}
          onLink={async (handoff, sessionTestId) => {
            await linkTestHandoffSessionTestMutation.mutateAsync({
              handoffId: handoff.id,
              projectId,
              sessionTestId,
            });
          }}
          onPreviewPackage={(handoff) =>
            client.previewTestHandoffPackage({
              handoffId: handoff.id,
              projectId,
            })
          }
          onProducePackage={(handoff, preview) =>
            client.produceTestHandoffPackage({
              expectedPackageVersion: preview.nextPackageVersion,
              handoffId: handoff.id,
              previewFingerprint: preview.fingerprint ?? "",
              projectId,
            })
          }
          onTransition={async (handoff, to) => {
            await client.transitionTestHandoff({
              expectedState: handoff.state,
              handoffId: handoff.id,
              projectId,
              to,
            });
          }}
          onUpdate={async (handoff, values) => {
            await updateTestHandoffMutation.mutateAsync({
              handoffId: handoff.id,
              projectId,
              ...toHandoffInput(values, cases.data.cases),
            });
          }}
          projectId={projectId}
          readOnly={handoffs.data.readOnly}
          sessionTests={sessionTests.data.sessionTests}
        />
      ) : null}
      {handoffs.status === "pending" ||
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
      {sessionTests.status === "pending" ? (
        <p role="status">Loading Session Tests…</p>
      ) : null}
      {sessionTests.data ? (
        <SessionTestsView
          cases={cases.data.cases}
          onLink={async (sessionTestId, ref) => {
            await linkSessionTestMutation.mutateAsync({
              ...ref,
              projectId,
              sessionTestId,
            });
          }}
          onRecord={async (values) => {
            await recordSessionTestMutation.mutateAsync(
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
            );
          }}
          readOnly={sessionTests.data.readOnly}
          sessionTests={sessionTests.data.sessionTests}
        />
      ) : null}
      {sessionTests.status === "pending" || sessionTests.data ? null : (
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
