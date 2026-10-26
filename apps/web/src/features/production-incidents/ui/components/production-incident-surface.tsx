// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to this query.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import { useProductionIncidentCommand } from "../../hooks/use-production-incident-command";
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
  const run = useProductionIncidentCommand();
  // One Work id per previewed attempt, so a retried confirm cannot make a second Work.
  const followUpWorkId = useRef<string | null>(null);
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
  const current = detail.data;
  const base = { incidentId, projectId };
  async function done<T>(message: string, write: Promise<T>) {
    setSavedMessage(undefined);
    setErrorMessage(undefined);
    try {
      await write;
    } catch (error) {
      setErrorMessage(
        "Change could not be saved. The Production Incident was reloaded; check it and try again.",
      );
      throw error;
    }
    setSavedMessage(message);
  }
  const actions: ProductionIncidentActions = {
    onPreview: (values) =>
      client.previewProductionIncidentFollowUp({ ...base, ...values }),
    onCreate: async (values, preview) => {
      followUpWorkId.current ??= crypto.randomUUID();
      const workId = followUpWorkId.current;
      const command = {
        ...base,
        ...values,
        previewFingerprint: preview.fingerprint,
        workId,
      };
      try {
        await done(
          "Follow-up work created.",
          run(command, (clientIdempotencyKey) =>
            client.createProductionIncidentFollowUp({
              ...command,
              baseRevision: 0,
              clientIdempotencyKey,
            }),
          ),
        );
        followUpWorkId.current = null;
      } catch (error) {
        // A stale preview needs a new preview, which gets its own Work id.
        followUpWorkId.current = null;
        throw error;
      }
    },
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
      return done(
        "Record linked.",
        run(command, (clientIdempotencyKey) =>
          client.setProductionIncidentLink({
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
        targetId: link.target.id,
        targetType: link.target.type,
      };
      return done(
        "Link removed.",
        run(command, (clientIdempotencyKey) =>
          client.setProductionIncidentLink({
            ...command,
            baseRevision: link.revision,
            clientIdempotencyKey,
          }),
        ),
      );
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
      return done(
        `Status changed to ${status}.`,
        run(command, (clientIdempotencyKey) =>
          client.transitionProjectSourceRecord({
            ...command,
            baseRevision: incident.revision,
            clientIdempotencyKey,
          }),
        ),
      );
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
      return done(
        "Incident saved.",
        run(command, (clientIdempotencyKey) =>
          client.updateProjectSourceRecord({
            ...command,
            baseRevision: incident.revision,
            clientIdempotencyKey,
          }),
        ),
      );
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
