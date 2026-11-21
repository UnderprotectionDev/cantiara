// biome-ignore-all lint/performance/noJsxPropsBind: Tour controls act on the current transient driver.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { SinceLastLooked } from "@cantiara/api/return-to-work";
import {
  createReturnVisualTour,
  type ReturnCanvasViewport,
  type ReturnVisualTourState,
} from "@cantiara/api/return-visual-tour";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import {
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRoadmapSession } from "../../../roadmap-horizon/store/roadmap-session";
import LiveRoadmapCanvas from "../../../roadmap-horizon/ui/components/live-roadmap-canvas";
import VisualTourPanel from "./visual-tour-panel";

export function returnEventElementId(id: string) {
  return `return-event-${encodeURIComponent(id)}`;
}

function VisualTourSession({
  changes,
  isOpen,
  projectId,
  preferences,
  onClose,
  driver,
}: {
  changes: SinceLastLooked;
  isOpen: () => boolean;
  projectId: string;
  preferences: AccountPreferences;
  onClose: (remainingId?: string) => void;
  driver: RefObject<ReturnType<typeof createReturnVisualTour> | null>;
}) {
  const session = useRoadmapSession();
  const roadmapView = session?.state.view ?? null;
  const openingView = useCreateStore(() => roadmapView);
  const view = useSelector(openingView);
  const tourState = useCreateStore<ReturnVisualTourState>({
    status: "loading",
    current: null,
    limit: 20,
    position: 0,
    total: 0,
    remainder: null,
    restoration: "not-needed",
  });
  const state = useSelector(tourState);
  const publish = useCallback(
    (tour: NonNullable<typeof driver.current>) => {
      if (isOpen() && driver.current === tour) {
        tourState.setState(() => ({ ...tour.state }));
      }
    },
    [driver, isOpen, tourState],
  );
  const ready = useCallback(
    (canvas: ReturnCanvasViewport) => {
      if (driver.current || !isOpen()) {
        return;
      }
      const tour = createReturnVisualTour(changes, canvas);
      driver.current = tour;
      const pending = tour.start();
      publish(tour);
      pending.then(() => publish(tour));
    },
    [changes, driver, isOpen, publish],
  );
  const next = () => {
    const tour = driver.current;
    if (!tour) {
      return;
    }
    const pending = tour.next();
    publish(tour);
    pending.then(() => publish(tour));
  };
  return (
    <>
      <DialogTitle>Tour the visual changes</DialogTitle>
      <DialogDescription>
        Current Roadmap targets from the same Since you last looked list. Hidden
        targets are skipped without changing the view.
      </DialogDescription>
      <LiveRoadmapCanvas onReady={ready} projectId={projectId} view={view} />
      <VisualTourPanel
        onClose={() => onClose()}
        onNext={next}
        onRemainder={() =>
          onClose(driver.current?.state.remainder?.firstEventId)
        }
        preferences={preferences}
        state={state}
      />
    </>
  );
}

export default function VisualChangesTour({
  changes,
  projectId,
  preferences,
}: {
  changes: SinceLastLooked;
  projectId: string;
  preferences: AccountPreferences;
}) {
  const [handle] = useState(createDialogHandle<SinceLastLooked>);
  const triggerId = useId();
  const isOpen = useCallback(() => handle.isOpen, [handle]);
  const remaining = useRef<string | null>(null);
  const driver = useRef<ReturnType<typeof createReturnVisualTour> | null>(null);
  useEffect(
    () => () => {
      driver.current?.close();
    },
    [],
  );
  const restoreViewport = useCallback(() => {
    const tour = driver.current;
    tour?.close().then(() => {
      if (tour.state.restoration === "failed") {
        toast.error("The Roadmap viewport could not be restored or fitted.");
      }
    });
  }, []);
  const finish = useCallback(
    (remainingId?: string) => {
      remaining.current = remainingId ?? null;
      handle.close();
    },
    [handle],
  );
  return (
    <>
      <DialogTrigger
        handle={handle}
        id={triggerId}
        payload={changes}
        render={<Button variant="outline" />}
      >
        Tour the visual changes
      </DialogTrigger>
      <Dialog
        handle={handle}
        onOpenChange={(open) => {
          if (open) {
            driver.current = null;
            remaining.current = null;
          } else {
            restoreViewport();
          }
        }}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen && remaining.current) {
            const element = document.getElementById(
              returnEventElementId(remaining.current),
            );
            (element ?? document.getElementById(triggerId))?.focus();
            element?.scrollIntoView({ block: "center", behavior: "auto" });
          }
        }}
      >
        {({ payload }) =>
          payload ? (
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
              finalFocus={() => !remaining.current}
              showCloseButton={false}
            >
              <VisualTourSession
                changes={payload}
                driver={driver}
                isOpen={isOpen}
                onClose={finish}
                preferences={preferences}
                projectId={projectId}
              />
            </DialogContent>
          ) : null
        }
      </Dialog>
    </>
  );
}
