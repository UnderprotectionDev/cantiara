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
import { useForm, useSelector } from "@tanstack/react-form";
import { type SubmitEvent, useEffect, useRef } from "react";
import {
  EMPTY_WIKI_PUBLISH_FORM,
  isValidWikiSlug,
  leavingPlaceholders,
  parseWikiPublishApproval,
  toggledEmbed,
} from "../../lib/wiki-publish-approval";

interface PublishWikiDialogProps {
  onCancel: () => void;
  onPublish: (
    approval: PublishWikiDocumentInput["approval"],
  ) => Promise<unknown>;
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
  const form = useForm({
    defaultValues: EMPTY_WIKI_PUBLISH_FORM,
    onSubmit: async ({ value }) => {
      const parsed = parseWikiPublishApproval(preview, value);
      if (!parsed.ok) {
        return;
      }
      try {
        await onPublish(parsed.approval);
      } catch {
        // The caller owns the write and its failure presentation; the ticks
        // stay and the dialog remains open.
      }
    },
  });
  const values = useSelector(form.store, (state) => state.values);
  const approved = new Set(values.approved);
  const slugValid = isValidWikiSlug(values.slug);
  const previousFingerprint = useRef(preview.fingerprint);
  useEffect(() => {
    if (previousFingerprint.current !== preview.fingerprint) {
      // A changed preview never inherits approvals given to an earlier one.
      previousFingerprint.current = preview.fingerprint;
      form.setFieldValue("approved", []);
      form.setFieldValue("publishAnyway", false);
    }
  }, [form, preview.fingerprint]);
  const placeholders = leavingPlaceholders(preview, approved);
  const blocked =
    (placeholders.length > 0 && !values.publishAnyway) || !slugValid;
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

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
        <form
          aria-label={WIKI_PUBLISHING_UI_LABELS.publishWikiDocument}
          className="grid gap-4"
          onSubmit={submit}
        >
          <DialogHeader>
            <DialogTitle>
              {WIKI_PUBLISHING_UI_LABELS.publishWikiDocument}
            </DialogTitle>
            <DialogDescription>
              Nothing is public until you approve it. Only this Document and the
              items you tick leave; the rest of your Wiki stays private.
            </DialogDescription>
          </DialogHeader>

          <section
            aria-labelledby="wiki-publish-document"
            className="grid gap-1"
          >
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
            <form.Field name="summary">
              {(field) => (
                <Input
                  id="wiki-publish-summary"
                  maxLength={300}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <Label htmlFor="wiki-publish-slug">Page address (optional)</Label>
            <form.Field name="slug">
              {(field) => (
                <Input
                  aria-describedby="wiki-publish-slug-help"
                  aria-invalid={!slugValid}
                  id="wiki-publish-slug"
                  maxLength={80}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <p
              id="wiki-publish-slug-help"
              role={slugValid ? undefined : "alert"}
            >
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
                    form.setFieldValue("approved", [
                      ...toggledEmbed(approved, embed.id, on),
                    ])
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
                  checked={values.publishAnyway}
                  id="wiki-publish-anyway"
                  onCheckedChange={(next) =>
                    form.setFieldValue("publishAnyway", next === true)
                  }
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
            <Button disabled={blocked || publishing} type="submit">
              {WIKI_PUBLISHING_UI_LABELS.publishWikiDocument}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
