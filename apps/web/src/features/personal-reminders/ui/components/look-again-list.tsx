import type { PersonalReminderSignalHistory } from "@cantiara/api/personal-reminders";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useCallback } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { accountPreferencesQueryOptions, orpc } from "@/utils/orpc";
import {
  dueLookAgainSignals,
  type LookAgainTarget,
  lookAgainTarget,
} from "../../lib/look-again";

export type OpenLookAgainSource = (
  target: LookAgainTarget & { label: string },
) => void;

function LookAgainRow({
  onOpenSource,
  openSourceRecord,
  signal,
  time,
}: {
  onOpenSource: () => void;
  openSourceRecord: OpenLookAgainSource;
  signal: PersonalReminderSignalHistory;
  time: string;
}) {
  const target = lookAgainTarget(signal);
  const label = signal.sourceRecordType;
  const open = useCallback(() => {
    if (!target) {
      return;
    }
    onOpenSource();
    openSourceRecord({ ...target, label });
  }, [label, onOpenSource, openSourceRecord, target]);
  return (
    <li className="space-y-2 rounded-lg border border-border/70 p-4">
      <h3 className="break-words font-medium">{label}</h3>
      <p className="text-muted-foreground text-sm">
        Review Later
        {signal.evaluationNote ? ` · ${signal.evaluationNote}` : ""}
      </p>
      {target ? (
        <Button
          aria-label={`Open source record: ${label}`}
          className="min-h-11"
          onClick={open}
          type="button"
          variant="outline"
        >
          Open source record
        </Button>
      ) : (
        <p role="status">Source record is unavailable.</p>
      )}
      <p className="text-muted-foreground text-xs">
        <time dateTime={signal.occurredAt}>{time}</time>
      </p>
    </li>
  );
}

/** Lists due Review Later items; the reminder feature keeps their membership. */
export default function LookAgainList({
  onOpenSource,
  openSourceRecord,
}: {
  onOpenSource: () => void;
  openSourceRecord: OpenLookAgainSource;
}) {
  const { session } = useRouteContext({ from: "/_auth" });
  const accountId = session.data.user.id;
  const baseOptions = orpc.personalReminderSignals.queryOptions();
  const signals = useQuery({
    ...baseOptions,
    queryKey: [...baseOptions.queryKey, accountId],
  });
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  if (signals.isPending) {
    return <p role="status">Loading Look again items…</p>;
  }
  if (signals.isError) {
    return <p role="alert">Look again items are unavailable.</p>;
  }
  const due = dueLookAgainSignals(signals.data);
  if (due.length === 0) {
    return (
      <p className="text-muted-foreground" role="status">
        Nothing to look at again.
      </p>
    );
  }
  return (
    <ul aria-label="Look again" className="space-y-3">
      {due.map((signal) => (
        <LookAgainRow
          key={signal.signalId}
          onOpenSource={onOpenSource}
          openSourceRecord={openSourceRecord}
          signal={signal}
          time={
            preferences.data
              ? formatAccountDateTime(signal.occurredAt, preferences.data)
              : signal.occurredAt
          }
        />
      ))}
    </ul>
  );
}
