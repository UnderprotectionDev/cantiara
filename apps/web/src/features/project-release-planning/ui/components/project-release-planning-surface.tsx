// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to this query.

import type { ProjectReleasePlanningDetail as Detail } from "@cantiara/api/project-release-planning";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import { refreshProjectRelease } from "../../hooks/use-project-release-command";
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
  const queryClient = useQueryClient();
  const refresh = () =>
    refreshProjectRelease(queryClient, projectId, releaseId);
  const scope = usePreparedMutation(
    orpc.setProjectReleaseScope.mutationOptions({
      mutationFn: (input) => client.setProjectReleaseScope(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.setProjectReleaseScope>[0],
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const writeLink = usePreparedMutation(
    orpc.setProjectReleaseLink.mutationOptions({
      mutationFn: (input) => client.setProjectReleaseLink(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.setProjectReleaseLink>[0],
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const audience = usePreparedMutation(
    orpc.setProjectReleaseAudience.mutationOptions({
      mutationFn: (input) => client.setProjectReleaseAudience(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.setProjectReleaseAudience>[0],
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const writeStatus = usePreparedMutation(
    orpc.transitionProjectSourceRecord.mutationOptions({
      mutationFn: (input) => client.transitionProjectSourceRecord(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.transitionProjectSourceRecord>[0],
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const writeHypothesis = usePreparedMutation(
    orpc.updateProjectSourceRecord.mutationOptions({
      mutationFn: (input) => client.updateProjectSourceRecord(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.updateProjectSourceRecord>[0],
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const [feedback] = [
    {
      mutation: scope,
      message: scope.variables?.attached
        ? "Work added to scope."
        : "Work removed from scope.",
    },
    {
      mutation: writeLink,
      message: writeLink.variables?.attached
        ? "Reference added."
        : "Reference removed.",
    },
    {
      mutation: audience,
      message: audience.variables?.attached
        ? "Audience linked."
        : "Audience link removed.",
    },
    {
      mutation: writeStatus,
      message: `Status changed to ${writeStatus.variables?.sourceType === "Project Release" ? writeStatus.variables.status : ""}.`,
    },
    { mutation: writeHypothesis, message: "Hypothesis saved." },
  ].sort(
    (left, right) => right.mutation.submittedAt - left.mutation.submittedAt,
  );
  const savedMessage = feedback?.mutation.isSuccess
    ? feedback.message
    : undefined;
  const errorMessage =
    feedback?.mutation.isError && feedback.mutation !== writeStatus
      ? "Change could not be saved. The Project Release was reloaded; check it and try again."
      : undefined;

  if (detail.status === "pending") {
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
  const actions: ProjectReleasePlanningActions = {
    onAddScope: (workId) => {
      const command = { ...base, attached: true, workId };
      return scope.mutateAsync({
        ...command,
        baseRevision: revisionOf(workId),
      });
    },
    onRemoveScope: (member) => {
      const command = { ...base, attached: false, workId: member.work.id };
      return scope.mutateAsync({ ...command, baseRevision: member.revision });
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
        return Promise.resolve();
      }
      return writeLink.mutateAsync({
        ...command,
        baseRevision: previous?.revision ?? 0,
      });
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
      return writeLink.mutateAsync({ ...command, baseRevision: link.revision });
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
      return audience.mutateAsync({
        ...command,
        baseRevision: previous?.revision ?? 0,
      });
    },
    onRemoveAudience: (link) => {
      const command = {
        ...base,
        attached: false,
        targetId: link.target.id,
        targetType: link.target.type,
      };
      return audience.mutateAsync({ ...command, baseRevision: link.revision });
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
      return writeStatus.mutateAsync({
        ...command,
        baseRevision: release.revision,
      });
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
      return writeHypothesis.mutateAsync({
        ...command,
        baseRevision: release.revision,
      });
    },
  };
  return (
    <ProjectReleasePlanningDetail
      actions={actions}
      detail={current}
      errorMessage={errorMessage}
      hypothesisPending={writeHypothesis.isPending}
      projectId={projectId}
      resetStatus={writeStatus.reset}
      savedMessage={savedMessage}
      statusError={writeStatus.isError}
      statusPending={writeStatus.isPending}
    />
  );
}
