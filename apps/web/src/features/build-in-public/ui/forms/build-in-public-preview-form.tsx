// biome-ignore-all lint/performance/noJsxPropsBind: approval toggles close over the previewed items.

import {
  type ApproveBuildInPublicInput,
  BUILD_IN_PUBLIC_UI_LABELS,
  type BuildInPublicItem,
  type BuildInPublicPreview,
  MAX_EXPLANATION_LENGTH,
} from "@cantiara/api/build-in-public";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef } from "react";
import { DateTimePicker } from "@/components/date-picker";
import {
  featureCandidates,
  featuredEndsAt,
  groupedItems,
  initialPreviewFormValues,
  leavingPlaceholders,
  memberRecordId,
  parseBuildInPublicApproval,
  toggledItem,
  unlabeledWorks,
} from "../../lib/build-in-public-approval";

interface BuildInPublicPreviewPanelProps {
  enabled: boolean;
  onApprove: (
    approval: ApproveBuildInPublicInput["approval"],
  ) => Promise<unknown>;
  preview: BuildInPublicPreview;
  publishing?: boolean;
}

function ItemDetails({ item }: { item: BuildInPublicItem }) {
  return (
    <span className="grid gap-0.5">
      <span>{item.title}</span>
      {item.kind === "Project member" ? (
        <span>{`Shown in the public Project view as ${item.memberKind ?? "record"}`}</span>
      ) : null}
      {item.kind === "Roadmap Work" ? (
        <span>
          {`${BUILD_IN_PUBLIC_UI_LABELS.publicStatusLabel}: ${item.publicStatusLabel ?? "None"} (from ${item.internalStatus ?? "unknown"}, ${item.labelSource ?? "unmapped"})`}
        </span>
      ) : null}
      {item.fields.map((field) => (
        <span key={field.name}>{`${field.name}: ${field.value}`}</span>
      ))}
      {item.files.map((file) => (
        <span key={file.attachmentId}>
          {`File: ${file.name} (version ${file.version})`}
        </span>
      ))}
      {item.change === "Unpublished changes" ? (
        <span>{BUILD_IN_PUBLIC_UI_LABELS.unpublishedChanges}</span>
      ) : null}
      {item.diff.map((row) => (
        <span key={row.field}>
          {`${row.field}: ${row.approved ?? "none"} to ${row.proposed ?? "removed"}`}
        </span>
      ))}
      {item.blocker ? <span role="alert">{item.blocker}</span> : null}
    </span>
  );
}

function ItemRow({
  checked,
  item,
  nested,
  onChange,
}: {
  checked: boolean;
  item: BuildInPublicItem;
  nested?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = `bip-item-${item.id}`;
  return (
    <li
      className={
        nested ? "ml-6 flex items-start gap-2" : "flex items-start gap-2"
      }
    >
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <label className="grid gap-0.5" htmlFor={id}>
        <span>{`Include ${item.kind}`}</span>
        <ItemDetails item={item} />
      </label>
    </li>
  );
}

/**
 * The closed-world preview of a Project's Build in Public snapshot. It writes
 * nothing: every Roadmap Work, label suggestion, File Attachment version,
 * embed and metadata block is its own approval item, and an unticked item
 * does not leave.
 */
export function BuildInPublicPreviewPanel({
  enabled,
  onApprove,
  preview,
  publishing = false,
}: BuildInPublicPreviewPanelProps) {
  const form = useForm({
    defaultValues: initialPreviewFormValues(preview),
    onSubmit: async ({ value }) => {
      const parsed = parseBuildInPublicApproval(preview, value);
      if (!parsed.ok) {
        return;
      }
      try {
        await onApprove(parsed.approval);
      } catch {
        // The caller owns the write and its failure presentation; the
        // ticked items stay.
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const approved = new Set(values.approved);
  const { featuredRecord, featuredUntil, publishAnyway } = values;
  const previousFingerprint = useRef(preview.fingerprint);
  useEffect(() => {
    if (previousFingerprint.current !== preview.fingerprint) {
      // A changed preview never inherits approvals given to an earlier one.
      previousFingerprint.current = preview.fingerprint;
      form.reset(initialPreviewFormValues(preview));
    }
  }, [form, preview]);
  const candidates = featureCandidates(preview, approved);
  const endsAt = featuredEndsAt(featuredUntil);
  // Featuring is off unless a record and an end time are both chosen.
  const featuredIncomplete = Boolean(featuredRecord) !== Boolean(endsAt);
  const toggle = (id: string, on: boolean) =>
    form.setFieldValue("approved", [...toggledItem(approved, id, on)]);
  const placeholders = leavingPlaceholders(preview, approved);
  const unlabeled = unlabeledWorks(preview, approved);
  const blocked =
    !enabled ||
    unlabeled.length > 0 ||
    (placeholders.length > 0 && !publishAnyway) ||
    approved.size === 0 ||
    featuredIncomplete;

  return (
    <form
      aria-labelledby="bip-preview-title"
      className="grid gap-3"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h2 id="bip-preview-title">{BUILD_IN_PUBLIC_UI_LABELS.buildInPublic}</h2>
      <p>{preview.notice}</p>
      {enabled ? null : (
        <p role="status">Enable Build in Public for this Project to publish.</p>
      )}

      <ul className="grid gap-2">
        {groupedItems(preview).flatMap(({ dependents, item }) => [
          <ItemRow
            checked={approved.has(item.id)}
            item={item}
            key={item.id}
            onChange={(on) => toggle(item.id, on)}
          />,
          ...dependents.map((dependent) => (
            <ItemRow
              checked={approved.has(dependent.id)}
              item={dependent}
              key={dependent.id}
              nested
              onChange={(on) => toggle(dependent.id, on)}
            />
          )),
        ])}
      </ul>

      {placeholders.length > 0 ? (
        <section aria-labelledby="bip-placeholders" className="grid gap-2">
          <h3 id="bip-placeholders">Unresolved placeholders</h3>
          <ul className="grid gap-1">
            {placeholders.map((finding) => (
              <li
                key={`${finding.itemId}:${finding.field}:${finding.name}:${finding.context}`}
              >
                {`${finding.sourceRecord.title} / ${finding.field}: ${finding.context}`}
              </li>
            ))}
          </ul>
          <p>Resolve them in the source record, or confirm separately.</p>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={publishAnyway}
              id="bip-publish-anyway"
              onCheckedChange={(next) =>
                form.setFieldValue("publishAnyway", next === true)
              }
            />
            <label htmlFor="bip-publish-anyway">
              {BUILD_IN_PUBLIC_UI_LABELS.publishAnyway}
            </label>
          </div>
        </section>
      ) : null}

      {preview.planChanges.length > 0 ? (
        <section aria-labelledby="bip-explain" className="grid gap-2">
          <h3 id="bip-explain">{BUILD_IN_PUBLIC_UI_LABELS.explainTheChange}</h3>
          <p>
            This publish changes what visitors read of the plan. Optional: write
            your own note for the Development feed. Nothing is generated.
          </p>
          <ul className="grid gap-1">
            {preview.planChanges.map((change) => (
              <li key={`${change.memberId}:${change.kind}`}>
                {`${change.title}: ${change.kind} (${change.from ?? "None"} to ${change.to ?? "None"})`}
              </li>
            ))}
          </ul>
          <label htmlFor="bip-explanation">
            {BUILD_IN_PUBLIC_UI_LABELS.explainTheChange}
          </label>
          <form.Field name="explanation">
            {(field) => (
              <Textarea
                id="bip-explanation"
                maxLength={MAX_EXPLANATION_LENGTH}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            )}
          </form.Field>
        </section>
      ) : null}

      <section aria-labelledby="bip-featured" className="grid gap-2">
        <h3 id="bip-featured">Featured record</h3>
        <p>
          Off by default. One previously approved Project Release or Decision
          stays on top of the Project view until the end time, then returns to
          its place.
        </p>
        <label htmlFor="bip-featured-record">Record</label>
        <form.Field name="featuredRecord">
          {(field) => (
            <NativeSelect
              id="bip-featured-record"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <option value="">Not featured</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={memberRecordId(candidate)}>
                  {candidate.title}
                </option>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        <form.Field name="featuredUntil">
          {(field) => (
            <DateTimePicker
              ariaLabel="Featured until"
              disabled={!featuredRecord}
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </form.Field>
        {featuredIncomplete ? (
          <p role="alert">Choose both a record and an end time.</p>
        ) : null}
      </section>

      <Button disabled={blocked || publishing} type="submit">
        Publish
      </Button>
    </form>
  );
}
