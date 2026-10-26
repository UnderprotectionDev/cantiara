import { createFileRoute } from "@tanstack/react-router";
import { parseISO } from "date-fns";
import UnifiedCalendarView, {
  CALENDAR_VIEWS,
  type CalendarSearch,
} from "@/features/unified-calendar/ui/views/unified-calendar-view";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/_auth/calendar")({
  validateSearch: (search) => ({
    calendarDay:
      typeof search.calendarDay === "string" &&
      DATE_PATTERN.test(search.calendarDay) &&
      !Number.isNaN(parseISO(search.calendarDay).getTime())
        ? search.calendarDay
        : undefined,
    dateKinds:
      typeof search.dateKinds === "string" ? search.dateKinds : undefined,
    projectId:
      typeof search.projectId === "string" ? search.projectId : undefined,
    view: (CALENDAR_VIEWS as readonly unknown[]).includes(search.view)
      ? (search.view as NonNullable<CalendarSearch["view"]>)
      : undefined,
  }),
  component: CalendarRoute,
});

function CalendarRoute() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();
  return (
    <UnifiedCalendarView accountId={session.data?.user.id} search={search} />
  );
}
