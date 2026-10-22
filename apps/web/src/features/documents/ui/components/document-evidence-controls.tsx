// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and exact Document version.
import type { DocumentEvidenceBinding } from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { AppLink } from "@/components/app-link";
import {
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";
import { orpc } from "@/utils/orpc";
import DocumentEvidenceForm from "../forms/document-evidence-form";
import DocumentEvidenceRoleForm from "../forms/document-evidence-role-form";

type Mode = "bind" | "create";
interface Range {
  end: number;
  start: number;
}
interface Props {
  /** True while the editor body equals the saved version the pin would reference. */
  canPin: boolean;
  range: Range | null;
  record: Document;
}

function targetHref(target: DocumentEvidenceBinding["target"]) {
  if (!(target.projectId && target.canOpenSourceRecord)) {
    return null;
  }
  if (target.type === "Work") {
    return workRecordHref(target.projectId, target.recordId);
  }
  return `/projects/${encodeURIComponent(target.projectId)}#${projectSourceRecordHash(
    target.type,
    target.recordId,
  )}`;
}

export function EvidenceRow({
  binding,
  editor,
  onRebind,
}: {
  binding: DocumentEvidenceBinding;
  /** Role and Founder interpretation editor; omitted in read-only presentations. */
  editor?: ReactNode;
  onRebind: (binding: DocumentEvidenceBinding) => void;
}) {
  const href = targetHref(binding.target);
  return (
    <li className="space-y-1 rounded-lg border p-3">
      <p className="font-medium">
        {binding.target.type}: {binding.target.label ?? "Unavailable record"}
        {binding.target.brokenReason
          ? ` (${binding.target.brokenReason})`
          : null}
      </p>
      <p>
        Version {binding.pin.source.revision} · Range {binding.pin.start}–
        {binding.pin.end} · {binding.role}
      </p>
      {binding.interpretation ? (
        <p className="whitespace-pre-wrap break-words">
          Founder interpretation: {binding.interpretation}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap break-words">
        {binding.pin.before}
        <mark>{binding.pin.excerpt}</mark>
        {binding.pin.after}
      </p>
      {binding.origin ? <p>Origin Location: this Document</p> : null}
      {binding.newerVersionExists ? (
        <p>
          Newer version exists · Version {binding.currentRevision}.{" "}
          {binding.readOnly ? null : (
            <Button
              onClick={() => onRebind(binding)}
              type="button"
              variant="outline"
            >
              Rebind to new version
            </Button>
          )}
        </p>
      ) : null}
      {href ? <AppLink href={href}>Open target record</AppLink> : null}
      {editor}
    </li>
  );
}

export default function DocumentEvidenceControls({
  canPin,
  range,
  record,
}: Props) {
  const [dialog, setDialog] = useState<{
    mode: Mode;
    rebind: DocumentEvidenceBinding | null;
  } | null>(null);
  const [rebindRange, setRebindRange] = useState<Range | null>(null);
  const { projectId } = record;
  const bindings = useQuery({
    ...orpc.documentEvidenceBindings.queryOptions({
      input: { documentId: record.id, projectId: projectId ?? "" },
    }),
    enabled: Boolean(projectId),
  });
  if (!projectId) {
    return null;
  }
  const selected = range && range.end > range.start ? range : null;
  const enabled = canPin && selected !== null;
  const active = dialog?.rebind ? rebindRange : selected;
  return (
    <section aria-label="Document evidence" className="space-y-2">
      <h4 className="font-medium">Version-pinned evidence</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!enabled}
          onClick={() => setDialog({ mode: "bind", rebind: null })}
          type="button"
          variant="outline"
        >
          Bind as evidence to existing record
        </Button>
        <Button
          disabled={!enabled}
          onClick={() => setDialog({ mode: "create", rebind: null })}
          type="button"
          variant="outline"
        >
          Convert to new record and bind
        </Button>
      </div>
      {bindings.isError ? (
        <p role="alert">Version-pinned evidence could not be loaded.</p>
      ) : null}
      <ul className="space-y-2">
        {(bindings.data ?? []).map((binding) => (
          <EvidenceRow
            binding={binding}
            editor={
              binding.readOnly ? null : (
                <DocumentEvidenceRoleForm binding={binding} record={record} />
              )
            }
            key={`${binding.id}:${binding.revision}`}
            onRebind={(value) => {
              // A rebind pins the currently selected saved text; the old pin is never moved.
              if (!enabled) {
                return;
              }
              setRebindRange(selected);
              setDialog({ mode: "bind", rebind: value });
            }}
          />
        ))}
      </ul>
      {bindings.data?.some((binding) => binding.newerVersionExists) &&
      !enabled ? (
        <p>Select saved text in the latest version to rebind.</p>
      ) : null}
      {dialog && active ? (
        <DocumentEvidenceForm
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          range={active}
          rebind={dialog.rebind}
          record={record}
        />
      ) : null}
    </section>
  );
}
