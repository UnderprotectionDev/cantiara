// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and exact Document version.
import type { DocumentEvidenceBinding } from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { createDialogHandle, Dialog } from "@cantiara/ui/components/dialog";
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
  onRebind: (
    binding: DocumentEvidenceBinding,
    trigger: HTMLButtonElement,
  ) => void;
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
        <p className="break-words whitespace-pre-wrap">
          Founder interpretation: {binding.interpretation}
        </p>
      ) : null}
      <p className="break-words whitespace-pre-wrap">
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
              onClick={(event) => onRebind(binding, event.currentTarget)}
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
  const [handle] = useState(
    createDialogHandle<{
      mode: Mode;
      range: Range;
      rebind: DocumentEvidenceBinding | null;
      record: Document;
      trigger: HTMLButtonElement;
    }>,
  );
  function open(
    mode: Mode,
    rebind: DocumentEvidenceBinding | null,
    trigger: HTMLButtonElement,
  ) {
    if (canPin && range && range.end > range.start) {
      handle.openWithPayload({ mode, range, rebind, record, trigger });
    }
  }
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
  return (
    <section aria-label="Document evidence" className="space-y-2">
      <h4 className="font-medium">Version-pinned evidence</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!enabled}
          onClick={(event) => open("bind", null, event.currentTarget)}
          type="button"
          variant="outline"
        >
          Bind as evidence to existing record
        </Button>
        <Button
          disabled={!enabled}
          onClick={(event) => open("create", null, event.currentTarget)}
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
            onRebind={(value, trigger) => open("bind", value, trigger)}
          />
        ))}
      </ul>
      {bindings.data?.some((binding) => binding.newerVersionExists) &&
      !enabled ? (
        <p>Select saved text in the latest version to rebind.</p>
      ) : null}
      <Dialog handle={handle}>
        {({ payload }) =>
          payload ? (
            <DocumentEvidenceForm
              {...payload}
              finalFocus={() =>
                payload.trigger.isConnected ? payload.trigger : true
              }
              onClose={() => handle.close()}
            />
          ) : null
        }
      </Dialog>
    </section>
  );
}
