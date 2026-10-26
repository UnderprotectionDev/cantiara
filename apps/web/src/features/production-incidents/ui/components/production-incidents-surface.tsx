// biome-ignore-all lint/performance/noJsxPropsBind: Dialog handlers bind to this Project.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import { useProductionIncidentCommand } from "../../hooks/use-production-incident-command";
import {
  type ProductionIncidentFormValues,
  productionIncidentsHref,
} from "../../lib/production-incident-form";
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
  const run = useProductionIncidentCommand();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  // One id per create attempt, so a retried create cannot make a second incident.
  const incidentId = useRef<string | null>(null);

  async function create(values: ProductionIncidentFormValues) {
    incidentId.current ??= crypto.randomUUID();
    const id = incidentId.current;
    await run({ create: id, ...values }, (clientIdempotencyKey) =>
      client.createProjectSourceRecord({
        ...values,
        baseRevision: 0,
        clientIdempotencyKey,
        id,
        projectId,
        sourceType: "Production Incident",
      }),
    );
    incidentId.current = null;
    setCreating(false);
    // A failed in-app navigation must not read as a failed create.
    await navigate({ href: productionIncidentsHref(projectId, id) }).catch(
      () => undefined,
    );
  }

  if (overview.isPending) {
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
    <>
      <ProductionIncidentList
        createControl={
          <Button onClick={() => setCreating(true)} type="button">
            Record Production Incident
          </Button>
        }
        formatting={formatting}
        overview={overview.data}
        projectId={projectId}
      />
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
          }
        }}
        open={creating}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Production Incident</DialogTitle>
            <DialogDescription>
              One Production Incident belongs to this Project only.
            </DialogDescription>
          </DialogHeader>
          <ProductionIncidentForm
            mode="create"
            onCancel={() => setCreating(false)}
            onSubmit={create}
            timeZone={formatting.timeZone}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
