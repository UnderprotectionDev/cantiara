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
  saveError,
  savePending,
  saved,
  transitionFailed,
  transitionPending,
}: {
  records: ValidationRecord[];
  counterparts: ProjectSourceRecord[];
  readOnly: boolean;
  selectedId?: string;
  onSave: Save;
  onTransition: Transition;
  onStartEditing?: () => void;
  saveError?: unknown;
  savePending?: boolean;
  saved?: boolean;
  transitionFailed?: boolean;
  transitionPending?: boolean;
}) {
  const [editing, setEditing] = useState<{ record?: ValidationRecord } | null>(
    null,
  );
  const [status, setStatus] = useState<ValidationRecord["status"]>(
    records.find((record) => record.id === selectedId)?.status ?? "Active",
  );
  async function save(draft: ValidationDraft, record?: ValidationRecord) {
    await onSave(draft, record);
    setEditing(null);
  }
  function transition(
    record: ValidationRecord,
    next: ValidationRecord["status"],
  ) {
    onTransition(record, next).catch(() => undefined);
  }
  const activeEditor = saved ? null : editing;
  const selected = records.find((record) => record.id === selectedId);
  const visible = records.filter((record) =>
    selectedId ? record.id === selectedId : record.status === status,
  );
  return (
    <section aria-label="Validation Record" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          Validation Record
        </h2>
        {readOnly ? null : (
          <Button
            disabled={transitionPending || Boolean(activeEditor)}
            onClick={() => {
              onStartEditing?.();
              setEditing({});
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
        <p className="text-sm text-muted-foreground">
          This Project is archived and read-only.
        </p>
      ) : null}
      {transitionFailed ? (
        <p role="alert">
          Validation Record could not be changed. Reload to check for changes.
        </p>
      ) : null}
      {saved ? <p role="status">Validation Record saved.</p> : null}
      {activeEditor && !readOnly ? (
        <ValidationRecordEditor
          counterparts={counterparts}
          onCancel={() => setEditing(null)}
          onSave={save}
          record={activeEditor.record}
          saveError={saveError}
          savePending={savePending}
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
              <dt className="text-sm font-medium">Method</dt>
              <dd className="text-sm whitespace-pre-wrap text-muted-foreground">
                {record.method}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Result</dt>
              <dd className="text-sm whitespace-pre-wrap text-muted-foreground">
                {record.result || "—"}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Related</h4>
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
                  className="text-sm text-muted-foreground"
                  key={`${link.sourceType}:${link.sourceId}`}
                >
                  Record unavailable
                </p>
              );
            })}
            {record.context.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No context linked.
              </p>
            ) : null}
          </div>
          {readOnly ? null : (
            <div className="flex flex-wrap gap-2">
              {record.status === "Active" ? (
                <>
                  <Button
                    disabled={transitionPending || Boolean(activeEditor)}
                    onClick={() => {
                      onStartEditing?.();
                      setEditing({ record });
                    }}
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={transitionPending || Boolean(activeEditor)}
                    onClick={() => transition(record, "Archived")}
                    variant="outline"
                  >
                    Archive
                  </Button>
                </>
              ) : (
                <Button
                  disabled={transitionPending || Boolean(activeEditor)}
                  onClick={() => transition(record, "Active")}
                  variant="outline"
                >
                  Restore
                </Button>
              )}
              {record.status === "Trash" ? null : (
                <Button
                  disabled={transitionPending || Boolean(activeEditor)}
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
