import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import DailyFocusPageView from "@/features/daily-focus/ui/views/daily-focus-page-view";

export const Route = createFileRoute("/_auth/daily-focus")({
  validateSearch: (search) => {
    const day = z.iso.date().safeParse(search.day);
    return {
      ...(day.success ? { day: day.data } : {}),
      ...(search.view === "close" ? { view: "close" as const } : {}),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { day, view } = Route.useSearch();
  const { session } = Route.useRouteContext();
  return (
    <DailyFocusPageView
      accountId={session.data?.user.id}
      day={day}
      view={view}
    />
  );
}
