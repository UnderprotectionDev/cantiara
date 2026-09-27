// biome-ignore-all lint/performance/noJsxPropsBind: Daily Focus controls close over the selected day and Work.

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
  onOpenCloseFocus,
  onReturnToDailyFocus,
  onSelectDay,
  view,
}: {
  accountId?: string;
  day?: string;
  onOpenCloseFocus: (day: string) => void;
  onReturnToDailyFocus: (day: string) => void;
  onSelectDay: (day: string) => void;
  view?: "close";
}) {
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!preferences.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8">
        <h1 className="font-semibold text-3xl tracking-tight">Daily Focus</h1>
        {preferences.isError ? (
          <p className="mt-6" role="alert">
            Daily Focus is unavailable. Try loading this page again.
          </p>
        ) : (
          <p className="mt-6 text-muted-foreground" role="status">
            Loading Work…
          </p>
        )}
      </main>
    );
  }

  const focusDate = day ?? accountLocalDate(now, preferences.data.timeZone);
  if (view === "close") {
    return (
      <DailyFocusCloseView
        focusDate={focusDate}
        locale={preferences.data.locale}
        onReturnToDailyFocus={onReturnToDailyFocus}
      />
    );
  }
  return (
    <DailyFocusDayView
      focusDate={focusDate}
      onOpenCloseFocus={onOpenCloseFocus}
      onSelectDay={onSelectDay}
    />
  );
}

function DailyFocusCloseView({
  focusDate,
  locale,
  onReturnToDailyFocus,
}: {
  focusDate: string;
  locale: string;
  onReturnToDailyFocus: (day: string) => void;
}) {
  const closeQuery = useQuery(
    orpc.dailyFocusClose.queryOptions({ input: { focusDate } }),
  );
  const selectedDay = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${focusDate}T12:00:00.000Z`));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8">
      <div className="flex flex-col gap-4 border-border/70 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Close focus</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Selected day · {selectedDay}
          </p>
        </div>
        <Button
          onClick={() => onReturnToDailyFocus(focusDate)}
          type="button"
          variant="outline"
        >
          Daily Focus
        </Button>
      </div>

      {closeQuery.isPending ? (
        <p className="pt-8 text-muted-foreground" role="status">
          Loading Work…
        </p>
      ) : null}
      {closeQuery.isError ? (
        <p className="pt-8" role="alert">
          Daily Focus is unavailable. Try loading this page again.
        </p>
      ) : null}
      {closeQuery.data ? (
        <div className="space-y-8 pt-8">
          <DailyFocusCloseGroup
            headingId="daily-focus-close-completed"
            label="Completed"
            work={closeQuery.data.completed}
          />
          <DailyFocusCloseGroup
            headingId="daily-focus-close-abandoned"
            label="Abandoned"
            work={closeQuery.data.abandoned}
          />
          <DailyFocusCloseGroup
            headingId="daily-focus-close-deferred"
            label="Deferred"
            work={closeQuery.data.deferred}
          />
          <DailyFocusCloseGroup
            headingId="daily-focus-close-open"
            label="Still open"
            work={closeQuery.data.stillOpen}
          />
        </div>
      ) : null}
    </main>
  );
}

function DailyFocusCloseGroup({
  headingId,
  label,
  work,
}: {
  headingId: string;
  label: string;
  work: Array<{
    id: string;
    key: string;
    projectId: string;
    projectName: string;
    status: string;
    title: string;
  }>;
}) {
  if (work.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 className="mb-3 font-semibold text-lg" id={headingId}>
        {label}
      </h2>
      <ul className="divide-y border-border/70 border-y">
        {work.map((item) => (
          <li key={item.id}>
            <Link
              className="flex min-h-16 flex-col justify-center gap-1 rounded-sm py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              hash={workRecordHash(item.id)}
              params={{ projectId: item.projectId }}
              to="/projects/$projectId"
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground text-sm">
                {item.projectName} · {item.key}
              </span>
              <span className="text-muted-foreground text-sm">
                Open source record
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DailyFocusDayView({
  focusDate,
  onOpenCloseFocus,
  onSelectDay,
}: {
  focusDate: string;
  onOpenCloseFocus: (day: string) => void;
  onSelectDay: (day: string) => void;
}) {
  const queryClient = useQueryClient();
  const dailyFocus = useQuery(
    orpc.dailyFocusDay.queryOptions({ input: { focusDate } }),
  );
  const [workId, setWorkId] = useState("");
  const [rejectedCandidateIdsByDay, setRejectedCandidateIdsByDay] = useState<
    Record<string, string[]>
  >({});
  const rejectedCandidateIds = new Set(
    rejectedCandidateIdsByDay[focusDate] ?? [],
  );
  const visibleCandidates = (dailyFocus.data?.candidates ?? []).filter(
    ({ id }) => !rejectedCandidateIds.has(id),
  );
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
    <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8">
      <div className="flex flex-col gap-6 border-border/70 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Daily Focus</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
          <Button
            onClick={() => onOpenCloseFocus(focusDate)}
            type="button"
            variant="outline"
          >
            Close focus
          </Button>
        </div>
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
        aria-labelledby="daily-focus-candidates-heading"
        className="mt-10"
      >
        <h2
          className="font-semibold text-lg"
          id="daily-focus-candidates-heading"
        >
          Candidates
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Work appears here when Target date is this day through the next 7
          days, or Reappear date is on or before this day.
        </p>
        {dailyFocus.data && visibleCandidates.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border border-dashed px-5 py-6 text-muted-foreground">
            No Candidates for this day.
          </p>
        ) : null}
        {visibleCandidates.length > 0 ? (
          <ul className="mt-4 divide-y border-border/70 border-y">
            {visibleCandidates.map((candidate) => (
              <li
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                key={candidate.id}
              >
                <Link
                  className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  hash={workRecordHash(candidate.id)}
                  params={{ projectId: candidate.projectId }}
                  to="/projects/$projectId"
                >
                  <span className="block truncate font-medium">
                    {candidate.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {candidate.projectName} · {candidate.key} ·{" "}
                    {candidate.status}
                  </span>
                  <span className="mt-1 block text-muted-foreground text-sm">
                    {candidate.reasons.map(({ date, label }) => (
                      <span className="mr-3" key={`${label}:${date}`}>
                        {label}: <time dateTime={date}>{date}</time>
                      </span>
                    ))}
                  </span>
                </Link>
                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    disabled={add.isPending}
                    onClick={() => add.mutate(candidate.id)}
                    size="sm"
                    type="button"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() =>
                      setRejectedCandidateIdsByDay((current) => ({
                        ...current,
                        [focusDate]: [
                          ...new Set([
                            ...(current[focusDate] ?? []),
                            candidate.id,
                          ]),
                        ],
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Reject
                  </Button>
                </div>
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
