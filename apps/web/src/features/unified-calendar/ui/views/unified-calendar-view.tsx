// biome-ignore-all lint/performance/noJsxPropsBind: Calendar controls close over the current URL search state.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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
import { useNavigate } from "@tanstack/react-router";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { DatePicker } from "@/components/date-picker";
import { currentDateInTimeZone } from "@/features/account-preferences/lib/account-preferences-format";
import UnifiedCalendar, {
  type CalendarDateChange,
  type CalendarView,
} from "@/features/unified-calendar/ui/components/unified-calendar";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { commandVariables } from "@/lib/command-variables";
import { fetchCurrentWork } from "@/lib/fetch-current-work";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import {
  accountPreferencesQueryOptions,
  client,
  orpc,
  projectsQueryOptions,
} from "@/utils/orpc";
import {
  CALENDAR_DATE_KINDS,
  type CalendarDateKind,
  calendarDateKindsForSelection,
} from "../../lib/calendar-date-drag";

export const CALENDAR_VIEWS = ["Day", "Week", "Month", "Agenda"] as const;
const ALL_DATE_KINDS: readonly CalendarDateKind[] = CALENDAR_DATE_KINDS.map(
  ({ field }) => field,
);

function dateKindsFromSearch(value?: string): CalendarDateKind[] {
  if (value === undefined) {
    return [...ALL_DATE_KINDS];
  }
  if (value === "none") {
    return [];
  }

  return calendarDateKindsForSelection(value.split(",")).map(
    ({ field }) => field,
  );
}

export interface CalendarSearch {
  calendarDay: string | undefined;
  dateKinds: string | undefined;
  projectId: string | undefined;
  view: CalendarView | undefined;
}

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
        <p className="mt-3 text-sm text-destructive" role="alert">
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

export default function UnifiedCalendarView({
  accountId,
  search,
}: {
  accountId: string | undefined;
  search: CalendarSearch;
}) {
  const navigate = useNavigate();
  const projects = useQuery(projectsQueryOptions());
  const queryClient = useQueryClient();
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const formatting = preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;
  const selectedDate =
    search.calendarDay ?? currentDateInTimeZone(formatting.timeZone);
  const view = search.view ?? "Month";
  const selectedProjectId =
    search.projectId && projects.data?.some(({ id }) => id === search.projectId)
      ? search.projectId
      : "all";
  const selectedDateKinds = dateKindsFromSearch(search.dateKinds);
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
  const queries = [preferences, projects, ...workQueries];
  const failed = queries.some((query) => query.isLoadingError);
  const loading = !failed && queries.some((query) => query.isPending);
  const preferencesUnavailable =
    preferences.status === "pending" || preferences.isError;
  const works = workQueries.flatMap((query) => query.data ?? []);
  function refreshWorkDates(projectId: string) {
    return queryClient.invalidateQueries({
      queryKey: orpc.projectWorks.key({ input: { projectId } }),
    });
  }
  const updateCalendarDate = usePreparedMutation(
    orpc.updateWorkDate.mutationOptions({
      meta: { retryInSurface: true },
      mutationFn: (input) => client.updateWorkDate(input),
      onError: (_, { workId }) => {
        const work = works.find(({ id }) => id === workId);
        if (work) {
          return refreshWorkDates(work.projectId);
        }
      },
      onSuccess: (work) => refreshWorkDates(work.projectId),
    }),
    ({ baseRevision, date, dateField, workId }: CalendarDateChange) => ({
      baseRevision,
      date,
      dateField,
      workId,
    }),
  );
  const undoCalendarDate = useMutation(
    orpc.undoWorkDate.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.undoWorkDate(input),
      onError: (_, { workId }) => {
        const work = works.find(({ id }) => id === workId);
        if (work) {
          return refreshWorkDates(work.projectId);
        }
      },
      onSuccess: (work) => refreshWorkDates(work.projectId),
    }),
  );
  const readUndoWork = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: (workId: string) => fetchCurrentWork(queryClient, workId),
  });
  const dateChange = updateCalendarDate.data;
  const canUndo = Boolean(
    dateChange &&
      !(
        undoCalendarDate.isSuccess &&
        undoCalendarDate.variables.receiptId === dateChange.receiptId
      ),
  );
  const saving =
    updateCalendarDate.isPending ||
    undoCalendarDate.isPending ||
    readUndoWork.isPending;
  const undoError = undoCalendarDate.error ?? readUndoWork.error;
  let dateChangeError: string | null = null;
  if (updateCalendarDate.error) {
    dateChangeError = mutationErrorMessage(
      updateCalendarDate.error,
      "Calendar date could not be saved. Try again.",
    );
  } else if (undoError) {
    dateChangeError = mutationErrorMessage(
      undoError,
      "This Work date change is no longer available for Undo.",
    );
  }
  async function confirmUndoCalendarDate() {
    if (!(dateChange && canUndo) || saving) {
      return;
    }
    const failedUndo = undoCalendarDate.isError
      ? undoCalendarDate.variables
      : undefined;
    if (failedUndo?.receiptId === dateChange.receiptId) {
      undoCalendarDate.mutate(failedUndo);
      return;
    }
    const currentWork = await readUndoWork
      .mutateAsync(dateChange.id)
      .catch(() => undefined);
    if (currentWork) {
      undoCalendarDate.mutate(
        commandVariables({
          baseRevision: currentWork.revision,
          receiptId: dateChange.receiptId,
          workId: currentWork.id,
        }),
      );
    }
  }

  function updateSearch(next: Partial<CalendarSearch>) {
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
    } else if (view === "Month" || view === "Agenda") {
      moved = addMonths(date, amount);
    }
    updateSearch({ calendarDay: format(moved, "yyyy-MM-dd") });
  }

  function updateDateKind(field: CalendarDateKind, checked: boolean) {
    const selected = new Set(selectedDateKinds);
    if (checked) {
      selected.add(field);
    } else {
      selected.delete(field);
    }

    const next = calendarDateKindsForSelection(selected).map(
      ({ field: kind }) => kind,
    );
    let dateKinds: string | undefined;
    if (next.length === ALL_DATE_KINDS.length) {
      dateKinds = undefined;
    } else if (next.length === 0) {
      dateKinds = "none";
    } else {
      dateKinds = next.join(",");
    }
    updateSearch({ dateKinds });
  }

  return (
    <ClientShellContent>
      <main className="surface-frame max-w-[1440px]">
        <header className="surface-header">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-3 text-sm/6 text-muted-foreground">
            Explore Work dates across Projects.
          </p>
        </header>
        {preferencesUnavailable ? null : (
          <CalendarViewControls
            move={move}
            projects={projects}
            selectedDate={selectedDate}
            selectedDateKinds={selectedDateKinds}
            selectedProjectId={selectedProjectId}
            updateDateKind={updateDateKind}
            updateSearch={updateSearch}
            view={view}
          />
        )}
        {loading ? <p role="status">Loading Calendar…</p> : null}
        {failed ? (
          <p className="text-sm text-destructive" role="alert">
            Calendar is unavailable. Try loading this page again.
          </p>
        ) : null}
        {loading || failed ? null : (
          <>
            <UnifiedCalendar
              disabled={saving}
              onDateChange={(change) => {
                undoCalendarDate.reset();
                readUndoWork.reset();
                return updateCalendarDate.mutateAsync(change);
              }}
              preferences={formatting}
              projects={projects.data ?? []}
              selectedDate={selectedDate}
              selectedDateKinds={selectedDateKinds}
              selectedProjectId={selectedProjectId}
              view={view}
              works={works}
            />
            <CalendarMutationFeedback
              dateChangeError={dateChangeError}
              disabled={saving}
              onUndo={confirmUndoCalendarDate}
              showUndo={canUndo}
            />
          </>
        )}
      </main>
    </ClientShellContent>
  );
}

function CalendarViewControls({
  view,
  updateSearch,
  selectedDateKinds,
  updateDateKind,
  selectedDate,
  selectedProjectId,
  projects,
  move,
}: {
  view: CalendarView;
  updateSearch: (
    next: Partial<{
      calendarDay: string | undefined;
      dateKinds: string | undefined;
      projectId: string | undefined;
      view: CalendarView | undefined;
    }>,
  ) => void;
  selectedDateKinds: ("targetDate" | "reappearDate" | "plannedStartDate")[];
  updateDateKind: (field: CalendarDateKind, checked: boolean) => void;
  selectedDate: string;
  selectedProjectId: string;
  projects: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/project-shell").ProjectProfile[],
    Error
  >;
  move: (amount: number) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <fieldset className="flex gap-1">
        <legend className="sr-only">Calendar view</legend>
        {CALENDAR_VIEWS.map((option) => (
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
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">Date kinds</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {CALENDAR_DATE_KINDS.map(({ field, label }) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
              htmlFor={`calendar-date-kind-${field}`}
              key={field}
            >
              <Checkbox
                checked={selectedDateKinds.includes(field)}
                id={`calendar-date-kind-${field}`}
                onCheckedChange={(checked) =>
                  updateDateKind(field, checked === true)
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm" htmlFor="calendar-selected-day">
        Selected day
        <DatePicker
          ariaLabel="Selected day"
          id="calendar-selected-day"
          onChange={(calendarDay) => updateSearch({ calendarDay })}
          required
          value={selectedDate}
        />
      </label>
      <div className="grid gap-1 text-sm">
        <label htmlFor="calendar-project">Project</label>
        <NativeSelect
          id="calendar-project"
          onChange={(event) => updateSearch({ projectId: event.target.value })}
          value={selectedProjectId}
        >
          <NativeSelectOption value="all">All Projects</NativeSelectOption>
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
  );
}
