// biome-ignore-all lint/performance/noJsxPropsBind: Source Check controls capture the displayed version and explicit decision.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { SourceCheck } from "@cantiara/api/source-recheck";
import type { SourceRecord } from "@cantiara/api/sources-and-freshness";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { client, orpc } from "@/utils/orpc";
import { SourceCheckCompare } from "./source-check-compare";

export function SourceRecheckControls({
  source,
  preferences,
  readOnly,
}: {
  source: SourceRecord;
  preferences: AccountPreferences;
  readOnly: boolean;
}) {
  const recheckSourceMutation = useMutation(
    orpc.recheckSource.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recheckSource(input),
      onSuccess: async (_, input) => {
        if (recheckAttempt.current?.id === input.id) {
          recheckAttempt.current = null;
        }
        await refresh(input);
      },
    }),
  );
  const decideSourceCheckMutation = useMutation(
    orpc.decideSourceCheck.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.decideSourceCheck(input),
      onSuccess: async (_, input) => {
        if (decisionKey.current?.key === input.clientIdempotencyKey) {
          decisionKey.current = null;
        }
        await refresh(input);
      },
    }),
  );
  const [open, setOpen] = useState(false);
  const recheckAttempt = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const pending =
    recheckSourceMutation.isPending || decideSourceCheckMutation.isPending;
  const recheckError = recheckSourceMutation.isError
    ? "Source Check could not be saved. Reload before retrying if the Source changed."
    : null;
  const error = decideSourceCheckMutation.isError
    ? "The Source or Source Check changed. Reload before deciding."
    : recheckError;
  const decisionKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const cache = useQueryClient();
  const selection = { sourceId: source.id, projectId: source.projectId };
  const checkOptions = orpc.sourceChecks.queryOptions({ input: selection });
  const versionOptions = orpc.source.queryOptions({ input: selection });
  const useOptions = orpc.sourceEvidenceUses.queryOptions({ input: selection });
  const uses = useQuery({ ...useOptions, enabled: open });
  const checks = useQuery({ ...checkOptions, enabled: open });
  const detail = useQuery({ ...versionOptions, enabled: open });
  async function refresh({ projectId, sourceId }: typeof selection) {
    const input = { projectId, sourceId };
    await Promise.all([
      cache.invalidateQueries({
        queryKey: orpc.sourceEvidenceUses.queryOptions({ input }).queryKey,
      }),
      cache.invalidateQueries({
        queryKey: orpc.sourceChecks.queryOptions({ input }).queryKey,
      }),
      cache.invalidateQueries({
        queryKey: orpc.source.queryOptions({ input }).queryKey,
      }),
      cache.invalidateQueries({
        queryKey: orpc.projectSources.queryOptions({ input: { projectId } })
          .queryKey,
      }),
    ]);
  }
  function recheck() {
    if (pending) {
      return;
    }
    decideSourceCheckMutation.reset();
    const fingerprint = JSON.stringify([selection, source.revision]);
    if (recheckAttempt.current?.fingerprint !== fingerprint) {
      recheckAttempt.current = { fingerprint, id: crypto.randomUUID() };
    }
    recheckSourceMutation.mutate({
      ...selection,
      id: recheckAttempt.current.id,
      expectedSourceRevision: source.revision,
    });
  }
  function decide(
    check: SourceCheck,
    decision: "Keep current version" | "Save as new Source version",
  ) {
    if (pending) {
      return;
    }
    recheckSourceMutation.reset();
    const fingerprint = JSON.stringify([
      selection,
      check.id,
      check.revision,
      source.revision,
      decision,
    ]);
    if (decisionKey.current?.fingerprint !== fingerprint) {
      decisionKey.current = { fingerprint, key: crypto.randomUUID() };
    }
    decideSourceCheckMutation.mutate({
      ...selection,
      checkId: check.id,
      baseRevision: check.revision,
      expectedSourceRevision: source.revision,
      clientIdempotencyKey: decisionKey.current.key,
      decision,
    });
  }
  return (
    <div aria-busy={pending} className="space-y-3">
      <Button
        disabled={pending}
        onClick={() => setOpen(!open)}
        type="button"
        variant="outline"
      >
        {open ? "Close" : "Source Check"}
      </Button>
      {open ? (
        <>
          <p className="break-all">
            Recheck source: {source.version.url} · Version {source.revision}.
            This connects to a third-party server.
          </p>
          <Button
            disabled={pending || readOnly}
            onClick={recheck}
            type="button"
          >
            Recheck source
          </Button>
          {pending ? <p role="status">Saving Source Check…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {checks.status === "pending" || detail.isPending ? (
            <p role="status">Loading Source Checks…</p>
          ) : null}
          {checks.isError || detail.isError ? (
            <p role="alert">Source Checks are unavailable. Reload this page.</p>
          ) : null}
          {checks.data?.map((check) => {
            const version = detail.data?.versions.find(
              (value) => value.revision === check.comparedRevision,
            );
            if (!version) {
              return null;
            }
            return (
              <div className="space-y-2" key={check.id}>
                <SourceCheckCompare
                  check={check}
                  pins={uses.data?.uses.map((use) => use.pin)}
                  preferences={preferences}
                  version={version}
                />
                {!(check.decision || readOnly) &&
                check.comparedRevision === source.revision ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => decide(check, "Keep current version")}
                      type="button"
                      variant="outline"
                    >
                      Keep current version
                    </Button>
                    <Button
                      disabled={pending || !check.candidate}
                      onClick={() =>
                        decide(check, "Save as new Source version")
                      }
                      type="button"
                    >
                      Save as new Source version
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
