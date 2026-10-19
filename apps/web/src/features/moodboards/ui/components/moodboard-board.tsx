// biome-ignore-all lint/performance/noJsxPropsBind: The board binds pointer and key handlers to its mounted element.
import { outlineItemLabel } from "@cantiara/api/moodboard-outline";
import {
  boardLayout,
  fitViewport,
  isMeaninglessViewport,
  type PersonalViewport,
  panViewport,
  visibleRects,
  zoomViewport,
} from "@cantiara/api/moodboard-viewport";
import { MOODBOARD_UI_LABELS, type Moodboard } from "@cantiara/api/moodboards";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

const DEFAULT_SIZE = { height: 480, width: 800 };
const KEY_PAN_PIXELS = 80;
const ZOOM_STEP = 1.25;
/** Past this many visible items cards drop to reduced detail (no text, not focusable). */
export const BOARD_DETAIL_LIMIT = 150;

export interface MoodboardBoardProps {
  moodboard: Moodboard;
  onSelect: (itemId: string) => void;
  /** A user move; `null` means `Fit View` (neutral, nothing saved). */
  onViewportChange: (viewport: PersonalViewport | null) => void;
  /** The restored personal viewport, or null for neutral. */
  savedViewport: PersonalViewport | null;
  selectedId: string | null;
}

function useBoardSize(element: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState(DEFAULT_SIZE);
  useEffect(() => {
    const node = element.current;
    if (!(node && typeof ResizeObserver !== "undefined")) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { height, width } = entry?.contentRect ?? DEFAULT_SIZE;
      if (width > 0 && height > 0) {
        setSize({ height, width });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  return size;
}

/**
 * The spatial board for one Moodboard. Positions are derived from the item
 * order, so only the personal viewport is ever persisted, never layout. A saved
 * viewport that would open on an empty region fits visible content instead.
 */
export function MoodboardBoard(props: MoodboardBoardProps) {
  const { moodboard, onSelect, onViewportChange, savedViewport, selectedId } =
    props;
  const element = useRef<HTMLDivElement>(null);
  const size = useBoardSize(element);
  const rects = boardLayout(moodboard.items.map(({ id }) => id));
  // undefined follows the restored viewport; null is the neutral Fit View.
  const [moved, setMoved] = useState<PersonalViewport | null | undefined>(
    undefined,
  );
  const candidate = moved === undefined ? savedViewport : moved;
  const viewport =
    candidate && !isMeaninglessViewport(candidate, rects, size)
      ? candidate
      : fitViewport(rects, size);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const labels = new Map(
    moodboard.items.map((item) => [item.id, outlineItemLabel(item)]),
  );
  const colors = new Map(
    moodboard.items.flatMap((item) =>
      item.kind === "Color Swatch" ? [[item.id, item.color] as const] : [],
    ),
  );
  const shown = visibleRects(rects, viewport, size);
  const detailed = shown.length <= BOARD_DETAIL_LIMIT;

  function change(next: PersonalViewport) {
    setMoved(next);
    onViewportChange(next);
  }

  function fitToContent() {
    setMoved(null);
    onViewportChange(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    const pan: Record<string, [number, number]> = {
      ArrowDown: [0, KEY_PAN_PIXELS],
      ArrowLeft: [-KEY_PAN_PIXELS, 0],
      ArrowRight: [KEY_PAN_PIXELS, 0],
      ArrowUp: [0, -KEY_PAN_PIXELS],
    };
    const delta = pan[event.key];
    if (delta) {
      event.preventDefault();
      change(panViewport(viewport, delta[0], delta[1]));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      change(zoomViewport(viewport, ZOOM_STEP));
    } else if (event.key === "-") {
      event.preventDefault();
      change(zoomViewport(viewport, 1 / ZOOM_STEP));
    } else if (event.key === "0") {
      event.preventDefault();
      fitToContent();
    }
  }

  const buttonClass =
    "rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
  return (
    <section aria-label="Board" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} onClick={fitToContent} type="button">
          {MOODBOARD_UI_LABELS.fitView}
        </button>
        <button
          className={buttonClass}
          onClick={() => change(zoomViewport(viewport, ZOOM_STEP))}
          type="button"
        >
          Zoom in
        </button>
        <button
          className={buttonClass}
          onClick={() => change(zoomViewport(viewport, 1 / ZOOM_STEP))}
          type="button"
        >
          Zoom out
        </button>
        <span
          className="text-muted-foreground text-xs"
          id="moodboard-board-hint"
        >
          Arrow keys pan, + and - zoom, 0 fits the view.
        </span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: A keyboard-operable pan/zoom surface has no native element. */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Arrow, plus, minus, and 0 keys are the keyboard equivalent of drag and wheel. */}
      <div
        aria-describedby="moodboard-board-hint"
        aria-label={`Board, ${moodboard.items.length} items`}
        className="relative h-[480px] touch-none overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        data-center-x={viewport.centerX}
        data-center-y={viewport.centerY}
        data-testid="moodboard-board"
        data-zoom={viewport.zoom}
        onKeyDown={onKeyDown}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) {
            return;
          }
          drag.current = { x: event.clientX, y: event.clientY };
          change(
            panViewport(
              viewport,
              start.x - event.clientX,
              start.y - event.clientY,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        ref={element}
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The board surface takes focus so arrow keys can pan it.
        tabIndex={0}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${size.width / 2 - viewport.centerX * viewport.zoom}px, ${size.height / 2 - viewport.centerY * viewport.zoom}px) scale(${viewport.zoom})`,
          }}
        >
          {shown.map((rect) =>
            detailed ? (
              <button
                aria-pressed={selectedId === rect.id}
                className="absolute overflow-hidden rounded-md border bg-card p-2 text-left text-sm aria-pressed:ring-2 aria-pressed:ring-ring"
                key={rect.id}
                onClick={() => onSelect(rect.id)}
                style={{
                  backgroundColor: colors.get(rect.id),
                  height: rect.height,
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                }}
                type="button"
              >
                {labels.get(rect.id)}
              </button>
            ) : (
              <div
                aria-hidden="true"
                className="absolute rounded-md border bg-card"
                key={rect.id}
                style={{
                  backgroundColor: colors.get(rect.id),
                  height: rect.height,
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                }}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
