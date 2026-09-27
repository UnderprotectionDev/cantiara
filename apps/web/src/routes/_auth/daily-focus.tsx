import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import DailyFocusView from "@/features/daily-focus/ui/daily-focus-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

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
  const navigate = Route.useNavigate();
  const { session } = Route.useRouteContext();
  const selectDay = useCallback(
    (selectedDay: string) => navigate({ search: { day: selectedDay } }),
    [navigate],
  );
  const openCloseFocus = useCallback(
    (selectedDay: string) =>
      navigate({ search: { day: selectedDay, view: "close" } }),
    [navigate],
  );
  return (
    <ClientShellContent>
      <DailyFocusView
        accountId={session.data?.user.id}
        day={day}
        onOpenCloseFocus={openCloseFocus}
        onReturnToDailyFocus={selectDay}
        onSelectDay={selectDay}
        view={view}
      />
    </ClientShellContent>
  );
}
