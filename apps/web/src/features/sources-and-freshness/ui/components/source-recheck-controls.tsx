// biome-ignore-all lint/performance/noJsxPropsBind: Source Check controls capture the displayed version and explicit decision.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { SourceCheck } from "@cantiara/api/source-recheck";
import type { SourceRecord } from "@cantiara/api/sources-and-freshness";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recheckId = useRef<string | null>(null);
  const decisionKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const cache = useQueryClient();
  const selection = { sourceId: source.id, projectId: source.projectId };
  const checkOptions = orpc.sourceChecks.queryOptions({ input: selection });
  const versionOptions = orpc.source.queryOptions({ input: selection });
  const useOptions = orpc.sourceEvidenceUses.queryOptions({ input: selection });
  const uses = useQuery({ ...useOptions, enabled: open });
  const checks = useQuery({ ...checkOptions, enabled: open });
  const detail = useQuery({ ...versionOptions, enabled: open });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: useOptions.queryKey }),
      cache.invalidateQueries({ queryKey: checkOptions.queryKey }),
      cache.invalidateQueries({ queryKey: versionOptions.queryKey }),
      cache.invalidateQueries({
        queryKey: orpc.projectSources.queryOptions({
          input: { projectId: source.projectId },
        }).queryKey,
      }),
    ]);
  }
  async function recheck() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    recheckId.current ??= crypto.randomUUID();
    const id = recheckId.current;
    try {
      await runOnlineOnlyWrite(() =>
        client.recheckSource({
          ...selection,
          id,
          expectedSourceRevision: source.revision,
        }),
      );
      recheckId.current = null;
      await refresh();
    } catch {
      setError(
        "Source Check could not be saved. Reload before retrying if the Source changed.",
      );
    } finally {
      setPending(false);
    }
  }
  async function decide(
    check: SourceCheck,
    decision: "Keep current version" | "Save as new Source version",
  ) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    const fingerprint = `${check.id}:${check.revision}:${source.revision}:${decision}`;
    if (decisionKey.current?.fingerprint !== fingerprint) {
      decisionKey.current = { fingerprint, key: crypto.randomUUID() };
    }
    const command = decisionKey.current;
    try {
      await runOnlineOnlyWrite(() =>
        client.decideSourceCheck({
          ...selection,
          checkId: check.id,
          baseRevision: check.revision,
          expectedSourceRevision: source.revision,
          clientIdempotencyKey: command.key,
          decision,
        }),
      );
      decisionKey.current = null;
      await refresh();
    } catch {
      setError("The Source or Source Check changed. Reload before deciding.");
    } finally {
      setPending(false);
    }
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
          {checks.isPending || detail.isPending ? (
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
