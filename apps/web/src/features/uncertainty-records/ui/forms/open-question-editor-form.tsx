// biome-ignore-all lint/performance/noJsxPropsBind: Fields and actions bind to the current question form.
import type {
  Document,
  DocumentEvidenceSelection,
} from "@cantiara/api/documents";
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

import {
  openQuestionAnswerFormSchema,
  openQuestionCreateFormSchema,
} from "../../lib/uncertainty-record-form";

export type OpenQuestionRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Open Question" }
>;
export interface OpenQuestionDraft {
  answer: string;
  context: string;
  documentEvidence?: DocumentEvidenceSelection;
  question: string;
  rationale: string;
  title: string;
}

export function OpenQuestionEditor({
  record,
  documents,
  onSave,
  onCancel,
}: {
  record?: OpenQuestionRecord;
  documents: Document[];
  onSave: (
    draft: OpenQuestionDraft,
    record?: OpenQuestionRecord,
  ) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [baseRecord] = useState(record);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  // Pin the offered versions for this editing session; a stale selection conflicts at commit.
  const [evidenceDocuments] = useState(
    documents.filter((item) => item.body.trim() && item.body.length <= 100_000),
  );
  const form = useForm({
    defaultValues: {
      title: "",
      question: "",
      context: "",
      answer: baseRecord?.answer ?? "",
      rationale: baseRecord?.rationale ?? "",
      documentId: "",
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = (
        baseRecord ? openQuestionAnswerFormSchema : openQuestionCreateFormSchema
      ).safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message);
        return;
      }
      const evidence = evidenceDocuments.find(
        (item) => item.id === value.documentId,
      );
      try {
        await onSave(
          {
            ...value,
            ...(evidence
              ? {
                  documentEvidence: {
                    documentId: evidence.id,
                    documentRevision: evidence.revision,
                    selectionStart: 0,
                    selectionEnd: evidence.body.length,
                    selectedText: evidence.body,
                  },
                }
              : {}),
          },
          baseRecord,
        );
      } catch (cause) {
        const stale =
          typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          cause.code === "CONFLICT";
        setConflict(stale);
        setError(
          stale
            ? "Open Question or evidence changed. Cancel and reopen before saving. Your text is kept here."
            : "Open Question could not be saved. Retry, or reload to check for changes. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const fields = baseRecord
    ? ([
        { name: "answer", label: "Answer", required: true },
        { name: "rationale", label: "Rationale (optional)", required: false },
      ] as const)
    : ([
        { name: "title", label: "Title", required: true },
        { name: "question", label: "Question", required: true },
        { name: "context", label: "Context (optional)", required: false },
      ] as const);
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">
        {baseRecord ? "Answered" : "Open Question"}
      </h3>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {fields.map(({ name, label, required }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`question-${name}`}>{label}</label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`question-${name}`}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`question-${name}`}
                        maxLength={100_000}
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
            {baseRecord ? (
              <form.Field name="documentId">
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor="question-evidence">
                      Evidence (optional)
                    </label>
                    <NativeSelect
                      disabled={pending}
                      id="question-evidence"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    >
                      <NativeSelectOption value="">
                        No new evidence
                      </NativeSelectOption>
                      {evidenceDocuments.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.title} — Version {item.revision}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <p className="text-muted-foreground">
                      The selected Document text is pinned to this exact
                      version. Existing evidence is kept.
                    </p>
                  </div>
                )}
              </form.Field>
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
