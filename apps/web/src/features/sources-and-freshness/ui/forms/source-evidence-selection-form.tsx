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
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { client, orpc } from "@/utils/orpc";
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
  const [range, setRange] = useState(
    use
      ? (findSourceEvidenceMatch(
          use.pin.excerpt,
          source.version.capturedContent,
        ) ?? { start: 0, end: 0 })
      : { start: 0, end: 0 },
  );
  const [plan, setPlan] = useState<SourceEvidencePlan | null>(null);
  const [previewing, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = saving || previewing;
  const selection = { sourceId: source.id, projectId: source.projectId };
  const targets = useQuery({
    ...orpc.sourceEvidenceTargets.queryOptions({ input: selection }),
    enabled: !(readOnly || use?.readOnly),
  });
  const fieldId = useId();
  const form = useForm({
    defaultValues: { targetId: "" },
    onSubmit: async ({ value }) => {
      if (pending) {
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
      setPending(true);
      setError(null);
      try {
        const parsed = sourceEvidencePreviewInputSchema.safeParse({
          ...selection,
          expectedSourceRevision: source.revision,
          versionRevision: source.revision,
          ...range,
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
          throw new Error("Evidence unavailable");
        }
        const result = await client.previewSourceEvidence(parsed.data);
        if (!result) {
          throw new Error("Evidence unavailable");
        }
        setPlan(result);
      } catch {
        setError(
          "Evidence preview is unavailable. Reload if the Source or target changed.",
        );
      } finally {
        setPending(false);
      }
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
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
              setPlan={setPlan}
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
            setRange({
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            });
            setPlan(null);
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
            setPlan(null);
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
      <p className="whitespace-pre-wrap break-words">{plan.pin.excerpt}</p>
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
  setPlan,
  targetId,
  targets,
}: {
  use: SourceEvidenceUse | undefined;
  preferences: AccountPreferences;
  source: SourceRecord;
  fieldId: string;
  pending: boolean;
  setTargetId: (value: string) => void;
  setPlan: import("react").Dispatch<
    import("react").SetStateAction<SourceEvidencePlan | null>
  >;
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
      <p className="whitespace-pre-wrap break-words">{use.pin.excerpt}</p>
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
          setPlan(null);
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
