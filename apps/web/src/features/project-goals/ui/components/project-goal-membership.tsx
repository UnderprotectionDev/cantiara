import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
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
    }),
  );
  const options = orpc.projectGoalDetail.queryOptions({
    input: { projectId, id: goalId },
  });
  const detail = useQuery(options);
  const queryClient = useQueryClient();
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
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
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, key: crypto.randomUUID() };
    }
    await setProjectGoalRelationMutation.mutateAsync({
      ...payload,
      clientIdempotencyKey: pending.current?.key ?? "",
    });
    pending.current = null;
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
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
      onSetRelation={setRelation}
      projectId={projectId}
    />
  );
}
