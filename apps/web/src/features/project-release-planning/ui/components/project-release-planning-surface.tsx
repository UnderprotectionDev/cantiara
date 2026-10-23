// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to this query.

import type { ProjectReleasePlanningDetail as Detail } from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { client, orpc } from "@/utils/orpc";
import { useProjectReleaseCommand } from "../../hooks/use-project-release-command";
import {
  type ProjectReleasePlanningActions,
  ProjectReleasePlanningDetail,
} from "./project-release-planning-detail";

export function ProjectReleasePlanningSurface({
  projectId,
  releaseId,
}: {
  projectId: string;
  releaseId: string;
}) {
  const detail = useQuery(
    orpc.projectReleasePlanning.queryOptions({
      input: { projectId, releaseId },
    }),
  );
  const run = useProjectReleaseCommand();
  const [savedMessage, setSavedMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  if (detail.isPending) {
    return <p role="status">Loading source record…</p>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Source record is unavailable.</p>
        <Button
          onClick={() => {
            detail.refetch().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  const current: Detail = detail.data;
  const base = { projectId, releaseId };
  function revisionOf(workId: string) {
    return (
      current.scope.find((member) => member.work.id === workId)?.revision ?? 0
    );
  }
  async function done<T>(message: string, write: Promise<T>) {
    setSavedMessage(undefined);
    setErrorMessage(undefined);
    try {
      await write;
    } catch (error) {
      setErrorMessage(
        "Change could not be saved. The Project Release was reloaded; check it and try again.",
      );
      throw error;
    }
    setSavedMessage(message);
  }
  const actions: ProjectReleasePlanningActions = {
    onAddScope: (workId) => {
      const command = { ...base, attached: true, workId };
      return done(
        "Work added to scope.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseScope({
            ...command,
            baseRevision: revisionOf(workId),
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onRemoveScope: (member) => {
      const command = { ...base, attached: false, workId: member.work.id };
      return done(
        "Work removed from scope.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseScope({
            ...command,
            baseRevision: member.revision,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onAddLink: (values) => {
      const command = { ...base, ...values, attached: true };
      // The identical reference is already attached; a repeated add is a no-op.
      const previous = current.links.find(
        (link) =>
          link.kind === values.kind &&
          link.label === values.label &&
          (link.repository?.id ?? null) === values.repositoryLinkId &&
          link.url === values.url,
      );
      if (previous?.attached) {
        return done("Reference added.", Promise.resolve());
      }
      return done(
        "Reference added.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseLink({
            ...command,
            baseRevision: previous?.revision ?? 0,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onRemoveLink: (link) => {
      const command = {
        ...base,
        attached: false,
        kind: link.kind,
        label: link.label,
        repositoryLinkId: link.repository?.id ?? null,
        url: link.url,
      };
      return done(
        "Reference removed.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseLink({
            ...command,
            baseRevision: link.revision,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onAddAudience: (target) => {
      const command = {
        ...base,
        attached: true,
        targetId: target.id,
        targetType: target.type,
      };
      const previous = current.audience.find(
        (link) =>
          link.target.type === target.type && link.target.id === target.id,
      );
      return done(
        "Audience linked.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseAudience({
            ...command,
            baseRevision: previous?.revision ?? 0,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onRemoveAudience: (link) => {
      const command = {
        ...base,
        attached: false,
        targetId: link.target.id,
        targetType: link.target.type,
      };
      return done(
        "Audience link removed.",
        run(command, (clientIdempotencyKey) =>
          client.setProjectReleaseAudience({
            ...command,
            baseRevision: link.revision,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onChangeStatus: (status) => {
      const { release } = current;
      // The founder's explicit status change keeps the Project source record
      // transition; a GitHub Release suggestion only opens this action.
      const command = {
        projectId,
        sourceId: release.id,
        sourceType: "Project Release" as const,
        status,
      };
      return done(
        `Status changed to ${status}.`,
        run(command, (clientIdempotencyKey) =>
          client.transitionProjectSourceRecord({
            ...command,
            baseRevision: release.revision,
            clientIdempotencyKey,
          }),
        ),
      );
    },
    onSaveHypothesis: (hypothesis) => {
      const { release } = current;
      // The record's own fields keep the Project source record write path.
      const command = {
        ...hypothesis,
        description: release.description,
        name: release.name,
        projectId,
        sourceId: release.id,
        sourceType: "Project Release" as const,
        versionLabel: release.versionLabel,
      };
      return done(
        "Hypothesis saved.",
        run(command, (clientIdempotencyKey) =>
          client.updateProjectSourceRecord({
            ...command,
            baseRevision: release.revision,
            clientIdempotencyKey,
          }),
        ),
      );
    },
  };
  return (
    <ProjectReleasePlanningDetail
      actions={actions}
      detail={current}
      errorMessage={errorMessage}
      projectId={projectId}
      savedMessage={savedMessage}
    />
  );
}
