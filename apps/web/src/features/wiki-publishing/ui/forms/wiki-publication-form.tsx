// biome-ignore-all lint/performance/noJsxPropsBind: dialog handlers close over local confirmation state.

import {
  WIKI_INDEXING_WARNING,
  WIKI_PUBLISHING_UI_LABELS,
  type WikiPublication,
} from "@cantiara/api/wiki-publishing";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useForm, useSelector } from "@tanstack/react-form";
import { type SubmitEvent, useState } from "react";
import { parseEnableIndexing } from "../../lib/wiki-publish-approval";

interface WikiPublicationPanelProps {
  busy?: boolean;
  /** Founder-facing text of the last failed action (see `WIKI_PUBLISHING_ERROR_MESSAGES`). */
  error?: string | null;
  /** Resolves after the indexing change is saved; a rejection keeps the dialog open. */
  onSetIndexing: (input: {
    acknowledgeThirdPartyCopies: boolean;
    enabled: boolean;
  }) => unknown;
  onUnpublish: () => unknown;
  publication: WikiPublication;
  /** Absolute public URL; the panel never builds one from a Project. */
  publicUrl: string | null;
}

/**
 * Status, `Unpublish` and the indexing choice of one published Wiki Document.
 * Every control is a native button or a labelled checkbox inside a focus-trapped
 * dialog, so the whole flow runs from the keyboard and a screen reader.
 */
export function WikiPublicationPanel({
  busy = false,
  error = null,
  onSetIndexing,
  onUnpublish,
  publication,
  publicUrl,
}: WikiPublicationPanelProps) {
  const [unpublishHandle] = useState(createDialogHandle);
  const [indexingHandle] = useState(createDialogHandle);
  const unpublishForm = useForm({
    defaultValues: {},
    onSubmit: async ({ formApi }) => {
      try {
        await onUnpublish();
        unpublishHandle.close();
      } catch {
        formApi.setErrorMap({
          onSubmit: {
            form: "The page could not be unpublished. Try again.",
            fields: {},
          },
        });
      }
    },
  });
  const unpublishing = useSelector(
    unpublishForm.store,
    (state) => state.isSubmitting,
  );
  const indexingForm = useForm({
    defaultValues: { acknowledged: false },
    onSubmit: async ({ value }) => {
      const parsed = parseEnableIndexing(value);
      if (!parsed.ok) {
        return;
      }
      try {
        await onSetIndexing(parsed.input);
      } catch {
        // The caller presents the failure; the acknowledgement stays for a retry.
        return;
      }
      indexingHandle.close();
    },
  });
  const acknowledged = useSelector(
    indexingForm.store,
    (state) => state.values.acknowledged,
  );

  if (!publication.surfaceId) {
    return (
      <section aria-labelledby="wiki-publication-title" className="grid gap-1">
        <h3 id="wiki-publication-title">Public page</h3>
        {error ? <p role="alert">{error}</p> : null}
        <p role="status">This Document is not published.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="wiki-publication-title" className="grid gap-2">
      <h3 id="wiki-publication-title">Public page</h3>
      {error ? <p role="alert">{error}</p> : null}
      {publicUrl ? (
        <p>
          <a href={publicUrl} rel="noreferrer noopener" target="_blank">
            {publicUrl}
          </a>
        </p>
      ) : null}
      <p role="status">
        {publication.indexingEnabled
          ? "Search engines may index this page."
          : "Not indexed: search engines are told to skip this page, and it is not in any sitemap."}
      </p>
      <div className="flex flex-wrap gap-2">
        {publication.indexingEnabled ? (
          <Button
            disabled={busy}
            onClick={() =>
              onSetIndexing({
                acknowledgeThirdPartyCopies: false,
                enabled: false,
              })
            }
            type="button"
            variant="outline"
          >
            {WIKI_PUBLISHING_UI_LABELS.disableIndexing}
          </Button>
        ) : (
          <DialogTrigger
            disabled={busy}
            handle={indexingHandle}
            render={<Button variant="outline" />}
          >
            {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
          </DialogTrigger>
        )}
        <DialogTrigger
          disabled={busy}
          handle={unpublishHandle}
          render={<Button variant="destructive" />}
        >
          {WIKI_PUBLISHING_UI_LABELS.unpublish}
        </DialogTrigger>
      </div>

      <Dialog
        handle={unpublishHandle}
        onOpenChange={(open, event) => {
          if (open) {
            unpublishForm.reset();
          } else if (
            (busy || unpublishing) &&
            event.reason !== "imperative-action"
          ) {
            event.cancel();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{WIKI_PUBLISHING_UI_LABELS.unpublish}</DialogTitle>
            <DialogDescription>
              The page stops loading for everyone right away, including its
              files, and this address is never reused. Copies others already
              saved cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          <unpublishForm.Subscribe
            selector={(state) => state.errorMap.onSubmit}
          >
            {(message) =>
              typeof message === "string" ? <p role="alert">{message}</p> : null
            }
          </unpublishForm.Subscribe>
          <DialogFooter>
            <DialogClose
              disabled={busy || unpublishing}
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              disabled={busy || unpublishing}
              onClick={() =>
                unpublishForm.handleSubmit().catch(() => undefined)
              }
              type="button"
              variant="destructive"
            >
              {WIKI_PUBLISHING_UI_LABELS.unpublish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        handle={indexingHandle}
        onOpenChange={(open, event) => {
          if (open) {
            indexingForm.reset();
          } else if (
            (busy || indexingForm.state.isSubmitting) &&
            event.reason !== "imperative-action"
          ) {
            event.cancel();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
            </DialogTitle>
            <DialogDescription>{WIKI_INDEXING_WARNING}</DialogDescription>
          </DialogHeader>
          <form
            aria-label={WIKI_PUBLISHING_UI_LABELS.enableIndexing}
            className="grid gap-4"
            onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
              event.preventDefault();
              event.stopPropagation();
              indexingForm.handleSubmit().catch(() => undefined);
            }}
          >
            <div className="flex items-center gap-2">
              <indexingForm.Field name="acknowledged">
                {(field) => (
                  <Checkbox
                    checked={field.state.value}
                    id="wiki-indexing-ack"
                    onCheckedChange={(next) =>
                      field.handleChange(next === true)
                    }
                  />
                )}
              </indexingForm.Field>
              <label htmlFor="wiki-indexing-ack">
                I understand third-party copies cannot be fully recalled.
              </label>
            </div>
            <DialogFooter>
              <DialogClose
                disabled={busy}
                render={<Button variant="outline" />}
              >
                Cancel
              </DialogClose>
              <Button disabled={!acknowledged || busy} type="submit">
                {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
