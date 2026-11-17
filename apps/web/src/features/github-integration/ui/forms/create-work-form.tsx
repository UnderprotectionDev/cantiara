// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import type { GitHubExternalRecord } from "@cantiara/api/github-integration";
import {
  GITHUB_CREATE_WORK_LABEL,
  GITHUB_WORK_TYPES,
  type GitHubCreateWorkPreview,
  type GitHubWorkType,
} from "@cantiara/api/github-work-links";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { errorText } from "../../lib/github-error-text";
import {
  parseCreateWork,
  parsePreviewCreateWork,
} from "../../lib/github-forms";

export type PreviewCreateWork = (
  recordId: string,
) => Promise<GitHubCreateWorkPreview>;
export type SubmitCreateWork = (values: {
  description: string;
  recordId: string;
  title: string;
  type: GitHubWorkType;
}) => Promise<unknown>;

function DraftForm({
  onCancel,
  onCreate,
  preview,
}: {
  onCancel: () => void;
  onCreate: SubmitCreateWork;
  preview: GitHubCreateWorkPreview;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      description: preview.draft.description,
      title: preview.draft.title,
      type: preview.draft.type as GitHubWorkType,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = parseCreateWork({
        description: value.description,
        recordId: preview.recordId,
        title: value.title,
        type: value.type,
      });
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      try {
        await onCreate(parsed.data);
        onCancel();
      } catch (caught) {
        setError(errorText(caught, "The Work was not created."));
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  return (
    <form
      aria-label={`${GITHUB_CREATE_WORK_LABEL} draft`}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <p className="text-muted-foreground text-sm">
        {`Draft from Issue #${preview.source.number}. Starting status ${preview.draft.startingStatus}.`}
      </p>
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-draft-title">Title</label>
        <form.Field name="title">
          {(field) => (
            <Input
              id="github-draft-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-draft-description">Description</label>
        <form.Field name="description">
          {(field) => (
            <Textarea
              id="github-draft-description"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="github-draft-type">Type</label>
        <form.Field name="type">
          {(field) => (
            <NativeSelect
              className="w-full"
              id="github-draft-type"
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.target.value as GitHubWorkType)
              }
              value={field.state.value}
            >
              {GITHUB_WORK_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <ul className="list-disc pl-5 text-muted-foreground text-sm">
        {preview.effects.map((effect) => (
          <li key={effect}>{effect}</li>
        ))}
      </ul>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} type="submit">
          {GITHUB_CREATE_WORK_LABEL}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * `Create work and link`: pick an Issue, read the one-time draft, then confirm.
 * Nothing is created before the confirm and no field syncs afterwards.
 */
export function CreateWorkForm({
  onCreate,
  onPreview,
  records,
}: {
  onCreate: SubmitCreateWork;
  onPreview: PreviewCreateWork;
  records: GitHubExternalRecord[];
}) {
  const issues = records.filter((record) => record.kind === "Issue");
  const [preview, setPreview] = useState<GitHubCreateWorkPreview>();
  const [error, setError] = useState<string>();
  const headingId = "github-create-work-heading";
  const pickForm = useForm({
    defaultValues: { recordId: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = parsePreviewCreateWork(value);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      try {
        setPreview(await onPreview(parsed.data.recordId));
      } catch (caught) {
        setError(errorText(caught, "The draft is unavailable."));
      }
    },
  });
  const loading = useStore(pickForm.store, (state) => state.isSubmitting);
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-lg border border-border/70 p-4"
    >
      <h4 className="font-medium" id={headingId}>
        {GITHUB_CREATE_WORK_LABEL}
      </h4>
      {preview ? (
        <DraftForm
          onCancel={() => setPreview(undefined)}
          onCreate={onCreate}
          preview={preview}
        />
      ) : (
        <form
          aria-label="Preview Work draft"
          className="space-y-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            pickForm.handleSubmit().catch(() => undefined);
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="github-create-work-issue">Issue</label>
            <pickForm.Field name="recordId">
              {(field) => (
                <NativeSelect
                  className="w-full"
                  id="github-create-work-issue"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Choose an Issue
                  </NativeSelectOption>
                  {issues.map((record) => (
                    <NativeSelectOption key={record.id} value={record.id}>
                      {`#${record.number} ${record.title}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </pickForm.Field>
          </div>
          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={loading} type="submit" variant="outline">
            Preview Work draft
          </Button>
        </form>
      )}
    </section>
  );
}
