// biome-ignore-all lint/performance/noJsxPropsBind: approval toggles close over the previewed items.

import {
  type ApproveBuildInPublicInput,
  BUILD_IN_PUBLIC_UI_LABELS,
  type BuildInPublicItem,
  type BuildInPublicPreview,
} from "@cantiara/api/build-in-public";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useState } from "react";
import {
  buildApproval,
  groupedItems,
  initialApproved,
  leavingPlaceholders,
  toggledItem,
  unlabeledWorks,
} from "../../lib/build-in-public-approval";

interface BuildInPublicPreviewPanelProps {
  enabled: boolean;
  onApprove: (approval: ApproveBuildInPublicInput["approval"]) => void;
  preview: BuildInPublicPreview;
  publishing?: boolean;
}

function ItemDetails({ item }: { item: BuildInPublicItem }) {
  return (
    <span className="grid gap-0.5">
      <span>{item.title}</span>
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
  const [approved, setApproved] = useState<ReadonlySet<string>>(() =>
    initialApproved(preview),
  );
  const [publishAnyway, setPublishAnyway] = useState(false);
  const [approvedFor, setApprovedFor] = useState(preview.fingerprint);
  if (approvedFor !== preview.fingerprint) {
    // A changed preview never inherits approvals given to an earlier one.
    setApprovedFor(preview.fingerprint);
    setApproved(initialApproved(preview));
    setPublishAnyway(false);
  }
  const placeholders = leavingPlaceholders(preview, approved);
  const unlabeled = unlabeledWorks(preview, approved);
  const blocked =
    !enabled ||
    unlabeled.length > 0 ||
    (placeholders.length > 0 && !publishAnyway) ||
    approved.size === 0;

  return (
    <section aria-labelledby="bip-preview-title" className="grid gap-3">
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
            onChange={(on) =>
              setApproved((current) => toggledItem(current, item.id, on))
            }
          />,
          ...dependents.map((dependent) => (
            <ItemRow
              checked={approved.has(dependent.id)}
              item={dependent}
              key={dependent.id}
              nested
              onChange={(on) =>
                setApproved((current) => toggledItem(current, dependent.id, on))
              }
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
              onCheckedChange={(next) => setPublishAnyway(next === true)}
            />
            <label htmlFor="bip-publish-anyway">
              {BUILD_IN_PUBLIC_UI_LABELS.publishAnyway}
            </label>
          </div>
        </section>
      ) : null}

      <Button
        disabled={blocked || publishing}
        onClick={() =>
          onApprove(buildApproval(preview, approved, publishAnyway))
        }
        type="button"
      >
        Publish
      </Button>
    </section>
  );
}
