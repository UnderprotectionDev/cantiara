// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project and the selected Planned Test Case.
import type { PlannedTestRelationTargetType } from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type CaseFormValues,
  toRelationInputs,
} from "../lib/planned-test-form";
import { PlannedTestsView } from "./planned-tests-view";

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
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  const loadTargets = useCallback(
    (targetType: PlannedTestRelationTargetType) =>
      client.plannedTestRelationTargets({ projectId, targetType }),
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
  );
}
