// biome-ignore-all lint/performance/noJsxPropsBind: approval toggles close over the previewed embeds.

import {
  type PublishWikiDocumentInput,
  WIKI_PUBLISHING_UI_LABELS,
  type WikiEmbedItem,
  type WikiPreviewMember,
  type WikiPublishPreview,
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
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useState } from "react";
import {
  buildWikiPublishApproval,
  isValidWikiSlug,
  leavingPlaceholders,
  toggledEmbed,
} from "../../lib/wiki-publish-approval";

interface PublishWikiDialogProps {
  onCancel: () => void;
  onPublish: (approval: PublishWikiDocumentInput["approval"]) => void;
  open: boolean;
  preview: WikiPublishPreview;
  publishing?: boolean;
}

function MemberDetails({ member }: { member: WikiPreviewMember }) {
  return (
    <span className="grid gap-0.5">
      <span>
        {member.version === null
          ? `${member.recordType}: ${member.title}`
          : `${member.recordType}: ${member.title} (version ${member.version})`}
      </span>
      {member.fields.length > 0 ? (
        <span>{`Fields: ${member.fields.map((field) => field.name).join(", ")}`}</span>
      ) : null}
      {member.files.map((file) => (
        <span key={file.attachmentId}>
          {`File: ${file.name} (version ${file.version})`}
        </span>
      ))}
    </span>
  );
}

function EmbedRow({
  checked,
  embed,
  onChange,
}: {
  checked: boolean;
  embed: WikiEmbedItem;
  onChange: (checked: boolean) => void;
}) {
  const id = `embed-${embed.id}`;
  return (
    <li className="flex items-start gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <label className="grid gap-0.5" htmlFor={id}>
        <span>{`Include ${embed.kind}`}</span>
        <MemberDetails member={embed.member} />
        {embed.liveSourceLabel ? (
          <span>{`Published as a read-only snapshot of ${embed.liveSourceLabel}, dated when you approve.`}</span>
        ) : null}
      </label>
    </li>
  );
}

/**
 * The closed-world preview of one Wiki Document. It writes nothing; the
 * Document itself and every embed are separate approval items, and an
 * unticked embed does not leave.
 */
export function PublishWikiDialog({
  onCancel,
  onPublish,
  open,
  preview,
  publishing = false,
}: PublishWikiDialogProps) {
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
  const [publishAnyway, setPublishAnyway] = useState(false);
  const [approvedFor, setApprovedFor] = useState(preview.fingerprint);
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const slugValid = isValidWikiSlug(slug);
  if (approvedFor !== preview.fingerprint) {
    // A changed preview never inherits approvals given to an earlier one.
    setApprovedFor(preview.fingerprint);
    setApproved(new Set());
    setPublishAnyway(false);
  }
  const placeholders = leavingPlaceholders(preview, approved);
  const blocked = (placeholders.length > 0 && !publishAnyway) || !slugValid;

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
          <DialogTitle>
            {WIKI_PUBLISHING_UI_LABELS.publishWikiDocument}
          </DialogTitle>
          <DialogDescription>
            Nothing is public until you approve it. Only this Document and the
            items you tick leave; the rest of your Wiki stays private.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="wiki-publish-document" className="grid gap-1">
          <h3 id="wiki-publish-document">Document</h3>
          <MemberDetails member={preview.root} />
        </section>

        <section aria-labelledby="wiki-publish-page" className="grid gap-2">
          <h3 id="wiki-publish-page">Public page</h3>
          <p>
            Title, summary and address belong to this page. Nothing is taken
            from a Project or its Build in Public page.
          </p>
          <Label htmlFor="wiki-publish-summary">
            Public summary (optional)
          </Label>
          <Input
            id="wiki-publish-summary"
            maxLength={300}
            onChange={(event) => setSummary(event.target.value)}
            value={summary}
          />
          <Label htmlFor="wiki-publish-slug">Page address (optional)</Label>
          <Input
            aria-describedby="wiki-publish-slug-help"
            aria-invalid={!slugValid}
            id="wiki-publish-slug"
            maxLength={80}
            onChange={(event) => setSlug(event.target.value)}
            value={slug}
          />
          <p id="wiki-publish-slug-help" role={slugValid ? undefined : "alert"}>
            {slugValid
              ? "Lowercase letters, digits and dashes. Left empty, it follows the Document title. It does not make the page searchable."
              : "Use lowercase letters, digits and single dashes only."}
          </p>
        </section>

        <section aria-labelledby="wiki-publish-embeds" className="grid gap-2">
          <h3 id="wiki-publish-embeds">Embeds</h3>
          <ul className="grid gap-2">
            {preview.embeds.map((embed) => (
              <EmbedRow
                checked={approved.has(embed.id)}
                embed={embed}
                key={embed.id}
                onChange={(on) =>
                  setApproved((current) => toggledEmbed(current, embed.id, on))
                }
              />
            ))}
          </ul>
        </section>

        {preview.placeholders.length > 0 ? (
          <section
            aria-labelledby="wiki-publish-placeholders"
            className="grid gap-2"
          >
            <h3 id="wiki-publish-placeholders">Unresolved placeholders</h3>
            <ul className="grid gap-1">
              {preview.placeholders.map((finding) => (
                <li
                  key={`${finding.embedId ?? "root"}:${finding.field}:${finding.name}:${finding.context}`}
                >
                  {`${finding.sourceRecord.title} / ${finding.field}: ${finding.context}`}
                </li>
              ))}
            </ul>
            <p>Resolve them in the Document, or confirm separately.</p>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={publishAnyway}
                id="wiki-publish-anyway"
                onCheckedChange={(next) => setPublishAnyway(next === true)}
              />
              <label htmlFor="wiki-publish-anyway">
                {WIKI_PUBLISHING_UI_LABELS.publishAnyway}
              </label>
            </div>
          </section>
        ) : null}

        <p>{preview.notice}</p>

        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={blocked || publishing}
            onClick={() =>
              onPublish(
                buildWikiPublishApproval(preview, approved, publishAnyway, {
                  slug,
                  summary,
                }),
              )
            }
            type="button"
          >
            {WIKI_PUBLISHING_UI_LABELS.publishWikiDocument}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
