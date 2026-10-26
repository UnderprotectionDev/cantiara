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
import { useState } from "react";
import {
  type ProductionIncidentFollowUpValues,
  productionIncidentFollowUpDraft,
} from "../../lib/production-incident-form";
import { ProductionIncidentFollowUpForm } from "../forms/production-incident-follow-up-form";
import { ProductionIncidentFollowUpPreviewView } from "./production-incident-follow-up-preview";

export interface ProductionIncidentFollowUpActions {
  onCreate: (
    values: ProductionIncidentFollowUpValues,
    preview: ProductionIncidentFollowUpPreview,
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
}: {
  actions: ProductionIncidentFollowUpActions;
  incident: Pick<ProductionIncidentRecord, "title">;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ProductionIncidentFollowUpValues | null>(
    null,
  );
  const [preview, setPreview] =
    useState<ProductionIncidentFollowUpPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setValues(null);
    setPreview(null);
    setError(null);
  }
  async function confirm() {
    if (!(values && preview)) {
      return;
    }
    setError(null);
    setConfirming(true);
    try {
      await actions.onCreate(values, preview);
      close();
    } catch {
      // A stale or failed commit sends the founder back to a fresh preview.
      setError(
        "The Production Incident changed or the Work could not be created. Review the preview again.",
      );
      setPreview(null);
    } finally {
      setConfirming(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Create follow-up work
      </Button>
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
              onBack={() => setPreview(null)}
              onConfirm={() => {
                confirm().catch(() => undefined);
              }}
              preview={preview}
            />
          ) : (
            <>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <ProductionIncidentFollowUpForm
                draft={values ?? productionIncidentFollowUpDraft(incident)}
                onCancel={close}
                onPreview={async (next) => {
                  setError(null);
                  const loaded = await actions.onPreview(next);
                  setValues(next);
                  setPreview(loaded);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
