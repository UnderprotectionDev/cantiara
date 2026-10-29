// biome-ignore-all lint/performance/noJsxPropsBind: handlers close over the typed slug and confirmations.

import { BUILD_IN_PUBLIC_UI_LABELS } from "@cantiara/api/build-in-public";
import type {
  BuildInPublicPublication,
  BuildInPublicSlugPreview,
} from "@cantiara/api/build-in-public-publication";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";

interface BuildInPublicPublicationPanelProps {
  onPreviewSlug: (slug: string) => void;
  onSetIndexing: (input: {
    acknowledgeThirdPartyCopies: boolean;
    enabled: boolean;
  }) => void;
  onSetSlug: (input: { confirmRedirect: boolean; slug: string }) => void;
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
  const [slug, setSlug] = useState(publication.slug ?? "");
  const [confirmRedirect, setConfirmRedirect] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

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

      <div className="grid gap-2">
        <label htmlFor="bip-slug">Slug</label>
        <Input
          id="bip-slug"
          onChange={(event) => {
            setSlug(event.target.value);
            setConfirmRedirect(false);
          }}
          value={slug}
        />
        <Button
          onClick={() => onPreviewSlug(slug)}
          type="button"
          variant="outline"
        >
          Preview slug change
        </Button>
        {slugPreview?.available === false ? (
          <p role="alert">Another published surface already uses this slug.</p>
        ) : null}
        {slugPreview?.redirect ? (
          <div className="grid gap-2">
            <p>{`${slugPreview.redirect.from} will redirect to ${slugPreview.redirect.to} while this page is public. Unpublishing ends the redirect.`}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={confirmRedirect}
                id="bip-confirm-redirect"
                onCheckedChange={(next) => setConfirmRedirect(next === true)}
              />
              <label htmlFor="bip-confirm-redirect">Confirm redirect</label>
            </div>
          </div>
        ) : null}
        <Button
          disabled={
            !slugPreview ||
            slugPreview.slug !== slug ||
            !slugPreview.available ||
            (Boolean(slugPreview.redirect) && !confirmRedirect)
          }
          onClick={() => onSetSlug({ confirmRedirect, slug })}
          type="button"
        >
          Change slug
        </Button>
      </div>

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
          <>
            <p>{publication.indexingWarning}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={acknowledged}
                id="bip-ack-indexing"
                onCheckedChange={(next) => setAcknowledged(next === true)}
              />
              <label htmlFor="bip-ack-indexing">
                I understand third-party copies cannot be fully recalled
              </label>
            </div>
            <Button
              disabled={!acknowledged}
              onClick={() =>
                onSetIndexing({
                  acknowledgeThirdPartyCopies: acknowledged,
                  enabled: true,
                })
              }
              type="button"
              variant="outline"
            >
              {BUILD_IN_PUBLIC_UI_LABELS.enableIndexing}
            </Button>
          </>
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
