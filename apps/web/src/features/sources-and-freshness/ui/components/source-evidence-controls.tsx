// biome-ignore-all lint/performance/noJsxPropsBind: Explicit per-use commands capture the displayed pin and version.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  SourceEvidencePlan,
  SourceEvidenceUse,
} from "@cantiara/api/source-evidence";
import type { SourceRecord } from "@cantiara/api/sources-and-freshness";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";
import EvidenceSelection from "../forms/source-evidence-selection-form";

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
      <p className="break-words whitespace-pre-wrap">{use.pin.excerpt}</p>
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
export function SourceEvidenceControls({
  source,
  preferences,
  readOnly,
}: EvidenceProps) {
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<{ use?: SourceEvidenceUse } | null>(
    null,
  );
  const command = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  const selection = { sourceId: source.id, projectId: source.projectId };
  const options = orpc.sourceEvidenceUses.queryOptions({ input: selection });
  const uses = useQuery({ ...options, enabled: open });
  const cache = useQueryClient();
  async function saved(
    input: typeof selection & { clientIdempotencyKey: string },
  ) {
    if (command.current?.key === input.clientIdempotencyKey) {
      command.current = null;
      setEditor(null);
    }
    await cache.invalidateQueries({
      queryKey: orpc.sourceEvidenceUses.queryKey({
        input: { sourceId: input.sourceId, projectId: input.projectId },
      }),
    });
  }
  const reviewEvidence = useMutation(
    orpc.reviewSourceEvidence.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.reviewSourceEvidence(input),
      onSuccess: (_, input) => saved(input),
    }),
  );
  const bindEvidence = useMutation(
    orpc.bindSourceEvidence.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.bindSourceEvidence(input),
      onSuccess: (_, input) => saved(input),
    }),
  );
  const pending = reviewEvidence.isPending || bindEvidence.isPending;
  function begin(use?: SourceEvidenceUse) {
    setEditor({ use });
    reviewEvidence.reset();
    bindEvidence.reset();
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
    try {
      if (use) {
        bindEvidence.reset();
        await reviewEvidence.mutateAsync({
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
      } else if (plan) {
        reviewEvidence.reset();
        await bindEvidence.mutateAsync({
          ...selection,
          id: identity.id,
          baseRevision: 0,
          clientIdempotencyKey: identity.key,
          plan,
        });
      }
    } catch {
      // Query retains the failed command and exposes its error.
    }
  }
  const error =
    reviewEvidence.isError || bindEvidence.isError
      ? "Evidence could not be saved. Reload if the Source, target or bind changed, then preview again."
      : null;
  const reviewMessage =
    reviewEvidence.variables?.decision === "Reviewed; keep current version"
      ? reviewEvidence.variables.decision
      : "Rebind to new version saved.";
  const bindMessage = bindEvidence.isSuccess
    ? "Version-pinned evidence saved."
    : null;
  const message = reviewEvidence.isSuccess ? reviewMessage : bindMessage;
  const unavailable = uses.isError || uses.data === null;
  return (
    <Collapsible
      aria-busy={pending}
      className="space-y-3"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger
        disabled={pending}
        render={<Button variant="outline" />}
      >
        Version-pinned evidence
      </CollapsibleTrigger>
      <CollapsibleContent>
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
      </CollapsibleContent>
    </Collapsible>
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
  // The uses query can report a newer Source revision before the Source record
  // prop refreshes; a review sent now would carry the stale expectedSourceRevision.
  const sourceBehind = Boolean(
    uses.data?.signal && uses.data.signal.versionRevision > source.revision,
  );
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
          pending={pending || sourceBehind}
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
