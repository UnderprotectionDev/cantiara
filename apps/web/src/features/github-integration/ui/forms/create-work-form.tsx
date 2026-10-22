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
      if (!value.title.trim()) {
        setError("Enter a title.");
        return;
      }
      try {
        await onCreate({
          description: value.description,
          recordId: preview.recordId,
          title: value.title.trim(),
          type: value.type,
        });
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
  const [recordId, setRecordId] = useState("");
  const [preview, setPreview] = useState<GitHubCreateWorkPreview>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const headingId = "github-create-work-heading";
  const loadPreview = () => {
    setError(undefined);
    if (!recordId) {
      setError("Choose an Issue.");
      return;
    }
    setLoading(true);
    onPreview(recordId)
      .then(setPreview)
      .catch((caught: unknown) =>
        setError(errorText(caught, "The draft is unavailable.")),
      )
      .finally(() => setLoading(false));
  };
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
        <div className="space-y-3 text-sm">
          <div className="grid gap-2">
            <label htmlFor="github-create-work-issue">Issue</label>
            <NativeSelect
              className="w-full"
              id="github-create-work-issue"
              onChange={(event) => setRecordId(event.target.value)}
              value={recordId}
            >
              <NativeSelectOption value="">Choose an Issue</NativeSelectOption>
              {issues.map((record) => (
                <NativeSelectOption key={record.id} value={record.id}>
                  {`#${record.number} ${record.title}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            disabled={loading}
            onClick={loadPreview}
            type="button"
            variant="outline"
          >
            Preview Work draft
          </Button>
        </div>
      )}
    </section>
  );
}
