// biome-ignore-all lint/performance/noJsxPropsBind: Explicit per-use commands capture the displayed pin and version.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  findSourceEvidenceMatch,
  type SourceEvidencePlan,
  type SourceEvidenceUse,
} from "@cantiara/api/source-evidence";
import type { SourceRecord } from "@cantiara/api/sources-and-freshness";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";

interface EvidenceProps {
  preferences: AccountPreferences;
  readOnly: boolean;
  source: SourceRecord;
}
interface EvidenceUseProps extends EvidenceProps {
  onCompare: (use: SourceEvidenceUse) => void;
  onKeep: (use: SourceEvidenceUse) => void;
  pending: boolean;
  use: SourceEvidenceUse;
}
function EvidenceUse({
  source,
  preferences,
  readOnly,
  use,
  pending,
  onCompare,
  onKeep,
}: EvidenceUseProps) {
  return (
    <fieldset
      aria-label={`Evidence use: ${use.target.type}: ${use.targetTitle}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <legend className="font-medium">
        {use.target.type}: {use.targetTitle}
      </legend>
      <p>
        Version {use.pin.source.revision} ·{" "}
        {formatAccountDateTime(use.accessedAt, preferences)} · Range{" "}
        {use.pin.start}–{use.pin.end}
      </p>
      <p className="whitespace-pre-wrap break-words">{use.pin.excerpt}</p>
      <p>{use.role}</p>
      {use.readOnly ? <p>Archived. Evidence is read-only.</p> : null}
      {use.newerVersionExists ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() => onCompare(use)}
            type="button"
            variant="outline"
          >
            Newer Source version exists
          </Button>
          {!(readOnly || use.readOnly) &&
          use.reviewedSourceRevision !== source.revision ? (
            <Button
              disabled={pending}
              onClick={() => onKeep(use)}
              type="button"
              variant="outline"
            >
              Reviewed; keep current version
            </Button>
          ) : null}
        </div>
      ) : null}
      {use.newerVersionExists &&
      use.reviewedSourceRevision === source.revision ? (
        <p>
          Reviewed; keep current version ·{" "}
          {use.reviewedAt
            ? formatAccountDateTime(use.reviewedAt, preferences)
            : ""}
        </p>
      ) : null}
    </fieldset>
  );
}
interface EvidenceSelectionProps extends EvidenceProps {
  onCancel: () => void;
  onSave: (use?: SourceEvidenceUse, plan?: SourceEvidencePlan) => Promise<void>;
  saving: boolean;
  use?: SourceEvidenceUse;
}
function EvidenceSelection({
  source,
  preferences,
  readOnly,
  use,
  saving,
  onSave,
  onCancel,
}: EvidenceSelectionProps) {
  const [targetId, setTargetId] = useState("");
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
  async function preview() {
    if (pending) {
      return;
    }
    const target = targets.data?.find(
      (value) =>
        `${value.type}:${value.projectId}:${value.recordId}` === targetId,
    );
    if (!(use || target)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await client.previewSourceEvidence({
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
  }
  return (
    <fieldset
      aria-label="Evidence selection"
      className="space-y-3 rounded-lg border p-4"
    >
      {error ? <p role="alert">{error}</p> : null}
      <legend>{use ? "Compare" : "Version-pinned evidence"}</legend>
      <EvidenceTargetSelection
        fieldId={fieldId}
        pending={pending}
        preferences={preferences}
        setPlan={setPlan}
        setTargetId={setTargetId}
        source={source}
        targetId={targetId}
        targets={targets}
        use={use}
      />
      <p>
        Source · Version {source.revision} ·{" "}
        {formatAccountDateTime(source.version.accessedAt, preferences)}
      </p>
      <label className="block" htmlFor={`${fieldId}-text`}>
        Source text
      </label>
      <textarea
        aria-describedby={`${fieldId}-help`}
        className="min-h-32 w-full rounded-md border bg-background p-2"
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
        <Button
          disabled={pending || range.end <= range.start || !(use || targetId)}
          onClick={preview}
          type="button"
          variant="outline"
        >
          Preview
        </Button>
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
  );
}
export function SourceEvidenceControls({
  source,
  preferences,
  readOnly,
}: EvidenceProps) {
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<{ use?: SourceEvidenceUse } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const command = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  const selection = { sourceId: source.id, projectId: source.projectId };
  const options = orpc.sourceEvidenceUses.queryOptions({ input: selection });
  const uses = useQuery({ ...options, enabled: open });
  const cache = useQueryClient();
  function begin(use?: SourceEvidenceUse) {
    setEditor({ use });
    setError(null);
    setMessage(null);
  }
  async function save(use?: SourceEvidenceUse, plan?: SourceEvidencePlan) {
    if (pending || readOnly || use?.readOnly || !(use || plan)) {
      return;
    }
    const keep = Boolean(use && !plan);
    const fingerprint = JSON.stringify({
      use: use?.id,
      revision: use?.revision,
      sourceRevision: source.revision,
      plan,
    });
    if (command.current?.fingerprint !== fingerprint) {
      command.current = {
        fingerprint,
        id: crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    const identity = command.current;
    setPending(true);
    setError(null);
    try {
      const result = await runOnlineOnlyWrite(() => {
        if (use) {
          return client.reviewSourceEvidence({
            ...selection,
            bindingId: use.id,
            baseRevision: use.revision,
            expectedSourceRevision: source.revision,
            clientIdempotencyKey: identity.key,
            decision: keep
              ? "Reviewed; keep current version"
              : "Rebind to new version",
            ...(plan ? { plan } : {}),
          });
        }
        if (plan) {
          return client.bindSourceEvidence({
            ...selection,
            id: identity.id,
            baseRevision: 0,
            clientIdempotencyKey: identity.key,
            plan,
          });
        }
        return Promise.resolve(null);
      });
      if (!result) {
        throw new Error("Evidence unavailable");
      }
      command.current = null;
      setEditor(null);
      let success = "Version-pinned evidence saved.";
      if (use) {
        success = "Rebind to new version saved.";
      }
      if (keep) {
        success = "Reviewed; keep current version";
      }
      setMessage(success);
      await cache.invalidateQueries({ queryKey: options.queryKey });
    } catch {
      setError(
        "Evidence could not be saved. Reload if the Source, target or bind changed, then preview again.",
      );
    } finally {
      setPending(false);
    }
  }
  const unavailable = uses.isError || uses.data === null;
  return (
    <div aria-busy={pending} className="space-y-3">
      <Button
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen(!open)}
        type="button"
        variant="outline"
      >
        Version-pinned evidence
      </Button>
      <SourceEvidenceUses
        begin={begin}
        editor={editor}
        error={error}
        message={message}
        open={open}
        pending={pending}
        preferences={preferences}
        readOnly={readOnly}
        save={save}
        setEditor={setEditor}
        source={source}
        unavailable={unavailable}
        uses={uses}
      />
    </div>
  );
}

function SourceEvidenceUses({
  open,
  uses,
  unavailable,
  error,
  pending,
  message,
  begin,
  save,
  preferences,
  readOnly,
  source,
  editor,
  setEditor,
}: {
  open: boolean;
  uses: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/source-evidence").SourceEvidenceListing | null,
    Error
  >;
  unavailable: boolean;
  error: string | null;
  pending: boolean;
  message: string | null;
  begin: (use?: SourceEvidenceUse) => void;
  save: (use?: SourceEvidenceUse, plan?: SourceEvidencePlan) => Promise<void>;
  preferences: AccountPreferences;
  readOnly: boolean;
  source: SourceRecord;
  editor: { use?: SourceEvidenceUse } | null;
  setEditor: import("react").Dispatch<
    import("react").SetStateAction<{ use?: SourceEvidenceUse } | null>
  >;
}) {
  return open ? (
    <>
      <SourceEvidenceFeedback
        error={error}
        message={message}
        pending={pending}
        unavailable={unavailable}
        uses={uses}
      />{" "}
      {uses.data?.uses.map((use) => (
        <EvidenceUse
          key={use.id}
          onCompare={begin}
          onKeep={save}
          pending={pending}
          preferences={preferences}
          readOnly={readOnly}
          source={source}
          use={use}
        />
      ))}
      {editor || readOnly ? null : (
        <Button disabled={pending} onClick={() => begin()} type="button">
          Bind as evidence to existing record
        </Button>
      )}
      {editor ? (
        <EvidenceSelection
          key={`${editor.use?.id ?? "new"}:${source.revision}`}
          onCancel={() => setEditor(null)}
          onSave={save}
          preferences={preferences}
          readOnly={readOnly}
          saving={pending}
          source={source}
          use={editor.use}
        />
      ) : null}
    </>
  ) : null;
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
  setTargetId: import("react").Dispatch<import("react").SetStateAction<string>>;
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
      <select
        className="w-full rounded-md border bg-background p-2"
        disabled={pending}
        id={`${fieldId}-target`}
        onChange={(event) => {
          setTargetId(event.target.value);
          setPlan(null);
        }}
        value={targetId}
      >
        <option value="">Choose target</option>
        {targets.data?.map((target) => (
          <option
            key={`${target.type}:${target.recordId}`}
            value={`${target.type}:${target.projectId}:${target.recordId}`}
          >
            {target.type}: {target.title}
          </option>
        ))}
      </select>
      {targets.isPending ? <p role="status">Loading targets…</p> : null}
      {targets.isError ? (
        <p role="alert">Evidence targets are unavailable.</p>
      ) : null}
    </>
  );
}

function SourceEvidenceFeedback({
  uses,
  unavailable,
  error,
  pending,
  message,
}: {
  uses: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/source-evidence").SourceEvidenceListing | null,
    Error
  >;
  unavailable: boolean;
  error: string | null;
  pending: boolean;
  message: string | null;
}) {
  return (
    <>
      {" "}
      {uses.isPending ? <p role="status">Loading evidence uses…</p> : null}
      {unavailable ? (
        <p role="alert">Evidence uses are unavailable. Reload this page.</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {pending ? <p role="status">Saving evidence…</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {uses.data?.signal ? (
        <p role="status">
          source-version-in-use · {uses.data.signal.useIds.length} uses to
          review
        </p>
      ) : null}
    </>
  );
}
