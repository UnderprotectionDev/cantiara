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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import {
  type ProductionIncidentFormValues,
  productionIncidentsHref,
} from "../../lib/production-incident-form";
import { refreshProductionIncident } from "../../lib/refresh-production-incident";
import { ProductionIncidentForm } from "../forms/production-incident-form";
import { ProductionIncidentList } from "./production-incident-list";

export function ProductionIncidentsSurface({
  formatting,
  projectId,
}: {
  formatting: AccountPreferences;
  projectId: string;
}) {
  const overview = useQuery(
    orpc.productionIncidents.queryOptions({ input: { projectId } }),
  );
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialogActions = useRef<DialogActions | null>(null);
  // One id per create attempt, so a retried create cannot make a second incident.
  const incidentId = useRef<string | null>(null);

  const create = usePreparedMutation(
    orpc.createProjectSourceRecord.mutationOptions({
      mutationFn: (input) => client.createProjectSourceRecord(input),
      onSuccess: async (_, input) => {
        await refreshProductionIncident(queryClient, input.projectId, input.id);
        if (incidentId.current === input.id) {
          incidentId.current = null;
          dialogActions.current?.close();
          await navigate({
            href: productionIncidentsHref(input.projectId, input.id),
          }).catch(() => undefined);
        }
      },
    }),
    (values: ProductionIncidentFormValues) => {
      incidentId.current ??= crypto.randomUUID();
      return {
        ...values,
        baseRevision: 0,
        id: incidentId.current,
        projectId,
        sourceType: "Production Incident" as const,
      };
    },
  );

  function dismissCreate() {
    incidentId.current = null;
    create.reset();
  }

  if (overview.status === "pending") {
    return <p role="status">Loading source record…</p>;
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Production Incidents are unavailable.</p>
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
        if (create.isPending) {
          event.cancel();
          return;
        }
        dismissCreate();
      }}
    >
      <ProductionIncidentList
        createControl={
          <DialogTrigger render={<Button />}>
            Record Production Incident
          </DialogTrigger>
        }
        formatting={formatting}
        overview={overview.data}
        projectId={projectId}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Production Incident</DialogTitle>
          <DialogDescription>
            One Production Incident belongs to this Project only.
          </DialogDescription>
        </DialogHeader>
        <ProductionIncidentForm
          mode="create"
          onCancel={() => {
            dismissCreate();
            dialogActions.current?.close();
          }}
          onSubmit={create.mutateAsync}
          timeZone={formatting.timeZone}
        />
      </DialogContent>
    </Dialog>
  );
}
