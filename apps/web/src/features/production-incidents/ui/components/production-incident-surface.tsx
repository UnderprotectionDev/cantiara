// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to this query.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFresh } from "@/lib/fetch-fresh";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import { refreshProductionIncident } from "../../lib/refresh-production-incident";
import {
  type ProductionIncidentActions,
  ProductionIncidentDetail,
} from "./production-incident-detail";

export function ProductionIncidentSurface({
  formatting,
  incidentId,
  projectId,
}: {
  formatting: AccountPreferences;
  incidentId: string;
  projectId: string;
}) {
  const detail = useQuery(
    orpc.productionIncidentDetail.queryOptions({
      input: { incidentId, projectId },
    }),
  );
  const queryClient = useQueryClient();
  const refresh = () =>
    refreshProductionIncident(queryClient, projectId, incidentId);
  const writeLink = usePreparedMutation(
    orpc.setProductionIncidentLink.mutationOptions({
      mutationFn: (input) => client.setProductionIncidentLink(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Parameters<typeof client.setProductionIncidentLink>[0],
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
        Extract<
          Parameters<typeof client.transitionProjectSourceRecord>[0],
          { sourceType: "Production Incident" }
        >,
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const writeIncident = usePreparedMutation(
    orpc.updateProjectSourceRecord.mutationOptions({
      mutationFn: (input) => client.updateProjectSourceRecord(input),
      onSettled: refresh,
    }),
    (
      input: Omit<
        Extract<
          Parameters<typeof client.updateProjectSourceRecord>[0],
          { sourceType: "Production Incident" }
        >,
        "clientIdempotencyKey"
      >,
    ) => input,
  );
  const incidentStatus =
    writeStatus.variables?.sourceType === "Production Incident"
      ? writeStatus.variables.status
      : "";
  const [feedback] = [
    {
      mutation: writeLink,
      message: writeLink.variables?.attached
        ? "Record linked."
        : "Link removed.",
    },
    { mutation: writeStatus, message: `Status changed to ${incidentStatus}.` },
    { mutation: writeIncident, message: "Incident saved." },
  ].sort(
    (left, right) => right.mutation.submittedAt - left.mutation.submittedAt,
  );
  const savedMessage = feedback?.mutation.isSuccess
    ? feedback.message
    : undefined;
  const errorMessage = feedback?.mutation.isError
    ? "Change could not be saved. The Production Incident was reloaded; check it and try again."
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
  const current = detail.data;
  const base = { incidentId, projectId };
  const actions: ProductionIncidentActions = {
    onPreview: (values) =>
      fetchFresh(queryClient, {
        ...orpc.previewProductionIncidentFollowUp.queryOptions({
          input: { ...base, ...values },
        }),
        gcTime: 0,
      }),
    onCreate: (values, preview, identity) =>
      client.createProductionIncidentFollowUp({
        ...base,
        ...values,
        ...identity,
        baseRevision: 0,
        previewFingerprint: preview.fingerprint,
      }),
    onAddLink: (target) => {
      const command = {
        ...base,
        attached: true,
        targetId: target.id,
        targetType: target.type,
      };
      // A removed link keeps its row, so a re-add continues its revision.
      const previous = current.links.find(
        (link) =>
          link.target.type === target.type && link.target.id === target.id,
      );
      return writeLink.mutateAsync({
        ...command,
        baseRevision: previous?.revision ?? 0,
      });
    },
    onRemoveLink: (link) => {
      const command = {
        ...base,
        attached: false,
        targetId: link.target.id,
        targetType: link.target.type,
      };
      return writeLink.mutateAsync({ ...command, baseRevision: link.revision });
    },
    onChangeStatus: (status) => {
      const { incident } = current;
      // The status keeps the Project source record transition.
      const command = {
        projectId,
        sourceId: incident.id,
        sourceType: "Production Incident" as const,
        status,
      };
      return writeStatus.mutateAsync({
        ...command,
        baseRevision: incident.revision,
      });
    },
    onSave: (values) => {
      const { incident } = current;
      // The record's own fields keep the Project source record write path.
      const command = {
        ...values,
        projectId,
        sourceId: incident.id,
        sourceType: "Production Incident" as const,
      };
      return writeIncident.mutateAsync({
        ...command,
        baseRevision: incident.revision,
      });
    },
  };
  return (
    <ProductionIncidentDetail
      actions={actions}
      detail={current}
      errorMessage={errorMessage}
      formatting={formatting}
      projectId={projectId}
      savedMessage={savedMessage}
    />
  );
}
