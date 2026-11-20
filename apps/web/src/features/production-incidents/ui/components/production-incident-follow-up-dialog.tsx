// biome-ignore-all lint/performance/noJsxPropsBind: Dialog handlers bind to this incident.

import type {
  ProductionIncidentFollowUpPreview,
  ProductionIncidentRecord,
} from "@cantiara/api/production-incidents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
  type ProductionIncidentFollowUpValues,
  productionIncidentFollowUpDraft,
} from "../../lib/production-incident-form";
import { refreshProductionIncident } from "../../lib/refresh-production-incident";
import { ProductionIncidentFollowUpForm } from "../forms/production-incident-follow-up-form";
import { ProductionIncidentFollowUpPreviewView } from "./production-incident-follow-up-preview";

interface FollowUpIdentity {
  clientIdempotencyKey: string;
  workId: string;
}

export interface ProductionIncidentFollowUpActions {
  onCreate: (
    values: ProductionIncidentFollowUpValues,
    preview: ProductionIncidentFollowUpPreview,
    identity: FollowUpIdentity,
  ) => Promise<unknown>;
  onPreview: (
    values: ProductionIncidentFollowUpValues,
  ) => Promise<ProductionIncidentFollowUpPreview>;
}

/**
 * `Create follow-up work`: choose, review the preview, then confirm. The
 * button only opens the dialog; nothing is written before the confirmation.
 */
export function ProductionIncidentFollowUpDialog({
  actions,
  incident,
  projectId,
}: {
  actions: ProductionIncidentFollowUpActions;
  incident: Pick<ProductionIncidentRecord, "title">;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const queryClient = useQueryClient();
  const active = useRef<FollowUpIdentity | null>(null);
  const inspect = useMutation({
    mutationKey: orpc.previewProductionIncidentFollowUp.mutationKey(),
    mutationFn: (input: ProductionIncidentFollowUpValues) =>
      actions.onPreview(input),
  });
  const create = useMutation({
    mutationKey: orpc.createProductionIncidentFollowUp.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      values,
      reviewed,
      identity,
    }: {
      values: ProductionIncidentFollowUpValues;
      reviewed: ProductionIncidentFollowUpPreview;
      identity: FollowUpIdentity;
    }) => actions.onCreate(values, reviewed, identity),
    onSettled: (_, _error, { reviewed }) =>
      refreshProductionIncident(
        queryClient,
        projectId,
        reviewed.plan.incident.id,
      ),
    onSuccess: async (_, { identity }) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.key({ input: { projectId } }),
      });
      if (
        active.current?.clientIdempotencyKey === identity.clientIdempotencyKey
      ) {
        close();
      }
    },
  });
  const stale =
    create.error instanceof ORPCError &&
    typeof create.error.data === "object" &&
    create.error.data !== null &&
    "code" in create.error.data &&
    create.error.data.code === "PREVIEW_STALE";
  const preview = reviewVisible && !stale ? inspect.data : undefined;
  const confirming = create.isPending || inspect.isPending;
  let error: string | null = null;
  if (stale) {
    error =
      "Preview changed. The Production Incident changed or the Work could not be created; review a fresh preview.";
  } else if (create.isError) {
    error = "The Work could not be created. Try again.";
  }

  function close() {
    setOpen(false);
    active.current = null;
    inspect.reset();
  }
  function back() {
    active.current = null;
    setReviewVisible(false);
    create.reset();
  }
  function confirm() {
    if (preview && inspect.variables && !confirming) {
      active.current ??= {
        clientIdempotencyKey: crypto.randomUUID(),
        workId: crypto.randomUUID(),
      };
      create.mutate({
        values: inspect.variables,
        reviewed: preview,
        identity: active.current,
      });
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          back();
          inspect.reset();
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Create follow-up work
      </Button>
      {create.isSuccess ? <p role="status">Follow-up work created.</p> : null}
      <Dialog
        onOpenChange={(next) => {
          if (!(next || confirming)) {
            close();
          }
        }}
        open={open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create follow-up work</DialogTitle>
            <DialogDescription>
              Review the Work and relations before anything is created.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <ProductionIncidentFollowUpPreviewView
              confirming={confirming}
              error={error}
              onBack={back}
              onConfirm={confirm}
              preview={preview}
            />
          ) : (
            <>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <ProductionIncidentFollowUpForm
                draft={
                  inspect.variables ?? productionIncidentFollowUpDraft(incident)
                }
                onCancel={close}
                onPreview={async (next) => {
                  active.current = null;
                  create.reset();
                  setReviewVisible(true);
                  await inspect.mutateAsync(next);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
