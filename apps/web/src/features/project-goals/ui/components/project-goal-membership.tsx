import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commandVariables } from "@/lib/command-variables";
import { client, orpc } from "@/utils/orpc";
import type { GoalRelationChange } from "../../lib/goal-relation-selection";
import { ProjectGoalMembershipView } from "./project-goal-membership-panel";

export default function ProjectGoalMembership({
  projectId,
  goalId,
}: {
  projectId: string;
  goalId: string;
}) {
  const setProjectGoalRelationMutation = useMutation(
    orpc.setProjectGoalRelation.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setProjectGoalRelation(input),
      onSuccess: (_, { projectId: targetProject, goalId: id }) =>
        queryClient.invalidateQueries({
          queryKey: orpc.projectGoalDetail.queryKey({
            input: { projectId: targetProject, id },
          }),
        }),
    }),
  );
  const options = orpc.projectGoalDetail.queryOptions({
    input: { projectId, id: goalId },
  });
  const detail = useQuery(options);
  const queryClient = useQueryClient();
  async function setRelation(change: GoalRelationChange) {
    const payload = {
      projectId,
      goalId,
      memberId: change.source.recordId,
      memberType: change.source.recordType,
      kind: change.kind,
      attached: change.attached,
      baseRevision: change.baseRevision,
    };
    await setProjectGoalRelationMutation.mutateAsync(
      commandVariables(
        payload,
        setProjectGoalRelationMutation.isError
          ? setProjectGoalRelationMutation.variables
          : undefined,
      ),
    );
  }
  function retry() {
    detail.refetch().catch(() => undefined);
  }
  if (detail.status === "pending") {
    return <p role="status">Loading live summary…</p>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div>
        <p role="alert">Live summary is unavailable.</p>
        <Button onClick={retry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    );
  }
  return (
    <ProjectGoalMembershipView
      detail={detail.data}
      failed={setProjectGoalRelationMutation.isError}
      onSetRelation={setRelation}
      pending={setProjectGoalRelationMutation.isPending}
      projectId={projectId}
      saved={
        setProjectGoalRelationMutation.isSuccess
          ? {
              attached: setProjectGoalRelationMutation.variables.attached,
              at: setProjectGoalRelationMutation.submittedAt,
            }
          : undefined
      }
    />
  );
}
