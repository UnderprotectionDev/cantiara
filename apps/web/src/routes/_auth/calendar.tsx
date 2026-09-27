// biome-ignore-all lint/performance/noJsxPropsBind: Calendar controls close over the current URL search state.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { useState } from "react";
import { currentDateInTimeZone } from "@/features/account-preferences/lib/account-preferences-format";
import UnifiedCalendar, {
  type CalendarDateChange,
  type CalendarView,
} from "@/features/unified-calendar/ui/components/unified-calendar";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import {
  accountPreferencesQueryOptions,
  client,
  orpc,
  projectsQueryOptions,
  projectWorksQueryPrefix,
} from "@/utils/orpc";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIEWS = ["Day", "Week", "Month"] as const;

export const Route = createFileRoute("/_auth/calendar")({
  validateSearch: (search) => ({
    calendarDay:
      typeof search.calendarDay === "string" &&
      DATE_PATTERN.test(search.calendarDay) &&
      !Number.isNaN(parseISO(search.calendarDay).getTime())
        ? search.calendarDay
        : undefined,
    projectId:
      typeof search.projectId === "string" ? search.projectId : undefined,
    view: VIEWS.includes(search.view as CalendarView)
      ? (search.view as CalendarView)
      : undefined,
  }),
  component: CalendarRoute,
});

function CalendarMutationFeedback({
  dateChangeError,
  disabled,
  onUndo,
  showUndo,
}: {
  dateChangeError: string | null;
  disabled: boolean;
  onUndo: () => void;
  showUndo: boolean;
}) {
  return (
    <>
      {dateChangeError ? (
        <p className="mt-3 text-destructive text-sm" role="alert">
          {dateChangeError}
        </p>
      ) : null}
      {showUndo ? (
        <div
          className="mt-3 flex items-center gap-3 rounded-md border border-border/70 px-3 py-2 text-sm"
          role="status"
        >
          <span>Calendar date updated.</span>
          <Button
            disabled={disabled}
            onClick={onUndo}
            size="sm"
            type="button"
            variant="outline"
          >
            Undo
          </Button>
        </div>
      ) : null}
    </>
  );
}

function CalendarRoute() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const projects = useQuery(projectsQueryOptions());
  const queryClient = useQueryClient();
  const [dateChangeUndo, setDateChangeUndo] = useState<{
    receiptId: string;
    workId: string;
  } | null>(null);
  const [dateChangeError, setDateChangeError] = useState<string | null>(null);
  const preferences = useQuery(
    accountPreferencesQueryOptions(session.data?.user.id),
  );
  const formatting = preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;
  const selectedDate =
    search.calendarDay ?? currentDateInTimeZone(formatting.timeZone);
  const view = search.view ?? "Month";
  const selectedProjectId =
    search.projectId && projects.data?.some(({ id }) => id === search.projectId)
      ? search.projectId
      : "all";
  const workQueries = useQueries({
    queries: (projects.data ?? [])
      .filter(
        ({ id }) => selectedProjectId === "all" || id === selectedProjectId,
      )
      .map(({ id }) =>
        orpc.projectWorks.queryOptions({
          input: { archived: false, projectId: id },
        }),
      ),
  });
  const failed =
    preferences.isError ||
    projects.isError ||
    workQueries.some((query) => query.isError);
  const loading =
    !failed &&
    (preferences.isPending ||
      projects.isPending ||
      workQueries.some((query) => query.isPending));
  const preferencesUnavailable = preferences.isPending || preferences.isError;
  const works = workQueries.flatMap((query) => query.data ?? []);
  async function handleCalendarDateError(error: unknown, fallback: string) {
    setDateChangeUndo(null);
    setDateChangeError(mutationErrorMessage(error, fallback));
    await queryClient.invalidateQueries({
      queryKey: projectWorksQueryPrefix,
    });
  }

  const updateCalendarDate = useMutation({
    mutationFn: (change: CalendarDateChange) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkDate({
          baseRevision: change.baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          date: change.date,
          dateField: change.dateField,
          workId: change.workId,
        }),
      ),
    onError: (error) =>
      handleCalendarDateError(
        error,
        "Calendar date could not be saved. Try again.",
      ),
    onSuccess: async (work) => {
      setDateChangeError(null);
      setDateChangeUndo({
        receiptId: work.receiptId,
        workId: work.id,
      });
      await queryClient.invalidateQueries({
        queryKey: projectWorksQueryPrefix,
      });
    },
  });
  const undoCalendarDate = useMutation({
    mutationFn: () => {
      const undo = dateChangeUndo;
      if (!undo) {
        throw new Error(
          "This Work date change is no longer available for Undo.",
        );
      }
      return runOnlineOnlyWrite(async () => {
        const work = await client.work({ workId: undo.workId });
        return client.undoWorkDate({
          baseRevision: work.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          receiptId: undo.receiptId,
          workId: undo.workId,
        });
      });
    },
    onError: (error) =>
      handleCalendarDateError(
        error,
        "This Work date change is no longer available for Undo.",
      ),
    onSuccess: async () => {
      setDateChangeError(null);
      setDateChangeUndo(null);
      await queryClient.invalidateQueries({
        queryKey: projectWorksQueryPrefix,
      });
    },
  });

  function updateSearch(next: Partial<typeof search>) {
    navigate({
      to: "/calendar",
      search: { ...search, ...next },
    });
  }

  function move(amount: number) {
    const date = parseISO(selectedDate);
    let moved = addDays(date, amount);
    if (view === "Week") {
      moved = addWeeks(date, amount);
    } else if (view === "Month") {
      moved = addMonths(date, amount);
    }
    updateSearch({ calendarDay: format(moved, "yyyy-MM-dd") });
  }

  return (
    <ClientShellContent>
      <main className="surface-frame max-w-[1440px]">
        <header className="surface-header">
          <h1 className="font-semibold text-3xl tracking-tight">Calendar</h1>
          <p className="mt-3 text-muted-foreground text-sm/6">
            Explore Work dates across Projects.
          </p>
        </header>
        {preferencesUnavailable ? null : (
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <fieldset className="flex gap-1">
              <legend className="sr-only">Calendar view</legend>
              {VIEWS.map((option) => (
                <Button
                  aria-pressed={view === option}
                  key={option}
                  onClick={() => updateSearch({ view: option })}
                  size="sm"
                  type="button"
                  variant={view === option ? "secondary" : "outline"}
                >
                  {option}
                </Button>
              ))}
            </fieldset>
            <label className="grid gap-1 text-sm">
              Selected day
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  updateSearch({ calendarDay: event.target.value })
                }
                type="date"
                value={selectedDate}
              />
            </label>
            <div className="grid gap-1 text-sm">
              <label htmlFor="calendar-project">Project</label>
              <NativeSelect
                id="calendar-project"
                onChange={(event) =>
                  updateSearch({ projectId: event.target.value })
                }
                value={selectedProjectId}
              >
                <NativeSelectOption value="all">
                  All Projects
                </NativeSelectOption>
                {projects.data?.map((project) => (
                  <NativeSelectOption key={project.id} value={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => move(-1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => move(1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        )}
        {loading ? <p role="status">Loading Calendar…</p> : null}
        {failed ? (
          <p className="text-destructive text-sm" role="alert">
            Calendar is unavailable. Try loading this page again.
          </p>
        ) : null}
        {loading || failed ? null : (
          <>
            <UnifiedCalendar
              disabled={
                updateCalendarDate.isPending || undoCalendarDate.isPending
              }
              onDateChange={(change) => {
                setDateChangeError(null);
                updateCalendarDate.mutate(change);
              }}
              preferences={formatting}
              projects={projects.data ?? []}
              selectedDate={selectedDate}
              selectedProjectId={selectedProjectId}
              view={view}
              works={works}
            />
            <CalendarMutationFeedback
              dateChangeError={dateChangeError}
              disabled={
                updateCalendarDate.isPending || undoCalendarDate.isPending
              }
              onUndo={() => undoCalendarDate.mutate()}
              showUndo={dateChangeUndo !== null}
            />
          </>
        )}
      </main>
    </ClientShellContent>
  );
}
