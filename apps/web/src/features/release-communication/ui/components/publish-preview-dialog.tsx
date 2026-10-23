// biome-ignore-all lint/performance/noJsxPropsBind: approval toggles close over the previewed proposals.

import type {
  PublishPreview,
  PublishReleaseNoteInput,
} from "@cantiara/api/release-communication";
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
import {
  buildPublishApproval,
  EMPTY_PUBLISH_SELECTION,
  type PublishSelection,
  toggled,
  whyTrailFieldKey,
} from "../../lib/publish-approval";

interface PublishPreviewDialogProps {
  onCancel: () => void;
  onPublish: (approval: PublishReleaseNoteInput["approval"]) => void;
  open: boolean;
  preview: PublishPreview;
  publishing?: boolean;
}

function ApprovalRow({
  checked,
  children,
  id,
  onChange,
}: {
  checked: boolean;
  children: React.ReactNode;
  id: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <label className="grid gap-0.5" htmlFor={id}>
        {children}
      </label>
    </li>
  );
}

/**
 * The publish-close preview: internal statuses, proposed public labels,
 * changelog links, `Why was this done?` snapshots and Build in Public events
 * in one place. It writes nothing; every proposal is approved item by item.
 */
export function PublishPreviewDialog({
  onCancel,
  onPublish,
  open,
  preview,
  publishing = false,
}: PublishPreviewDialogProps) {
  const [selection, setSelection] = useState<PublishSelection>(
    EMPTY_PUBLISH_SELECTION,
  );
  const blocked = preview.findings.length > 0;

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish preview</DialogTitle>
          <DialogDescription>
            Nothing is published until you approve it. Publishing does not
            complete Work, change a Release status or edit a public label you
            did not approve.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <ul aria-label="Findings" className="grid gap-1" role="alert">
            {preview.findings.map((finding) => (
              <li key={`${finding.check}:${finding.target}:${finding.message}`}>
                {`${finding.target}: ${finding.message}`}
              </li>
            ))}
          </ul>
        ) : null}

        <section aria-labelledby="preview-scope" className="grid gap-2">
          <h3 id="preview-scope">Scope</h3>
          <ul className="grid gap-2">
            {preview.scope.map((item) => (
              <li className="grid gap-1" key={item.workId}>
                <span>{item.title}</span>
                <span>{`Internal status: ${item.internalStatus}`}</span>
                <span>
                  {`Public label: ${item.currentPublicLabel ?? "None"}`}
                </span>
                {item.proposedPublicLabel ? (
                  <ul>
                    <ApprovalRow
                      checked={selection.workIds.has(item.workId)}
                      id={`label-${item.workId}`}
                      onChange={(on) =>
                        setSelection((current) => ({
                          ...current,
                          workIds: toggled(current.workIds, item.workId, on),
                        }))
                      }
                    >
                      {`Change public label to ${item.proposedPublicLabel}`}
                    </ApprovalRow>
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="preview-links" className="grid gap-2">
          <h3 id="preview-links">Changelog</h3>
          <ul className="grid gap-2">
            {preview.changelogLinks.map((link) => (
              <ApprovalRow
                checked={selection.linkHrefs.has(link.href)}
                id={`link-${link.href}`}
                key={link.href}
                onChange={(on) =>
                  setSelection((current) => ({
                    ...current,
                    linkHrefs: toggled(current.linkHrefs, link.href, on),
                  }))
                }
              >
                {`Link to ${link.label}`}
              </ApprovalRow>
            ))}
          </ul>
        </section>

        <section aria-labelledby="preview-why" className="grid gap-2">
          <h3 id="preview-why">Why was this done?</h3>
          <ul className="grid gap-2">
            {preview.whyTrail.flatMap((item) =>
              item.proposedFields.map((field) => {
                const key = whyTrailFieldKey(item, field.name);
                return (
                  <ApprovalRow
                    checked={selection.fieldKeys.has(key)}
                    id={`field-${key}`}
                    key={key}
                    onChange={(on) =>
                      setSelection((current) => ({
                        ...current,
                        fieldKeys: toggled(current.fieldKeys, key, on),
                      }))
                    }
                  >
                    <span>{`${item.sourceType} ${field.name}`}</span>
                    <span>{field.value}</span>
                  </ApprovalRow>
                );
              }),
            )}
          </ul>
        </section>

        <section aria-labelledby="preview-events" className="grid gap-2">
          <h3 id="preview-events">Build in Public events</h3>
          <ul className="grid gap-2">
            {preview.buildInPublicEvents.map((event) => (
              <ApprovalRow
                checked={selection.eventIds.has(event.id)}
                id={`event-${event.id}`}
                key={event.id}
                onChange={(on) =>
                  setSelection((current) => ({
                    ...current,
                    eventIds: toggled(current.eventIds, event.id, on),
                  }))
                }
              >
                {event.title}
              </ApprovalRow>
            ))}
          </ul>
        </section>

        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={blocked || publishing}
            onClick={() => onPublish(buildPublishApproval(preview, selection))}
            type="button"
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
