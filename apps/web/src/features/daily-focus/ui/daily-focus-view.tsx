// biome-ignore-all lint/performance/noJsxPropsBind: Daily Focus controls close over the selected day and Work.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { accountLocalDate } from "@cantiara/api/backlog";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";

export default function DailyFocusView({
  accountId,
  day,
  onSelectDay,
}: {
  accountId?: string;
  day?: string;
  onSelectDay: (day: string) => void;
}) {
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const timeZone =
    preferences.data?.timeZone ?? DEFAULT_ACCOUNT_PREFERENCES.timeZone;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const focusDate = day ?? accountLocalDate(now, timeZone);
  const queryClient = useQueryClient();
  const dailyFocus = useQuery(
    orpc.dailyFocusDay.queryOptions({ input: { focusDate } }),
  );
  const [workId, setWorkId] = useState("");
  const add = useMutation({
    mutationFn: (selectedWorkId: string) =>
      runOnlineOnlyWrite(() =>
        client.addToDailyFocus({ focusDate, workId: selectedWorkId }),
      ),
    onSuccess: async () => {
      setWorkId("");
      await queryClient.invalidateQueries({
        queryKey: orpc.dailyFocusDay.queryOptions({ input: { focusDate } })
          .queryKey,
      });
    },
  });
  const remove = useMutation({
    mutationFn: (selectedWorkId: string) =>
      runOnlineOnlyWrite(() =>
        client.removeFromDailyFocus({ focusDate, workId: selectedWorkId }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.dailyFocusDay.queryOptions({ input: { focusDate } })
          .queryKey,
      });
    },
  });

  return (
    <main
      className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8"
      id="main-content"
      tabIndex={-1}
    >
      <div className="flex flex-col gap-6 border-border/70 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-muted-foreground text-sm">
            Your personal day
          </p>
          <h1 className="font-semibold text-3xl tracking-tight">Daily Focus</h1>
        </div>
        <label
          className="flex flex-col gap-2 text-sm"
          htmlFor="daily-focus-day"
        >
          <span className="font-medium">Selected day</span>
          <input
            className="h-11 rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            id="daily-focus-day"
            onChange={(event) => {
              if (event.target.value) {
                onSelectDay(event.target.value);
              }
            }}
            type="date"
            value={focusDate}
          />
        </label>
      </div>

      <section aria-label="Daily Focus Work" className="pt-8">
        {dailyFocus.isPending ? (
          <p className="text-muted-foreground">Loading Work…</p>
        ) : null}
        {dailyFocus.isError ? (
          <p role="alert">
            Daily Focus is unavailable. Try loading this page again.
          </p>
        ) : null}
        {dailyFocus.data?.members.length === 0 ? (
          <p className="rounded-lg border border-border border-dashed px-5 py-8 text-muted-foreground">
            No Work in Daily Focus for this day.
          </p>
        ) : null}
        {dailyFocus.data?.members.length ? (
          <ul className="divide-y border-border/70 border-y">
            {dailyFocus.data.members.map((work) => (
              <li
                className="flex min-h-16 items-center gap-3 py-3"
                key={work.id}
              >
                <Link
                  className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  hash={workRecordHash(work.id)}
                  params={{ projectId: work.projectId }}
                  to="/projects/$projectId"
                >
                  <span className="block truncate font-medium">
                    {work.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {work.projectName} · {work.key} · {work.status}
                  </span>
                </Link>
                <Button
                  aria-label={`Remove ${work.title} from Daily Focus`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(work.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove from Daily Focus
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="daily-focus-add-heading"
        className="mt-10 rounded-lg border border-border/70 bg-card/35 p-5"
      >
        <h2 className="font-semibold text-lg" id="daily-focus-add-heading">
          Add to Daily Focus
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label
            className="flex min-w-0 flex-1 flex-col gap-2 text-sm"
            htmlFor="daily-focus-work"
          >
            <span className="font-medium">Work</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              id="daily-focus-work"
              onChange={(event) => setWorkId(event.target.value)}
              value={workId}
            >
              <option value="">Select Work</option>
              {dailyFocus.data?.available.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.projectName} · {work.key} · {work.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="min-h-11"
            disabled={!workId || add.isPending}
            onClick={() => add.mutate(workId)}
            type="button"
          >
            Add to Daily Focus
          </Button>
        </div>
        {add.isError || remove.isError ? (
          <p className="mt-3 text-destructive text-sm" role="alert">
            Daily Focus could not be updated. Try again.
          </p>
        ) : null}
      </section>
    </main>
  );
}
