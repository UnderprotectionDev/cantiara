// biome-ignore-all lint/performance/noJsxPropsBind: Calendar controls close over the current URL search state.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { currentDateInTimeZone } from "@/features/account-preferences/lib/account-preferences-format";
import UnifiedCalendar, {
  type CalendarView,
} from "@/features/unified-calendar/ui/components/unified-calendar";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import {
  accountPreferencesQueryOptions,
  orpc,
  projectsQueryOptions,
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

function CalendarRoute() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const projects = useQuery(projectsQueryOptions());
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
          <UnifiedCalendar
            preferences={formatting}
            projects={projects.data ?? []}
            selectedDate={selectedDate}
            selectedProjectId={selectedProjectId}
            view={view}
            works={works}
          />
        )}
      </main>
    </ClientShellContent>
  );
}
