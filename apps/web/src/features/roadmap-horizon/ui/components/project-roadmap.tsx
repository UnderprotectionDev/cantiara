// biome-ignore-all lint/performance/noJsxPropsBind: Roadmap controls bind to the selected Work and view.
import type {
  RoadmapBlocker,
  RoadmapOriginLink,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import { RoadmapResults } from "./roadmap-results";
import RoadmapViewEditor from "./roadmap-view-editor";

type ViewSelection = "direction" | "all" | string;

function allWorkRoadmapView(projectId: string): RoadmapView {
  return {
    groupBy: "Horizon",
    horizons: [],
    id: "all-work-types",
    markBy: "Type",
    name: "All Work types",
    projectId,
    revision: 0,
    types: [],
  };
}

function roadmapViewForPresentation(
  selection: ViewSelection,
  selectedView: RoadmapView | null,
  projectId: string,
): RoadmapView | null {
  if (selection === "direction") {
    return null;
  }
  if (selection === "all") {
    return allWorkRoadmapView(projectId);
  }
  return selectedView ?? allWorkRoadmapView(projectId);
}

function presentationViewName(
  selection: ViewSelection,
  view: RoadmapView | null,
): string {
  if (selection === "direction") {
    return "Product direction";
  }
  return view?.name ?? "All Work types";
}

function presentationFocusableElements(roadmap: HTMLElement): HTMLElement[] {
  return Array.from(
    roadmap.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0);
}

function trapPresentationTab(
  event: KeyboardEvent,
  roadmap: HTMLElement | null,
) {
  if (event.key !== "Tab" || !roadmap) {
    return;
  }
  const focusable = presentationFocusableElements(roadmap);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!(first && last)) {
    event.preventDefault();
    roadmap.focus();
    return;
  }
  const active = document.activeElement;
  const isOutside = !roadmap.contains(active);
  if (event.shiftKey && (active === first || isOutside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || isOutside)) {
    event.preventDefault();
    first.focus();
  }
}

function usePresentationEscape(
  presentationMode: boolean,
  setPresentationMode: (active: boolean) => void,
  roadmapRef: RefObject<HTMLElement | null>,
  exitButtonRef: RefObject<HTMLButtonElement | null>,
  presentationButtonRef: RefObject<HTMLButtonElement | null>,
  restoreScrollY: RefObject<number>,
) {
  useEffect(() => {
    if (!presentationMode) {
      return;
    }
    exitButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPresentationMode(false);
        window.requestAnimationFrame(() => {
          window.scrollTo(0, restoreScrollY.current);
          presentationButtonRef.current?.focus();
        });
        return;
      }
      trapPresentationTab(event, roadmapRef.current);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    exitButtonRef,
    presentationButtonRef,
    presentationMode,
    roadmapRef,
    restoreScrollY,
    setPresentationMode,
  ]);
}

function RoadmapContent({
  blockers,
  onSaved,
  origins,
  presentationMode,
  projectId,
  selectedView,
  selection,
  viewForPresentation,
  works,
}: {
  blockers: RoadmapBlocker[];
  onSaved: (id: string) => void;
  origins: RoadmapOriginLink[];
  presentationMode: boolean;
  projectId: string;
  selectedView: RoadmapView | null;
  selection: ViewSelection;
  viewForPresentation: RoadmapView | null;
  works: WorkProfile[];
}) {
  if (presentationMode) {
    return (
      <RoadmapResults
        blockers={blockers}
        origins={origins}
        presentationMode
        view={viewForPresentation}
        works={works}
      />
    );
  }
  if (selection === "direction") {
    return (
      <RoadmapResults
        blockers={blockers}
        origins={origins}
        presentationMode={false}
        view={null}
        works={works}
      />
    );
  }
  return (
    <RoadmapViewEditor
      key={selection}
      onSaved={onSaved}
      projectId={projectId}
      renderResults={(view) => (
        <RoadmapResults
          blockers={blockers}
          origins={origins}
          presentationMode={false}
          view={view}
          works={works}
        />
      )}
      saved={selectedView}
    />
  );
}

export default function ProjectRoadmap({ projectId }: { projectId: string }) {
  const [selection, setSelection] = useState<ViewSelection>("direction");
  const [presentationMode, setPresentationMode] = useState(false);
  const roadmapRef = useRef<HTMLElement>(null);
  const presentationButtonRef = useRef<HTMLButtonElement>(null);
  const exitPresentationButtonRef = useRef<HTMLButtonElement>(null);
  const restoreScrollY = useRef(0);
  const worksQuery = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: false, projectId } }),
  );
  const viewsQuery = useQuery(
    orpc.projectRoadmapViews.queryOptions({ input: { projectId } }),
  );
  const originsQuery = useQuery(
    orpc.projectRoadmapOrigins.queryOptions({ input: { projectId } }),
  );
  const blockersQuery = useQuery(
    orpc.projectRoadmapBlockers.queryOptions({ input: { projectId } }),
  );
  const views = viewsQuery.data ?? [];
  const selectedView = views.find((view) => view.id === selection) ?? null;
  const presentationView = roadmapViewForPresentation(
    selection,
    selectedView,
    projectId,
  );
  usePresentationEscape(
    presentationMode,
    setPresentationMode,
    roadmapRef,
    exitPresentationButtonRef,
    presentationButtonRef,
    restoreScrollY,
  );

  function enterPresentationMode() {
    const roadmap = roadmapRef.current;
    if (!roadmap) {
      return;
    }
    restoreScrollY.current = window.scrollY;
    const innerScroll = Math.max(0, -roadmap.getBoundingClientRect().top);
    setPresentationMode(true);
    window.requestAnimationFrame(() => {
      if (roadmapRef.current) {
        roadmapRef.current.scrollTop = innerScroll;
      }
    });
  }

  function exitPresentationMode() {
    setPresentationMode(false);
    window.requestAnimationFrame(() => {
      window.scrollTo(0, restoreScrollY.current);
      presentationButtonRef.current?.focus();
    });
  }

  if (
    worksQuery.isPending ||
    viewsQuery.isPending ||
    originsQuery.isPending ||
    blockersQuery.isPending
  ) {
    return <p role="status">Loading…</p>;
  }
  if (
    worksQuery.isError ||
    viewsQuery.isError ||
    originsQuery.isError ||
    blockersQuery.isError
  ) {
    return <p role="alert">Roadmap is unavailable. Reload and try again.</p>;
  }

  const works = (worksQuery.data ?? []).filter(
    (work) => work.archivedAt === null,
  );
  const origins = originsQuery.data ?? [];
  const blockers = blockersQuery.data ?? [];
  const roadmapContent = (
    <RoadmapContent
      blockers={blockers}
      onSaved={setSelection}
      origins={origins}
      presentationMode={presentationMode}
      projectId={projectId}
      selectedView={selectedView}
      selection={selection}
      viewForPresentation={presentationView}
      works={works}
    />
  );

  return (
    <section
      aria-label="Roadmap"
      className={
        presentationMode
          ? "fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-8"
          : "space-y-6"
      }
      id="roadmap"
      ref={roadmapRef}
      tabIndex={presentationMode ? -1 : undefined}
    >
      {presentationMode ? (
        <div
          aria-label="Roadmap"
          aria-modal="true"
          className="grid min-h-full content-start gap-6"
          role="dialog"
        >
          <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="font-semibold text-2xl">Roadmap</h2>
              <p className="text-muted-foreground text-sm">
                {presentationViewName(selection, presentationView)}
              </p>
            </div>
            <Button
              onClick={exitPresentationMode}
              ref={exitPresentationButtonRef}
              size="sm"
              type="button"
              variant="outline"
            >
              Exit Presentation Mode
            </Button>
          </header>
          {roadmapContent}
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="font-semibold text-2xl">Roadmap</h2>
              <p className="text-muted-foreground text-sm">
                Horizons describe direction. They do not start Work, set dates,
                or promise a release.
              </p>
            </div>
            <Button
              onClick={enterPresentationMode}
              ref={presentationButtonRef}
              size="sm"
              type="button"
              variant="outline"
            >
              Presentation Mode
            </Button>
          </header>
          <label className="grid max-w-sm gap-1 text-sm" htmlFor="roadmap-view">
            Named view
            <select
              className="min-h-11 rounded-md border bg-background px-3"
              id="roadmap-view"
              onChange={(event) => setSelection(event.target.value)}
              value={selection}
            >
              <option value="direction">Product direction</option>
              <option value="all">All Work types</option>
              {views.map((saved) => (
                <option key={saved.id} value={saved.id}>
                  {saved.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {!presentationMode && roadmapContent}
    </section>
  );
}
