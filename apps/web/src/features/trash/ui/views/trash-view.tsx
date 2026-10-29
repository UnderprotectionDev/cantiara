// biome-ignore-all lint/performance/noJsxPropsBind: The move handler binds to one candidate.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  MOVE_TO_TRASH_LABEL,
  TRASH_LABEL,
  TRASH_RETENTION_DAYS,
  type TrashEntry,
} from "@cantiara/api/trash";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import type { TrashCandidate } from "../../lib/trash-candidates";
import { TrashEntryList } from "../components/trash-entry-list";

/**
 * Trash: the records waiting out their 30-day window, and `Move to Trash` for
 * a live record. Trash is not Archive and not a restore-point library.
 */
export function TrashView({
  candidates,
  entries,
  formatting,
  onMove,
}: {
  candidates: readonly TrashCandidate[];
  entries: readonly TrashEntry[];
  formatting: AccountPreferences;
  onMove: (candidate: TrashCandidate) => Promise<unknown>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function move(candidate: TrashCandidate) {
    const key = `${candidate.kind}:${candidate.id}`;
    setPending(key);
    setFailed(null);
    try {
      await onMove(candidate);
    } catch {
      setFailed(key);
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-label={TRASH_LABEL} className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">{TRASH_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          A record in {TRASH_LABEL} keeps its identity for{" "}
          {TRASH_RETENTION_DAYS} days, then it is permanently deleted.
        </p>
      </header>
      <TrashEntryList entries={entries} formatting={formatting} />
      {candidates.length > 0 ? (
        <section aria-label={MOVE_TO_TRASH_LABEL} className="space-y-2">
          <h3 className="font-medium">{MOVE_TO_TRASH_LABEL}</h3>
          <ul className="space-y-2">
            {candidates.map((candidate) => {
              const key = `${candidate.kind}:${candidate.id}`;
              return (
                <li className="flex flex-wrap items-center gap-3" key={key}>
                  <span className="text-muted-foreground text-sm">
                    {candidate.kind}
                  </span>
                  <span className="min-w-0 break-words">{candidate.label}</span>
                  <Button
                    aria-label={`${MOVE_TO_TRASH_LABEL}: ${candidate.label}`}
                    disabled={pending !== null}
                    onClick={() => move(candidate)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {MOVE_TO_TRASH_LABEL}
                  </Button>
                  {failed === key ? (
                    <span role="alert">
                      Could not move to {TRASH_LABEL}. Reload and try again.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
