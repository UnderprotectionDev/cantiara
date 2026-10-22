// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.

import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import type {
  Save,
  ValidationDraft,
  ValidationRecord,
} from "../../lib/validation-record";
import { ValidationRecordEditor } from "../forms/validation-record-editor-form";

type Transition = (
  record: ValidationRecord,
  status: ValidationRecord["status"],
) => Promise<unknown>;
export function ValidationRecordsView({
  records,
  counterparts,
  readOnly,
  selectedId,
  onSave,
  onTransition,
  onStartEditing,
}: {
  records: ValidationRecord[];
  counterparts: ProjectSourceRecord[];
  readOnly: boolean;
  selectedId?: string;
  onSave: Save;
  onTransition: Transition;
  onStartEditing?: () => void;
}) {
  const [editing, setEditing] = useState<{ record?: ValidationRecord } | null>(
    null,
  );
  const [status, setStatus] = useState<ValidationRecord["status"]>(
    records.find((record) => record.id === selectedId)?.status ?? "Active",
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  async function save(draft: ValidationDraft, record?: ValidationRecord) {
    await onSave(draft, record);
    setEditing(null);
    setMessage("Validation Record saved.");
  }
  async function transition(
    record: ValidationRecord,
    next: ValidationRecord["status"],
  ) {
    setError(undefined);
    setBusy(true);
    try {
      await onTransition(record, next);
      setMessage("Validation Record saved.");
    } catch {
      setError(
        "Validation Record could not be changed. Reload to check for changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selected = records.find((record) => record.id === selectedId);
  const visible = records.filter((record) =>
    selectedId ? record.id === selectedId : record.status === status,
  );
  return (
    <section aria-label="Validation Record" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">
          Validation Record
        </h2>
        {readOnly ? null : (
          <Button
            disabled={busy || Boolean(editing)}
            onClick={() => {
              onStartEditing?.();
              setEditing({});
              setMessage(undefined);
            }}
          >
            Create
          </Button>
        )}
      </header>
      <div className="grid max-w-xs gap-2 text-sm">
        <label htmlFor="validation-status">Status</label>
        <NativeSelect
          disabled={Boolean(selectedId)}
          id="validation-status"
          onChange={(event) => {
            const next = event.target.value;
            if (next === "Active" || next === "Archived" || next === "Trash") {
              setStatus(next);
            }
          }}
          value={selected?.status ?? status}
        >
          <NativeSelectOption value="Active">Active</NativeSelectOption>
          <NativeSelectOption value="Archived">Archived</NativeSelectOption>
          <NativeSelectOption value="Trash">Trash</NativeSelectOption>
        </NativeSelect>
      </div>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived and read-only.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {editing && !readOnly ? (
        <ValidationRecordEditor
          counterparts={counterparts}
          onCancel={() => setEditing(null)}
          onSave={save}
          record={editing.record}
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          No Validation Records in this view.
        </p>
      ) : null}
      {visible.map((record) => (
        <article
          className="space-y-4 rounded-lg border border-border/70 bg-card/35 p-5"
          key={record.id}
        >
          <h3 className="font-medium">
            <AppLink
              className="underline"
              href={`#${projectSourceRecordHash("Validation Record", record.id)}`}
            >
              {record.title}
            </AppLink>
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium text-sm">Method</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground text-sm">
                {record.method}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sm">Result</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground text-sm">
                {record.result || "—"}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Related</h4>
            {record.context.map((link) => {
              const source = counterparts.find(
                (candidate) =>
                  candidate.sourceType === link.sourceType &&
                  candidate.id === link.sourceId,
              );
              return source && "title" in source ? (
                <AppLink
                  className="block text-sm underline"
                  href={`#${projectSourceRecordHash(link.sourceType, link.sourceId)}`}
                  key={`${link.sourceType}:${link.sourceId}`}
                >
                  {link.sourceType}: {source.title}
                </AppLink>
              ) : (
                <p
                  className="text-muted-foreground text-sm"
                  key={`${link.sourceType}:${link.sourceId}`}
                >
                  Record unavailable
                </p>
              );
            })}
            {record.context.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No context linked.
              </p>
            ) : null}
          </div>
          {readOnly ? null : (
            <div className="flex flex-wrap gap-2">
              {record.status === "Active" ? (
                <>
                  <Button
                    disabled={busy || Boolean(editing)}
                    onClick={() => {
                      onStartEditing?.();
                      setEditing({ record });
                      setMessage(undefined);
                    }}
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={busy || Boolean(editing)}
                    onClick={() => transition(record, "Archived")}
                    variant="outline"
                  >
                    Archive
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || Boolean(editing)}
                  onClick={() => transition(record, "Active")}
                  variant="outline"
                >
                  Restore
                </Button>
              )}
              {record.status === "Trash" ? null : (
                <Button
                  disabled={busy || Boolean(editing)}
                  onClick={() => transition(record, "Trash")}
                  variant="outline"
                >
                  Move to Trash
                </Button>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
