import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import DailyFocusView from "./daily-focus-view";

export default function DailyFocusPageView({
  accountId,
  day,
  view,
}: {
  accountId: string | undefined;
  day: string | undefined;
  view: "close" | undefined;
}) {
  const navigate = useNavigate({ from: "/daily-focus" });
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
        accountId={accountId}
        day={day}
        onOpenCloseFocus={openCloseFocus}
        onReturnToDailyFocus={selectDay}
        onSelectDay={selectDay}
        view={view}
      />
    </ClientShellContent>
  );
}
