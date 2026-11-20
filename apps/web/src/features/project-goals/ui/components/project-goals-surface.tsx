import {
  type ProjectGoalRecord,
  projectGoalFieldsSchema,
} from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import {
  type ProjectGoalDraft,
  ProjectGoalSaveConflictError,
} from "../forms/project-goal-form";
import ProjectGoalMembership from "./project-goal-membership";
import { ProjectGoalsView } from "./project-goals-view";

export default function ProjectGoalsSurface({
  projectId,
  selectedId,
  valueChainArea,
}: {
  projectId: string;
  selectedId?: string;
  valueChainArea?: (goalId: string) => ReactNode;
}) {
  const updateProjectGoalMutation = useMutation(
    orpc.updateProjectGoal.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.updateProjectGoal(request),
      onSuccess: (_, { id, projectId: targetProject, clientIdempotencyKey }) =>
        refresh(id, targetProject, clientIdempotencyKey),
    }),
  );
  const createProjectGoalMutation = useMutation(
    orpc.createProjectGoal.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.createProjectGoal(request),
      onSuccess: (_, { id, projectId: targetProject, clientIdempotencyKey }) =>
        refresh(id, targetProject, clientIdempotencyKey),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectGoals.queryOptions({ input: { projectId } });
  const goals = useQuery(options);
  const saved =
    createProjectGoalMutation.isSuccess || updateProjectGoalMutation.isSuccess;
  const pendingProjectGoalSave = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  async function refresh(
    goalId: string,
    targetProject: string,
    commandKey: string,
  ) {
    if (pendingProjectGoalSave.current?.key === commandKey) {
      pendingProjectGoalSave.current = null;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.projectGoals.key({
          input: { projectId: targetProject },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectGoal.key({
          input: { id: goalId, projectId: targetProject },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectGoalDetail.key({
          input: { id: goalId, projectId: targetProject },
        }),
      }),
    ]);
  }
  async function save(draft: ProjectGoalDraft, goal?: ProjectGoalRecord) {
    const fields = projectGoalFieldsSchema.parse(draft);
    const fingerprint = JSON.stringify({
      fields,
      goalId: goal?.id,
      revision: goal?.revision,
    });
    if (pendingProjectGoalSave.current?.fingerprint !== fingerprint) {
      pendingProjectGoalSave.current = {
        fingerprint,
        id:
          goal?.id ?? pendingProjectGoalSave.current?.id ?? crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    const { id, key } = pendingProjectGoalSave.current;
    try {
      await (goal
        ? updateProjectGoalMutation.mutateAsync({
            ...fields,
            projectId,
            id,
            baseRevision: goal.revision,
            clientIdempotencyKey: key,
          })
        : createProjectGoalMutation.mutateAsync({
            ...fields,
            projectId,
            id,
            baseRevision: 0,
            clientIdempotencyKey: key,
          }));
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "CONFLICT"
      ) {
        const currentValue = await client
          .projectGoal({
            id,
            projectId,
          })
          .catch(() => null);
        throw new ProjectGoalSaveConflictError(currentValue, { cause: error });
      }
      throw error;
    }
  }
  function retry() {
    goals.refetch().catch(() => undefined);
  }
  function startEditing() {
    pendingProjectGoalSave.current = null;
    createProjectGoalMutation.reset();
    updateProjectGoalMutation.reset();
  }
  if (goals.status === "pending") {
    return <p role="status">Loading Goals…</p>;
  }
  if (goals.isError || !goals.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Goals are unavailable.</p>
        <Button onClick={retry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    );
  }
  return (
    <ProjectGoalsView
      goals={goals.data.records}
      membership={
        selectedId ? (
          <>
            <ProjectGoalMembership
              goalId={selectedId}
              key={selectedId}
              projectId={projectId}
            />
            {valueChainArea?.(selectedId)}
          </>
        ) : undefined
      }
      onSave={save}
      onStartEditing={startEditing}
      projectId={projectId}
      readOnly={goals.data.readOnly}
      savedMessage={saved ? "Project Goal saved." : undefined}
      selectedId={selectedId}
    />
  );
}

export function ProjectGoalsRoute({
  projectId,
  hash,
  valueChainArea,
}: {
  projectId: string;
  hash: string;
  valueChainArea?: (goalId: string) => ReactNode;
}) {
  let selectedId: string | undefined;
  if (hash.startsWith("project-goal-")) {
    try {
      selectedId = decodeURIComponent(hash.slice("project-goal-".length));
    } catch {
      return <p role="alert">Project Goal is unavailable.</p>;
    }
    if (!selectedId) {
      return <p role="alert">Project Goal is unavailable.</p>;
    }
  }
  return (
    <ProjectGoalsSurface
      projectId={projectId}
      selectedId={selectedId}
      valueChainArea={valueChainArea}
    />
  );
}
