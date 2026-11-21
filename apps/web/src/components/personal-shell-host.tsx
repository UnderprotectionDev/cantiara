import { useRouteContext } from "@tanstack/react-router";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { Suspense, useCallback } from "react";
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
  return (
    <AccountPersonalShell
      accountId={session.data.user.id}
      key={session.data.user.id}
    />
  );
}

function AccountPersonalShell({ accountId }: { accountId: string }) {
  const openSourceRecord = useOpenSourceRecord();
  const focus = useCreateStore<{ day?: string; view?: "close" }>({});
  const { day, view } = useSelector(focus, (value) => value);
  const selectDay = useCallback(
    (selected: string) => {
      focus.setState(() => ({ day: selected }));
    },
    [focus],
  );
  const openCloseFocus = useCallback(
    (selected: string) => {
      focus.setState(() => ({ day: selected, view: "close" }));
    },
    [focus],
  );
  const renderSurface = useCallback(
    (surface: PersonalShellSurface, close: () => void) => {
      switch (surface) {
        case "Daily Focus":
          return (
            <DailyFocusView
              accountId={accountId}
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
    [day, openCloseFocus, openSourceRecord, selectDay, accountId, view],
  );
  return <PersonalShell renderSurface={renderSurface} />;
}
