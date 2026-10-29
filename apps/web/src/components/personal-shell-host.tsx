import { useRouteContext } from "@tanstack/react-router";
import { Suspense, useCallback, useState } from "react";
import NotificationCenterSurface from "@/features/attention-signals/ui/components/notification-center-surface";
import DailyFocusView from "@/features/daily-focus/ui/views/daily-focus-view";
import FavoritesList from "@/features/favorites/ui/components/favorites-list";
import LookAgainList from "@/features/personal-reminders/ui/components/look-again-list";
import type { PersonalShellSurface } from "@/features/personal-shell/lib/personal-shell";
import PersonalShell from "@/features/personal-shell/ui/components/personal-shell";
import { useOpenSourceRecord } from "@/features/record-discovery/ui/components/context-record-preview";

/** Composes the four owners' surfaces into the Personal Shell panel. */
export default function PersonalShellHost() {
  const { session } = useRouteContext({ from: "/_auth" });
  const openSourceRecord = useOpenSourceRecord();
  const [day, setDay] = useState<string | undefined>();
  const [view, setView] = useState<"close" | undefined>();
  const selectDay = useCallback((selected: string) => {
    setDay(selected);
    setView(undefined);
  }, []);
  const openCloseFocus = useCallback((selected: string) => {
    setDay(selected);
    setView("close");
  }, []);
  const renderSurface = useCallback(
    (surface: PersonalShellSurface, close: () => void) => {
      switch (surface) {
        case "Daily Focus":
          return (
            <DailyFocusView
              accountId={session.data.user.id}
              day={day}
              onOpenCloseFocus={openCloseFocus}
              onReturnToDailyFocus={selectDay}
              onSelectDay={selectDay}
              view={view}
            />
          );
        case "Favorites":
          return (
            <Suspense fallback={<p role="status">Loading Favorites…</p>}>
              <FavoritesList onOpenSource={close} />
            </Suspense>
          );
        case "Look again":
          return (
            <LookAgainList
              onOpenSource={close}
              openSourceRecord={openSourceRecord}
            />
          );
        case "Notification Center":
          return <NotificationCenterSurface />;
        default:
          return null;
      }
    },
    [
      day,
      openCloseFocus,
      openSourceRecord,
      selectDay,
      session.data.user.id,
      view,
    ],
  );
  return <PersonalShell renderSurface={renderSurface} />;
}
