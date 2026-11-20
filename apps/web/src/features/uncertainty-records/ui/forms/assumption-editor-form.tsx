// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the current record and form field.

import type {
  Document,
  DocumentEvidenceSelection,
} from "@cantiara/api/documents";
import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { type SubmitEvent, useState } from "react";
import { submitForm } from "@/lib/submit-form";

import { assumptionFormSchema } from "../../lib/uncertainty-record-form";

export interface AssumptionDraft {
  documentEvidence?: DocumentEvidenceSelection;
  rationale: string;
  statement: string;
  title: string;
}
export type AssumptionLife = AssumptionRecord["life"];
export type Save = (
  draft: AssumptionDraft,
  record?: AssumptionRecord,
) => Promise<unknown>;
const FIELDS = [
  { name: "title", label: "Title", required: true, maxLength: 255 },
  { name: "statement", label: "Statement", required: true, maxLength: 100_000 },
  {
    name: "rationale",
    label: "Rationale",
    required: false,
    maxLength: 100_000,
  },
] as const;

export function AssumptionEditor({
  record,
  life,
  documents = [],
  onSave,
  onCancel,
}: {
  record?: AssumptionRecord;
  life?: AssumptionLife;
  documents?: Document[];
  onSave: Save;
  onCancel: () => void;
}) {
  const [conflict, setConflict] = useState(false);
  const outcome = life === "Confirmed" || life === "Refuted";
  // Keep each editing session pinned to the versions it offered; a stale choice must conflict at commit.
  const form = useForm({
    defaultValues: {
      baseRecord: record,
      evidenceDocuments: documents.filter(
        (doc) => doc.body.trim().length > 0 && doc.body.length <= 100_000,
      ),
      title: record?.title ?? "",
      statement: record?.statement ?? "",
      rationale: life ? "" : (record?.rationale ?? ""),
      documentId: "",
    },
    onSubmit: async ({
      value: { baseRecord, evidenceDocuments, ...value },
    }) => {
      form.setErrorMap({ onSubmit: undefined });
      if (!life) {
        const parsed = assumptionFormSchema.safeParse(value);
        if (!parsed.success) {
          form.setErrorMap({
            onSubmit: { form: parsed.error.issues[0]?.message, fields: {} },
          });
          return;
        }
      }
      const selected = evidenceDocuments.find(
        (doc) => doc.id === value.documentId,
      );
      if (outcome && value.documentId && !selected) {
        form.setErrorMap({
          onSubmit: {
            form: "Evidence is unavailable. Choose it again before saving.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onSave(
          {
            title: value.title,
            statement: value.statement,
            rationale: value.rationale,
            ...(outcome && selected
              ? {
                  documentEvidence: {
                    documentId: selected.id,
                    documentRevision: selected.revision,
                    selectionStart: 0,
                    selectionEnd: selected.body.length,
                    selectedText: selected.body,
                  },
                }
              : {}),
          },
          baseRecord,
        );
      } catch (saveError) {
        const changed =
          typeof saveError === "object" &&
          saveError !== null &&
          "code" in saveError &&
          saveError.code === "CONFLICT";
        setConflict(changed);
        form.setErrorMap({
          onSubmit: {
            form: changed
              ? "Assumption or Evidence changed. Cancel and reopen before saving again. Your text is kept here."
              : "Assumption could not be saved. Retry, or reload to check for changes. Your text is kept here.",
            fields: {},
          },
        });
      }
    },
  });
  const { evidenceDocuments: offeredDocuments } = useSelector(
    form.store,
    (state) => state.values,
  );
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{life ?? "Assumption"}</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {FIELDS.filter(
              ({ name }) => !life || (outcome && name === "rationale"),
            ).map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`assumption-${name}`}>
                      {label}
                      {required ? "" : " (optional)"}
                    </label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`assumption-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`assumption-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            {outcome ? (
              <form.Field name="documentId">
                {(field) => {
                  const selected = offeredDocuments.find(
                    (doc) => doc.id === field.state.value,
                  );
                  return (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor="assumption-evidence">
                        Evidence (optional)
                      </label>
                      <NativeSelect
                        disabled={pending}
                        id="assumption-evidence"
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          No new evidence
                        </NativeSelectOption>
                        {offeredDocuments.map((doc) => (
                          <NativeSelectOption key={doc.id} value={doc.id}>
                            {doc.title} — Version {doc.revision}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <p className="text-muted-foreground">
                        The selected Document text is pinned to this version.
                        Evidence is optional.
                      </p>
                      {selected ? (
                        <pre className="max-h-48 overflow-auto rounded border p-3 break-words whitespace-pre-wrap">
                          {selected.body}
                        </pre>
                      ) : null}
                    </div>
                  );
                }}
              </form.Field>
            ) : null}
            {life === "No longer applicable" ? (
              <p>Existing Statement, Rationale and Evidence are kept.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                disabled={pending}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
