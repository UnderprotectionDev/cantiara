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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRoadmapSession } from "../../roadmap-horizon/store/roadmap-session";
import LiveRoadmapCanvas from "../../roadmap-horizon/ui/components/live-roadmap-canvas";
import VisualTourPanel from "./visual-tour-panel";

export function returnEventElementId(id: string) {
  return `return-event-${encodeURIComponent(id)}`;
}

function VisualTourSession({
  changes,
  projectId,
  preferences,
  onClose,
  driver,
}: {
  changes: SinceLastLooked;
  projectId: string;
  preferences: AccountPreferences;
  onClose: (remainingId?: string) => void;
  driver: RefObject<ReturnType<typeof createReturnVisualTour> | null>;
}) {
  const session = useRoadmapSession();
  const [view] = useState(() => session?.state.view ?? null);
  const [state, setState] = useState<ReturnVisualTourState>({
    status: "loading",
    current: null,
    limit: 20,
    position: 0,
    total: 0,
    remainder: null,
    restoration: "not-needed",
  });
  const ready = useCallback(
    (canvas: ReturnCanvasViewport) => {
      if (driver.current) {
        return;
      }
      const tour = createReturnVisualTour(changes, canvas);
      driver.current = tour;
      const pending = tour.start();
      setState({ ...tour.state });
      pending.then(() => setState({ ...tour.state }));
    },
    [changes, driver],
  );
  const next = () => {
    const tour = driver.current;
    if (!tour) {
      return;
    }
    const pending = tour.next();
    setState({ ...tour.state });
    pending.then(() => setState({ ...tour.state }));
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
  const [activeChanges, setActiveChanges] = useState<SinceLastLooked | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const remaining = useRef<string | null>(null);
  const driver = useRef<ReturnType<typeof createReturnVisualTour> | null>(null);
  useEffect(
    () => () => {
      driver.current?.close();
    },
    [],
  );
  const finish = useCallback((remainingId?: string) => {
    remaining.current = remainingId ?? null;
    const tour = driver.current;
    setOpen(false);
    if (!tour) {
      setActiveChanges(null);
      return;
    }
    tour.close().then(() => {
      if (tour.state.restoration === "failed") {
        toast.error("The Roadmap viewport could not be restored or fitted.");
      }
      if (driver.current === tour) {
        setActiveChanges(null);
      }
    });
  }, []);
  const openChanged = (nextOpen: boolean) => {
    if (nextOpen) {
      driver.current = null;
      setActiveChanges(changes);
      setOpen(true);
    } else {
      finish();
    }
  };
  return (
    <Dialog
      onOpenChange={openChanged}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen && remaining.current) {
          const element = document.getElementById(
            returnEventElementId(remaining.current),
          );
          remaining.current = null;
          element?.focus();
          element?.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }}
      open={open}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        Tour the visual changes
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
        showCloseButton={false}
      >
        {activeChanges !== null && (
          <VisualTourSession
            changes={activeChanges}
            driver={driver}
            onClose={finish}
            preferences={preferences}
            projectId={projectId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
