import {
  type ProjectGoalRecord,
  projectGoalFieldsSchema,
} from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { type ProjectGoalDraft, ProjectGoalsView } from "./project-goals-view";

export default function ProjectGoalsSurface({
  projectId,
  selectedId,
}: {
  projectId: string;
  selectedId?: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectGoals.queryOptions({ input: { projectId } });
  const goals = useQuery(options);
  const [savedMessage, setSavedMessage] = useState<string>();
  const attempt = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  async function save(draft: ProjectGoalDraft, goal?: ProjectGoalRecord) {
    const fields = projectGoalFieldsSchema.parse(draft);
    const fingerprint = JSON.stringify({
      fields,
      goalId: goal?.id,
      revision: goal?.revision,
    });
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = {
        fingerprint,
        id: goal?.id ?? crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    const { id, key } = attempt.current;
    await runOnlineOnlyWrite(() =>
      goal
        ? client.updateProjectGoal({
            ...fields,
            projectId,
            id,
            baseRevision: goal.revision,
            clientIdempotencyKey: key,
          })
        : client.createProjectGoal({
            ...fields,
            projectId,
            id,
            baseRevision: 0,
            clientIdempotencyKey: key,
          }),
    );
    attempt.current = null;
    setSavedMessage("Project Goal saved.");
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  }
  function retry() {
    goals.refetch().catch(() => undefined);
  }
  if (goals.isPending) {
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
      onSave={save}
      projectId={projectId}
      readOnly={goals.data.readOnly}
      savedMessage={savedMessage}
      selectedId={selectedId}
    />
  );
}

export function ProjectGoalsRoute({
  projectId,
  hash,
}: {
  projectId: string;
  hash: string;
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
  return <ProjectGoalsSurface projectId={projectId} selectedId={selectedId} />;
}
