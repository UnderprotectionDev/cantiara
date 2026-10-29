// biome-ignore-all lint/performance/noJsxPropsBind: dialog handlers close over local confirmation state.

import {
  WIKI_INDEXING_WARNING,
  WIKI_PUBLISHING_UI_LABELS,
  type WikiPublication,
} from "@cantiara/api/wiki-publishing";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useState } from "react";

interface WikiPublicationPanelProps {
  busy?: boolean;
  onSetIndexing: (input: {
    acknowledgeThirdPartyCopies: boolean;
    enabled: boolean;
  }) => void;
  onUnpublish: () => void;
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
  onSetIndexing,
  onUnpublish,
  publication,
  publicUrl,
}: WikiPublicationPanelProps) {
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [indexingOpen, setIndexingOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!publication.surfaceId) {
    return (
      <section aria-labelledby="wiki-publication-title" className="grid gap-1">
        <h3 id="wiki-publication-title">Public page</h3>
        <p role="status">This Document is not published.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="wiki-publication-title" className="grid gap-2">
      <h3 id="wiki-publication-title">Public page</h3>
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
          <Button
            disabled={busy}
            onClick={() => {
              setAcknowledged(false);
              setIndexingOpen(true);
            }}
            type="button"
            variant="outline"
          >
            {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={() => setUnpublishOpen(true)}
          type="button"
          variant="destructive"
        >
          {WIKI_PUBLISHING_UI_LABELS.unpublish}
        </Button>
      </div>

      <Dialog onOpenChange={setUnpublishOpen} open={unpublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{WIKI_PUBLISHING_UI_LABELS.unpublish}</DialogTitle>
            <DialogDescription>
              The page stops loading for everyone right away, including its
              files, and this address is never reused. Copies others already
              saved cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setUnpublishOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setUnpublishOpen(false);
                onUnpublish();
              }}
              type="button"
              variant="destructive"
            >
              {WIKI_PUBLISHING_UI_LABELS.unpublish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setIndexingOpen} open={indexingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
            </DialogTitle>
            <DialogDescription>{WIKI_INDEXING_WARNING}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={acknowledged}
              id="wiki-indexing-ack"
              onCheckedChange={(next) => setAcknowledged(next === true)}
            />
            <label htmlFor="wiki-indexing-ack">
              I understand third-party copies cannot be fully recalled.
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIndexingOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!acknowledged || busy}
              onClick={() => {
                setIndexingOpen(false);
                onSetIndexing({
                  acknowledgeThirdPartyCopies: true,
                  enabled: true,
                });
              }}
              type="button"
            >
              {WIKI_PUBLISHING_UI_LABELS.enableIndexing}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
