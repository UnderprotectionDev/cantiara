// biome-ignore-all lint/performance/noJsxPropsBind: handlers close over the typed slug and confirmations.

import { BUILD_IN_PUBLIC_UI_LABELS } from "@cantiara/api/build-in-public";
import type {
  BuildInPublicPublication,
  BuildInPublicSlugPreview,
} from "@cantiara/api/build-in-public-publication";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { parseEnableIndexing } from "../../lib/build-in-public-publication-form";

import { BuildInPublicSlugForm } from "./build-in-public-slug-form";

interface BuildInPublicPublicationPanelProps {
  onPreviewSlug: (slug: string) => void;
  onSetIndexing: (input: {
    acknowledgeThirdPartyCopies: boolean;
    enabled: boolean;
  }) => Promise<unknown>;
  onSetSlug: (input: {
    confirmRedirect: boolean;
    slug: string;
  }) => Promise<unknown>;
  onUnpublish: () => void;
  publication: BuildInPublicPublication;
  /** The redirect shown before the slug change is applied. */
  slugPreview?: BuildInPublicSlugPreview | null;
}

/**
 * Publication state of a Project's Build in Public: its address, indexing
 * (off until the founder turns it on with the third-party copy warning), the
 * slug change with its redirect preview, and the terminal `Unpublish`. It
 * shows no view count or last access: none exists.
 */
export function BuildInPublicPublicationPanel({
  onPreviewSlug,
  onSetIndexing,
  onSetSlug,
  onUnpublish,
  publication,
  slugPreview = null,
}: BuildInPublicPublicationPanelProps) {
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const indexingForm = useForm({
    defaultValues: { acknowledged: false },
    onSubmit: async ({ value }) => {
      const parsed = parseEnableIndexing(value);
      if (!parsed.ok) {
        return;
      }
      try {
        await onSetIndexing(parsed.data);
      } catch {
        // The caller owns the write and its failure presentation.
      }
    },
  });
  const acknowledged = useStore(
    indexingForm.store,
    (state) => state.values.acknowledged,
  );
  const submitWith =
    (form: { handleSubmit: () => Promise<void> }) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit().catch(() => undefined);
    };

  if (!publication.published) {
    return (
      <section aria-labelledby="bip-publication-title" className="grid gap-2">
        <h2 id="bip-publication-title">
          {BUILD_IN_PUBLIC_UI_LABELS.buildInPublic}
        </h2>
        <p role="status">Nothing is public. Approve a preview to publish.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="bip-publication-title" className="grid gap-3">
      <h2 id="bip-publication-title">
        {BUILD_IN_PUBLIC_UI_LABELS.buildInPublic}
      </h2>
      {publication.unpublishedChanges ? (
        <p role="status">{BUILD_IN_PUBLIC_UI_LABELS.unpublishedChanges}</p>
      ) : null}
      <p>{`Revision ${publication.revision ?? 0} · ${publication.path ?? ""}`}</p>

      <BuildInPublicSlugForm
        onPreviewSlug={onPreviewSlug}
        onSetSlug={onSetSlug}
        publication={publication}
        slugPreview={slugPreview}
      />

      <div className="grid gap-2">
        <p>
          {publication.indexingEnabled
            ? "Search engines may index this page."
            : "Search engines are told not to index this page."}
        </p>
        {publication.indexingEnabled ? (
          <Button
            onClick={() =>
              onSetIndexing({
                acknowledgeThirdPartyCopies: false,
                enabled: false,
              })
            }
            type="button"
            variant="outline"
          >
            {BUILD_IN_PUBLIC_UI_LABELS.disableIndexing}
          </Button>
        ) : (
          <form
            aria-label={BUILD_IN_PUBLIC_UI_LABELS.enableIndexing}
            className="grid gap-2"
            onSubmit={submitWith(indexingForm)}
          >
            <p>{publication.indexingWarning}</p>
            <div className="flex items-center gap-2">
              <indexingForm.Field name="acknowledged">
                {(field) => (
                  <Checkbox
                    checked={field.state.value}
                    id="bip-ack-indexing"
                    onCheckedChange={(next) =>
                      field.handleChange(next === true)
                    }
                  />
                )}
              </indexingForm.Field>
              <label htmlFor="bip-ack-indexing">
                I understand third-party copies cannot be fully recalled
              </label>
            </div>
            <Button disabled={!acknowledged} type="submit" variant="outline">
              {BUILD_IN_PUBLIC_UI_LABELS.enableIndexing}
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-2">
        <p>
          Unpublish ends this address for good: it answers 410 Gone, and a later
          publish gets a new address.
        </p>
        {confirmUnpublish ? (
          <Button onClick={onUnpublish} type="button" variant="destructive">
            {`Confirm ${BUILD_IN_PUBLIC_UI_LABELS.unpublish}`}
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmUnpublish(true)}
            type="button"
            variant="outline"
          >
            {BUILD_IN_PUBLIC_UI_LABELS.unpublish}
          </Button>
        )}
      </div>
    </section>
  );
}
