// biome-ignore-all lint/performance/noJsxPropsBind: Explicit per-use commands capture the displayed pin and version.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  findSourceEvidenceMatch,
  type SourceEvidencePlan,
  type SourceEvidenceUse,
  sourceEvidencePreviewInputSchema,
} from "@cantiara/api/source-evidence";
import type { SourceRecord } from "@cantiara/api/sources-and-freshness";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useId } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { submitForm } from "@/lib/submit-form";
import { type client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";

interface EvidenceProps {
  preferences: AccountPreferences;
  readOnly: boolean;
  source: SourceRecord;
}

interface EvidenceSelectionProps extends EvidenceProps {
  onCancel: () => void;
  onSave: (use?: SourceEvidenceUse, plan?: SourceEvidencePlan) => Promise<void>;
  saving: boolean;
  use?: SourceEvidenceUse;
}
export default function EvidenceSelection({
  source,
  preferences,
  readOnly,
  use,
  saving,
  onSave,
  onCancel,
}: EvidenceSelectionProps) {
  const initialRange = use
    ? (findSourceEvidenceMatch(
        use.pin.excerpt,
        source.version.capturedContent,
      ) ?? { start: 0, end: 0 })
    : { start: 0, end: 0 };
  const cache = useQueryClient();
  const inspect = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: async (
      input: Parameters<typeof client.previewSourceEvidence>[0],
    ) => {
      const plan = await fetchFresh(cache, {
        ...orpc.previewSourceEvidence.queryOptions({ input }),
        gcTime: 0,
      });
      if (!plan) {
        throw new Error("Evidence unavailable");
      }
      return plan;
    },
  });
  const plan = inspect.data ?? null;

  const selection = { sourceId: source.id, projectId: source.projectId };
  const targets = useQuery({
    ...orpc.sourceEvidenceTargets.queryOptions({ input: selection }),
    enabled: !(readOnly || use?.readOnly),
  });
  const fieldId = useId();
  const form = useForm({
    defaultValues: { range: initialRange, targetId: "" },
    onSubmit: async ({ value, formApi }) => {
      if (saving || inspect.isPending) {
        return;
      }
      const target = targets.data?.find(
        (candidate) =>
          `${candidate.type}:${candidate.projectId}:${candidate.recordId}` ===
          value.targetId,
      );
      if (!(use || target)) {
        return;
      }
      const parsed = sourceEvidencePreviewInputSchema.safeParse({
        ...selection,
        expectedSourceRevision: source.revision,
        versionRevision: source.revision,
        ...value.range,
        ...(use
          ? { bindingId: use.id }
          : {
              target: target
                ? {
                    type: target.type,
                    projectId: target.projectId,
                    recordId: target.recordId,
                  }
                : undefined,
            }),
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: { form: true, fields: {} },
        });
        return;
      }
      await inspect.mutateAsync(parsed.data);
    },
  });
  const range = useSelector(form.store, (state) => state.values.range);
  const invalidSelection = useSelector(
    form.store,
    (state) => state.errorMap.onSubmit,
  );
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const pending = saving || inspect.isPending || submitting;
  const error =
    inspect.isError || invalidSelection
      ? "Evidence preview is unavailable. Reload if the Source or target changed."
      : null;
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form onSubmit={handleSubmit}>
      <fieldset
        aria-label="Evidence selection"
        className="space-y-3 rounded-lg border p-4"
      >
        {error ? <p role="alert">{error}</p> : null}
        <legend>{use ? "Compare" : "Version-pinned evidence"}</legend>
        <form.Field name="targetId">
          {(field) => (
            <EvidenceTargetSelection
              fieldId={fieldId}
              pending={pending}
              preferences={preferences}
              resetPreview={inspect.reset}
              setTargetId={field.handleChange}
              source={source}
              targetId={field.state.value}
              targets={targets}
              use={use}
            />
          )}
        </form.Field>
        <p>
          Source · Version {source.revision} ·{" "}
          {formatAccountDateTime(source.version.accessedAt, preferences)}
        </p>
        <label className="block" htmlFor={`${fieldId}-text`}>
          Source text
        </label>
        <Textarea
          aria-describedby={`${fieldId}-help`}
          className="min-h-32 w-full"
          id={`${fieldId}-text`}
          onSelect={(event) => {
            form.setFieldValue("range", {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            });
            form.setErrorMap({ onSubmit: undefined });
            inspect.reset();
          }}
          readOnly
          value={source.version.capturedContent}
        />
        <p id={`${fieldId}-help`}>
          Select the exact text to pin. Range {range.start}–{range.end}. Each
          decision affects only this bind.
        </p>
        {readOnly || use?.readOnly ? null : (
          <form.Subscribe selector={(state) => state.values.targetId}>
            {(targetId) => (
              <Button
                disabled={
                  pending || range.end <= range.start || !(use || targetId)
                }
                type="submit"
                variant="outline"
              >
                Preview
              </Button>
            )}
          </form.Subscribe>
        )}
        <SourceEvidenceConfirmation
          onSave={onSave}
          pending={pending}
          plan={plan}
          preferences={preferences}
          use={use}
        />
        <Button
          disabled={pending}
          onClick={() => {
            onCancel();
            inspect.reset();
          }}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </fieldset>
    </form>
  );
}
function SourceEvidenceConfirmation({
  plan,
  preferences,
  pending,
  onSave,
  use,
}: {
  plan: SourceEvidencePlan | null;
  preferences: AccountPreferences;
  pending: boolean;
  onSave: (use?: SourceEvidenceUse, plan?: SourceEvidencePlan) => Promise<void>;
  use: SourceEvidenceUse | undefined;
}) {
  return plan ? (
    <fieldset aria-label="Evidence preview" className="space-y-2 border p-3">
      <legend>Version-pinned evidence</legend>
      <p>
        {plan.target.type}: {plan.targetTitle} · Version{" "}
        {plan.pin.source.revision} ·{" "}
        {formatAccountDateTime(plan.accessedAt, preferences)} · Range{" "}
        {plan.pin.start}–{plan.pin.end}
      </p>
      <p className="break-words whitespace-pre-wrap">{plan.pin.excerpt}</p>
      <Button
        disabled={pending}
        onClick={() => plan && onSave(use, plan)}
        type="button"
      >
        {use ? "Rebind to new version" : "Bind as evidence to existing record"}
      </Button>
    </fieldset>
  ) : null;
}

function EvidenceTargetSelection({
  use,
  preferences,
  source,
  fieldId,
  pending,
  setTargetId,
  resetPreview,
  targetId,
  targets,
}: {
  use: SourceEvidenceUse | undefined;
  preferences: AccountPreferences;
  source: SourceRecord;
  fieldId: string;
  pending: boolean;
  setTargetId: (value: string) => void;
  resetPreview: () => void;
  targetId: string;
  targets: import("@tanstack/react-query").UseQueryResult<
    | ({
        projectId: string;
        recordId: string;
        type:
          | "Work"
          | "Feedback"
          | "Risk"
          | "Decision"
          | "Assumption"
          | "Open Question";
      } & { title: string })[]
    | null,
    Error
  >;
}) {
  return use ? (
    <>
      <p>
        {use.target.type}: {use.targetTitle}
      </p>
      <p>
        Historical snapshot · Version {use.pin.source.revision} ·{" "}
        {formatAccountDateTime(use.accessedAt, preferences)} · Range{" "}
        {use.pin.start}–{use.pin.end}
      </p>
      <p className="break-words whitespace-pre-wrap">{use.pin.excerpt}</p>
      {findSourceEvidenceMatch(
        use.pin.excerpt,
        source.version.capturedContent,
      ) ? null : (
        <p>No match in candidate version</p>
      )}
    </>
  ) : (
    <>
      <label className="block" htmlFor={`${fieldId}-target`}>
        Evidence target
      </label>
      <NativeSelect
        className="w-full"
        disabled={pending}
        id={`${fieldId}-target`}
        onChange={(event) => {
          setTargetId(event.target.value);
          resetPreview();
        }}
        value={targetId}
      >
        <NativeSelectOption value="">Choose target</NativeSelectOption>
        {targets.data?.map((target) => (
          <NativeSelectOption
            key={`${target.type}:${target.recordId}`}
            value={`${target.type}:${target.projectId}:${target.recordId}`}
          >
            {target.type}: {target.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {targets.isPending ? <p role="status">Loading targets…</p> : null}
      {targets.isError ? (
        <p role="alert">Evidence targets are unavailable.</p>
      ) : null}
    </>
  );
}
