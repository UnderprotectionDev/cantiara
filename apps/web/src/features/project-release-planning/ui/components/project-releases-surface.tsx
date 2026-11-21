// biome-ignore-all lint/performance/noJsxPropsBind: Dialog handlers bind to this Project.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  type DialogActions,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import { useProjectReleaseCommand } from "../../hooks/use-project-release-command";
import { projectReleasesHref } from "../../lib/project-release-planning-form";
import {
  ProjectReleaseCreateForm,
  type ProjectReleaseCreateValues,
} from "../forms/project-release-create-form";
import { ProjectReleaseList } from "./project-release-list";

export function ProjectReleasesSurface({
  formatting,
  projectId,
}: {
  formatting: AccountPreferences;
  projectId: string;
}) {
  const overview = useQuery(
    orpc.projectReleases.queryOptions({ input: { projectId } }),
  );
  const run = useProjectReleaseCommand(projectId);
  const navigate = useNavigate();
  const dialogActions = useRef<DialogActions | null>(null);
  // One id per create attempt, so a retried create cannot make a second release.
  const releaseId = useRef<string | null>(null);

  async function create(values: ProjectReleaseCreateValues) {
    releaseId.current ??= crypto.randomUUID();
    const id = releaseId.current;
    await run(
      { id, ...values },
      (clientIdempotencyKey) =>
        client.createProjectSourceRecord({
          ...values,
          baseRevision: 0,
          clientIdempotencyKey,
          id,
          projectId,
          sourceType: "Project Release",
        }),
      async () => {
        if (releaseId.current === id) {
          releaseId.current = null;
          dialogActions.current?.close();
          await navigate({ href: projectReleasesHref(projectId, id) });
        }
      },
    );
  }

  function cancelCreate() {
    releaseId.current = null;
  }

  if (overview.status === "pending") {
    return <p role="status">Loading source record…</p>;
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Project Releases are unavailable.</p>
        <Button
          onClick={() => {
            overview.refetch().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <Dialog
      actionsRef={dialogActions}
      onOpenChange={(open, event) => {
        if (open || event.reason === "imperative-action") {
          return;
        }

        cancelCreate();
      }}
    >
      <ProjectReleaseList
        createControl={
          <DialogTrigger render={<Button />}>
            Create Project Release
          </DialogTrigger>
        }
        formatting={formatting}
        overview={overview.data}
        projectId={projectId}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project Release</DialogTitle>
          <DialogDescription>
            One Project Release belongs to this Project only.
          </DialogDescription>
        </DialogHeader>
        <ProjectReleaseCreateForm
          onCancel={() => {
            cancelCreate();
            dialogActions.current?.close();
          }}
          onCreate={create}
        />
      </DialogContent>
    </Dialog>
  );
}
