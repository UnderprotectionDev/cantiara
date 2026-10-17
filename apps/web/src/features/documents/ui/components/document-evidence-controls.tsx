// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and exact Document version.
import {
  DOCUMENT_EVIDENCE_TARGET_TYPES,
  type DocumentEvidenceBinding,
  type DocumentEvidenceHistoryEntry,
  type DocumentEvidencePlan,
  EVIDENCE_ROLES,
  type EvidenceRole,
} from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import {
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

type TargetType = (typeof DOCUMENT_EVIDENCE_TARGET_TYPES)[number];
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

export function EvidencePreview({ plan }: { plan: DocumentEvidencePlan }) {
  const newFields = Object.entries(plan.fields).filter(
    ([, value]) => value !== null,
  );
  return (
    <section aria-label="Evidence preview" className="space-y-1">
      <p>
        {plan.mode === "create" ? "New record" : "Existing record"} ·{" "}
        {(plan.newRecord ?? plan.target)?.type}: {plan.targetTitle}
      </p>
      <p>
        Document · Version {plan.pin.source.revision} · Range {plan.pin.start}–
        {plan.pin.end}
      </p>
      <p className="whitespace-pre-wrap break-words">{plan.pin.excerpt}</p>
      {plan.mode === "create" ? (
        <dl>
          {newFields.map(([name, value]) => (
            <div key={name}>
              <dt className="font-medium">{name}</dt>
              <dd className="whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p>Evidence Role: Unspecified. The source text stays in place.</p>
    </section>
  );
}

function EvidenceDialog({
  mode,
  onClose,
  range,
  rebind,
  record,
}: {
  mode: Mode;
  onClose: () => void;
  range: Range;
  rebind: DocumentEvidenceBinding | null;
  record: Document;
}) {
  const { projectId } = record;
  const cache = useQueryClient();
  const [type, setType] = useState<TargetType>("Work");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState<
    "Task" | "Bug" | "Research" | "Improvement"
  >("Task");
  const [plan, setPlan] = useState<DocumentEvidencePlan | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const command = useRef<{ id: string; key: string; recordId: string } | null>(
    null,
  );
  const selection = { documentId: record.id, projectId: projectId ?? "" };
  const targets = useQuery({
    ...orpc.documentEvidenceTargets.queryOptions({ input: selection }),
    enabled: Boolean(projectId) && mode === "bind" && !rebind,
  });
  const candidates = (targets.data ?? []).filter(
    (target) => target.type === type,
  );
  let ready = true;
  if (!rebind) {
    ready = mode === "bind" ? targetId.length > 0 : title.trim().length > 0;
  }

  function changed() {
    setPlan(null);
    command.current = null;
  }
  function request(
    base: {
      documentId: string;
      end: number;
      projectId: string;
      start: number;
      versionRevision: number;
    },
    chosen: (typeof candidates)[number] | undefined,
  ) {
    if (rebind) {
      return { ...base, bindingId: rebind.id };
    }
    if (mode === "bind" && chosen) {
      return {
        ...base,
        target: {
          type: chosen.type,
          projectId: chosen.projectId,
          recordId: chosen.recordId,
        },
      };
    }
    return {
      ...base,
      newRecord: {
        type,
        projectId: base.projectId,
        title,
        ...(type === "Work" ? { workType } : {}),
      },
    };
  }
  async function preview() {
    if (!projectId || pending) {
      return;
    }
    // A new preview is a new command; a failed confirm's key must not replay against a changed plan.
    command.current = null;
    const chosen = candidates.find((target) => target.recordId === targetId);
    setPending(true);
    setError(null);
    try {
      const base = {
        ...selection,
        versionRevision: record.revision,
        start: range.start,
        end: range.end,
      };
      setPlan(await client.previewDocumentEvidence(request(base, chosen)));
    } catch {
      setError(
        "Evidence preview is unavailable. Save the Document and reselect the text.",
      );
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    if (!plan || pending) {
      return;
    }
    command.current ??= {
      id: rebind?.id ?? crypto.randomUUID(),
      key: crypto.randomUUID(),
      recordId: crypto.randomUUID(),
    };
    const identity = command.current;
    setPending(true);
    setError(null);
    try {
      await runOnlineOnlyWrite(() =>
        client.confirmDocumentEvidence({
          ...selection,
          id: identity.id,
          baseRevision: plan.bindingRevision,
          clientIdempotencyKey: identity.key,
          plan,
          ...(plan.mode === "create" ? { recordId: identity.recordId } : {}),
        }),
      );
      command.current = null;
      await cache.invalidateQueries({
        queryKey: orpc.documentEvidenceBindings.key(),
      });
      onClose();
    } catch {
      setError(
        "Evidence could not be saved. Reload if the Document or target changed, then preview again.",
      );
    } finally {
      setPending(false);
    }
  }
  let heading = "Bind as evidence to existing record";
  if (rebind) {
    heading = "Rebind to new version";
  } else if (mode === "create") {
    heading = "Convert to new record and bind";
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            Version {record.revision} · Range {range.start}–{range.end}. This
            creates no AI summary and exactly one{" "}
            {mode === "create" ? "new record" : "evidence relation"}.
          </DialogDescription>
        </DialogHeader>
        {rebind ? null : (
          <div className="space-y-2">
            <Label htmlFor="document-evidence-type">Record type</Label>
            <NativeSelect
              id="document-evidence-type"
              onChange={(event) => {
                setType(event.target.value as TargetType);
                setTargetId("");
                changed();
              }}
              value={type}
            >
              {DOCUMENT_EVIDENCE_TARGET_TYPES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {mode === "bind" ? (
              <>
                <Label htmlFor="document-evidence-record">
                  Existing record
                </Label>
                <NativeSelect
                  id="document-evidence-record"
                  onChange={(event) => {
                    setTargetId(event.target.value);
                    changed();
                  }}
                  value={targetId}
                >
                  <NativeSelectOption value="">
                    Choose a record
                  </NativeSelectOption>
                  {candidates.map((target) => (
                    <NativeSelectOption
                      key={target.recordId}
                      value={target.recordId}
                    >
                      {target.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </>
            ) : (
              <>
                <Label htmlFor="document-evidence-title">Title</Label>
                <Input
                  id="document-evidence-title"
                  maxLength={255}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    changed();
                  }}
                  value={title}
                />
                {type === "Work" ? (
                  <>
                    <Label htmlFor="document-evidence-work-type">
                      Work type
                    </Label>
                    <NativeSelect
                      id="document-evidence-work-type"
                      onChange={(event) => {
                        setWorkType(event.target.value as typeof workType);
                        changed();
                      }}
                      value={workType}
                    >
                      {(
                        ["Task", "Bug", "Research", "Improvement"] as const
                      ).map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
        {plan ? <EvidencePreview plan={plan} /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!ready || pending}
            onClick={preview}
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          <Button disabled={!plan || pending} onClick={confirm} type="button">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Role is the founder's own choice on the relation; interpretation is separate from the source text. */
export function EvidenceRoleEditor({
  binding,
  record,
}: {
  binding: DocumentEvidenceBinding;
  record: Document;
}) {
  const cache = useQueryClient();
  const [role, setRole] = useState<EvidenceRole>(binding.role);
  const [interpretation, setInterpretation] = useState(
    binding.interpretation ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const command = useRef<string | null>(null);
  const selection = {
    documentId: record.id,
    projectId: record.projectId ?? "",
  };
  const history = useQuery({
    ...orpc.documentEvidenceHistory.queryOptions({
      input: { ...selection, id: binding.id },
    }),
    enabled: Boolean(record.projectId),
  });
  const dirty =
    role !== binding.role || interpretation !== (binding.interpretation ?? "");

  async function save() {
    if (pending || !dirty) {
      return;
    }
    command.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      await runOnlineOnlyWrite(() =>
        client.setDocumentEvidenceRole({
          ...selection,
          id: binding.id,
          baseRevision: binding.revision,
          clientIdempotencyKey: command.current ?? crypto.randomUUID(),
          role,
          interpretation,
        }),
      );
      command.current = null;
      await cache.invalidateQueries({
        queryKey: orpc.documentEvidenceBindings.key(),
      });
      await cache.invalidateQueries({
        queryKey: orpc.documentEvidenceHistory.key(),
      });
    } catch {
      setError("Evidence Role could not be saved. Reload and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={`evidence-role-${binding.id}`}>Evidence Role</Label>
      <NativeSelect
        id={`evidence-role-${binding.id}`}
        onChange={(event) => {
          setRole(event.target.value as EvidenceRole);
          command.current = null;
        }}
        value={role}
      >
        {EVIDENCE_ROLES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {value}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Label htmlFor={`evidence-interpretation-${binding.id}`}>
        Founder interpretation
      </Label>
      <Textarea
        id={`evidence-interpretation-${binding.id}`}
        maxLength={5000}
        onChange={(event) => {
          setInterpretation(event.target.value);
          command.current = null;
        }}
        value={interpretation}
      />
      <Button
        disabled={!dirty || pending}
        onClick={save}
        type="button"
        variant="outline"
      >
        Save Evidence Role
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      <EvidenceRoleHistory entries={history.data ?? []} />
    </div>
  );
}

export function EvidenceRoleHistory({
  entries,
}: {
  entries: DocumentEvidenceHistoryEntry[];
}) {
  if (!entries.length) {
    return null;
  }
  return (
    <section aria-label="Evidence Role history">
      <h5 className="font-medium">Evidence Role history</h5>
      <ul>
        {entries.map((entry) => (
          <li key={entry.revision}>
            {entry.previousRole} → {entry.role} · {entry.actorId} ·{" "}
            {entry.changedAt}
            {entry.previousInterpretation === entry.interpretation
              ? null
              : ` · Previous interpretation: ${entry.previousInterpretation ?? "none"}`}
          </li>
        ))}
      </ul>
    </section>
  );
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
      {href ? <a href={href}>Open target record</a> : null}
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
                <EvidenceRoleEditor binding={binding} record={record} />
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
        <EvidenceDialog
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
