// biome-ignore-all lint/performance/noJsxPropsBind: Form fields and action buttons close over the current TanStack Form field handlers and binder state.
import type {
  FileAttachmentLocation,
  FileAttachmentLocationBindInput,
  FileAttachmentLocationBindPreview,
  FileAttachmentLocationBindPreviewInput,
  FileAttachmentMarking,
  FileAttachmentMarkingInput,
  FileAttachmentMarkingTool,
} from "@cantiara/api/file-attachments";
import {
  FILE_ATTACHMENT_MARKING_GEOMETRY,
  FILE_ATTACHMENT_UI_LABELS,
} from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Arrow as KonvaArrow,
  Layer,
  Line,
  Rect,
  Stage,
} from "react-konva";
import {
  clampCoordinate,
  objectContainBox,
} from "../../lib/file-attachment-markup-geometry";
import FileAttachmentLocationBinder, {
  type LocationKind,
} from "../forms/file-attachment-location-form";

interface Point {
  x: number;
  y: number;
}

type SurfaceKind = "image" | "pdf";

interface MarkupLocationProps {
  location: FileAttachmentLocation | null;
  locationKind: LocationKind;
  onCreateMarking: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onMarkingError: () => void;
  onSelectLocation: (location: FileAttachmentLocation) => void;
  selectingLocation: boolean;
}

const TOOL_LABELS: Record<FileAttachmentMarkingTool, string> = {
  arrow: FILE_ATTACHMENT_UI_LABELS.arrow,
  highlighter: FILE_ATTACHMENT_UI_LABELS.highlighter,
  pen: FILE_ATTACHMENT_UI_LABELS.pen,
  rectangle: FILE_ATTACHMENT_UI_LABELS.rectangle,
};

const TOOL_COLORS: Record<FileAttachmentMarkingTool, string> = {
  arrow: "#ef4444",
  highlighter: "#f59e0b",
  pen: "#2563eb",
  rectangle: "#16a34a",
};

function pointForEvent(
  event: KonvaEventObject<MouseEvent>,
  width: number,
  height: number,
) {
  const stage = event.target.getStage();
  const point = stage?.getPointerPosition();
  if (!point) {
    return null;
  }
  return {
    x: clampCoordinate(point.x / width),
    y: clampCoordinate(point.y / height),
  } satisfies Point;
}

function markingPage(marking: FileAttachmentMarking) {
  return marking.geometry.page;
}

function geometryPoints(marking: FileAttachmentMarking) {
  switch (marking.geometry.kind) {
    case "arrow":
      return [marking.geometry.start, marking.geometry.end];
    case "path":
      return marking.geometry.points;
    case "rectangle":
      return [];
    default:
      return [];
  }
}

function scaledPoints(points: Point[], width: number, height: number) {
  return points.flatMap((point) => [point.x * width, point.y * height]);
}

function normalizedRegion(start: Point, end: Point) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    height: Math.max(0.001, Math.abs(end.y - start.y)),
    width: Math.max(0.001, Math.abs(end.x - start.x)),
    x,
    y,
  };
}

function locationFromPoints(
  kind: LocationKind,
  points: Point[],
  page?: number,
): FileAttachmentLocation | null {
  const [start, end] = [points[0], points.at(-1)];
  if (!(start && end)) {
    return null;
  }
  const pageField = page === undefined ? {} : { page };
  return kind === "point"
    ? { kind, ...pageField, x: end.x, y: end.y }
    : { kind, ...pageField, region: normalizedRegion(start, end) };
}

function markingGeometryFromDraft(
  tool: FileAttachmentMarkingTool,
  points: Point[],
  page?: number,
): FileAttachmentMarkingInput["geometry"] | null {
  const [start, end] = [points[0], points.at(-1)];
  if (!(start && end)) {
    return null;
  }
  const pageField = page === undefined ? {} : { page };

  const geometryKind = FILE_ATTACHMENT_MARKING_GEOMETRY[tool];
  if (geometryKind === "arrow") {
    return { end, kind: geometryKind, ...pageField, start };
  }
  if (geometryKind === "rectangle") {
    return {
      kind: geometryKind,
      ...pageField,
      region: normalizedRegion(start, end),
    };
  }
  return { kind: geometryKind, ...pageField, points };
}

function markingInputFromDraft(
  tool: FileAttachmentMarkingTool,
  points: Point[],
  attachmentId: string,
  versionId: string,
  page?: number,
): FileAttachmentMarkingInput | null {
  const geometry = markingGeometryFromDraft(tool, points, page);
  if (!geometry) {
    return null;
  }
  return {
    attachmentId,
    clientIdempotencyKey: crypto.randomUUID(),
    geometry,
    tool,
    versionId,
  };
}

function MarkingShapes({
  height,
  markings,
  page,
  width,
}: {
  height: number;
  markings: readonly FileAttachmentMarking[];
  page?: number;
  width: number;
}) {
  return (
    <>
      {markings
        .filter((marking) => markingPage(marking) === page)
        .map((marking) => {
          const color = TOOL_COLORS[marking.tool];
          if (marking.geometry.kind === "rectangle") {
            return (
              <Rect
                fill={`${color}22`}
                height={marking.geometry.region.height * height}
                key={marking.id}
                listening={false}
                stroke={color}
                strokeWidth={3}
                width={marking.geometry.region.width * width}
                x={marking.geometry.region.x * width}
                y={marking.geometry.region.y * height}
              />
            );
          }
          const points = scaledPoints(geometryPoints(marking), width, height);
          if (marking.geometry.kind === "arrow") {
            return (
              <KonvaArrow
                fill={color}
                key={marking.id}
                listening={false}
                pointerLength={10}
                pointerWidth={10}
                points={points}
                stroke={color}
                strokeWidth={3}
              />
            );
          }
          return (
            <Line
              key={marking.id}
              lineCap="round"
              lineJoin="round"
              listening={false}
              opacity={marking.tool === "highlighter" ? 0.35 : 1}
              points={points}
              stroke={color}
              strokeWidth={marking.tool === "highlighter" ? 18 : 4}
            />
          );
        })}
    </>
  );
}

function LocationShape({
  height,
  location,
  page,
  width,
}: {
  height: number;
  location?: FileAttachmentLocation | null;
  page?: number;
  width: number;
}) {
  if (!location || location.page !== page) {
    return null;
  }
  if (location.kind === "point") {
    return (
      <Circle
        fill="#0f172a"
        listening={false}
        radius={8}
        stroke="#f8fafc"
        strokeWidth={2}
        x={location.x * width}
        y={location.y * height}
      />
    );
  }
  return (
    <Rect
      fill="#0f172a22"
      height={location.region.height * height}
      listening={false}
      stroke="#0f172a"
      strokeDash={[8, 6]}
      strokeWidth={2}
      width={location.region.width * width}
      x={location.region.x * width}
      y={location.region.y * height}
    />
  );
}

function MarkupSurface({
  attachmentId,
  children,
  disabled = false,
  location,
  locationKind = "point",
  markings,
  onCreateMarking,
  onMarkingError,
  onSelectLocation,
  page,
  selectingLocation = false,
  tool,
  versionId,
}: {
  attachmentId: string;
  children: React.ReactNode;
  disabled?: boolean;
  location?: FileAttachmentLocation | null;
  locationKind?: LocationKind;
  markings: readonly FileAttachmentMarking[];
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onMarkingError?: () => void;
  onSelectLocation?: (location: FileAttachmentLocation) => void;
  page?: number;
  selectingLocation?: boolean;
  tool: FileAttachmentMarkingTool;
  versionId: string;
}) {
  const fallbackSize = {
    height: page === undefined ? 720 : 1400,
    width: 1000,
  };
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [surfaceSize, setSurfaceSize] = useState(fallbackSize);
  const [media, setMedia] = useState<
    HTMLCanvasElement | HTMLImageElement | null
  >(null);
  const [mediaSize, setMediaSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const updateSize = () => {
      const bounds = surface.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setSurfaceSize({ height: bounds.height, width: bounds.width });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMedia(
      surfaceRef.current?.querySelector<HTMLCanvasElement | HTMLImageElement>(
        "img, canvas",
      ) ?? null,
    );
  });

  useEffect(() => {
    if (!media) {
      setMediaSize(null);
      return;
    }
    const measure = () => {
      const width =
        media instanceof HTMLImageElement ? media.naturalWidth : media.width;
      const height =
        media instanceof HTMLImageElement ? media.naturalHeight : media.height;
      if (width > 0 && height > 0) {
        setMediaSize({ height, width });
      }
    };
    measure();
    media.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(media);
    return () => {
      media.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [media]);

  // Markings and Bind as origin coordinates are relative to the displayed
  // source visual, so the drawing surface tracks the object-contain content
  // rect instead of the responsive element box that letterboxes around it.
  const contentBox = useMemo(
    () =>
      mediaSize
        ? objectContainBox(
            mediaSize.width,
            mediaSize.height,
            surfaceSize.width,
            surfaceSize.height,
          )
        : {
            height: surfaceSize.height,
            left: 0,
            top: 0,
            width: surfaceSize.width,
          },
    [mediaSize, surfaceSize],
  );
  const { height, width } = contentBox;

  const getPoint = useCallback(
    (event: KonvaEventObject<MouseEvent>) =>
      pointForEvent(event, width, height),
    [height, width],
  );
  const handlePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (disabled) {
        return;
      }
      const point = getPoint(event);
      if (point) {
        setDraft([point]);
      }
    },
    [disabled, getPoint],
  );
  const handlePointerMove = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (disabled || draft.length === 0) {
        return;
      }
      const point = getPoint(event);
      if (!point) {
        return;
      }
      if (selectingLocation) {
        setDraft((current) => [current[0] ?? point, point]);
        return;
      }
      setDraft((current) =>
        tool === "pen" || tool === "highlighter"
          ? [...current, point]
          : [current[0] ?? point, point],
      );
    },
    [disabled, draft.length, getPoint, selectingLocation, tool],
  );
  const handlePointerUp = useCallback(() => {
    if (disabled) {
      setDraft([]);
      return;
    }
    if (selectingLocation) {
      const selectedLocation = locationFromPoints(locationKind, draft, page);
      setDraft([]);
      if (selectedLocation) {
        onSelectLocation?.(selectedLocation);
      }
      return;
    }
    if (draft.length < 2) {
      setDraft([]);
      return;
    }
    const input = markingInputFromDraft(
      tool,
      draft,
      attachmentId,
      versionId,
      page,
    );
    setDraft([]);
    if (input) {
      Promise.resolve()
        .then(() => onCreateMarking?.(input))
        .catch(() => onMarkingError?.());
    }
  }, [
    attachmentId,
    disabled,
    draft,
    locationKind,
    onCreateMarking,
    onMarkingError,
    onSelectLocation,
    page,
    selectingLocation,
    tool,
    versionId,
  ]);

  const draftMarking = useMemo(() => {
    if (selectingLocation || draft.length === 0) {
      return [];
    }
    const geometry = markingGeometryFromDraft(tool, draft, page);
    if (!geometry) {
      return [];
    }
    return [
      {
        attachmentId,
        createdAt: new Date(0).toISOString(),
        geometry,
        id: "draft",
        tool,
        versionId,
      } satisfies FileAttachmentMarking,
    ];
  }, [attachmentId, draft, page, selectingLocation, tool, versionId]);
  const draftLocation = useMemo(
    () =>
      selectingLocation ? locationFromPoints(locationKind, draft, page) : null,
    [draft, locationKind, page, selectingLocation],
  );

  return (
    <div
      className="relative overflow-hidden rounded-md"
      data-markup-surface
      ref={surfaceRef}
    >
      {children}
      <div
        className="absolute"
        style={{ left: contentBox.left, top: contentBox.top }}
      >
        <Stage
          height={height}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          width={width}
        >
          <Layer>
            <LocationShape
              height={height}
              location={draftLocation ?? location}
              page={page}
              width={width}
            />
            <MarkingShapes
              height={height}
              markings={[...markings, ...draftMarking]}
              page={page}
              width={width}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

export function FileAttachmentMarkup({
  alt = "",
  assetURL,
  attachmentId,
  children,
  kind,
  markings = [],
  onBindLocation,
  onCreateMarking,
  onUndoMarking,
  onPreviewLocation,
  page,
  pageCount,
  projectId,
  versionId,
}: {
  alt?: string;
  assetURL: string;
  attachmentId: string;
  children?:
    | React.ReactNode
    | ((
        tool: FileAttachmentMarkingTool,
        locationProps: MarkupLocationProps,
      ) => React.ReactNode);
  kind: SurfaceKind;
  markings?: readonly FileAttachmentMarking[];
  onBindLocation?: (
    input: FileAttachmentLocationBindInput,
  ) => void | Promise<void>;
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onUndoMarking?: (marking: FileAttachmentMarking) => void | Promise<void>;
  onPreviewLocation?: (
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  page?: number;
  pageCount?: number;
  projectId?: string;
  versionId: string;
}) {
  const [tool, setTool] = useState<FileAttachmentMarkingTool>("pen");
  const [markingError, setMarkingError] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationKind, setLocationKind] = useState<LocationKind>("point");
  const initialPage = page ?? (pageCount ? 1 : undefined);
  const [location, setLocation] = useState<FileAttachmentLocation>(() => ({
    kind: "point",
    ...(initialPage === undefined ? {} : { page: initialPage }),
    x: 0.5,
    y: 0.5,
  }));
  const handleCreateMarking = useCallback(
    async (input: FileAttachmentMarkingInput) => {
      setMarkingError(null);
      await onCreateMarking?.(input);
    },
    [onCreateMarking],
  );
  const handleMarkingError = useCallback(() => {
    setMarkingError(FILE_ATTACHMENT_UI_LABELS.markingSaveFailed);
  }, []);
  const pageMarkings =
    page === undefined
      ? markings
      : markings.filter((marking) => marking.geometry.page === page);
  const undoTarget = pageMarkings.at(-1) ?? markings.at(-1);
  const handleToolSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const candidate = event.currentTarget.dataset.tool;
      if (candidate && candidate in TOOL_LABELS) {
        setTool(candidate as FileAttachmentMarkingTool);
      }
    },
    [],
  );
  const handleUndo = useCallback(() => {
    if (!(undoTarget && onUndoMarking)) {
      return;
    }
    Promise.resolve(onUndoMarking(undoTarget))
      .then(() => {
        setMarkingError(null);
      })
      .catch(() => {
        setMarkingError(FILE_ATTACHMENT_UI_LABELS.markingUndoFailed);
      });
  }, [onUndoMarking, undoTarget]);
  const toggleLocation = useCallback(() => {
    setLocationOpen((current) => !current);
  }, []);
  const closeLocation = useCallback(() => {
    setLocationOpen(false);
  }, []);
  const handleLocationSelect = useCallback(
    (nextLocation: FileAttachmentLocation) => {
      setLocationKind(nextLocation.kind);
      setLocation(nextLocation);
    },
    [],
  );
  const handleLocationKindChange = useCallback((nextKind: LocationKind) => {
    setLocationKind(nextKind);
    setLocation((current) => {
      const pageField =
        current.page === undefined ? {} : { page: current.page };
      const x =
        current.kind === "point"
          ? current.x
          : current.region.x + current.region.width / 2;
      const y =
        current.kind === "point"
          ? current.y
          : current.region.y + current.region.height / 2;
      return nextKind === "point"
        ? { kind: nextKind, ...pageField, x, y }
        : {
            kind: nextKind,
            ...pageField,
            region: {
              height: 0.2,
              width: 0.2,
              x: clampCoordinate(x),
              y: clampCoordinate(y),
            },
          };
    });
  }, []);
  const markupLocationProps = {
    location: locationOpen ? location : null,
    locationKind,
    onCreateMarking: handleCreateMarking,
    onMarkingError: handleMarkingError,
    onSelectLocation: handleLocationSelect,
    selectingLocation: locationOpen,
  } satisfies MarkupLocationProps;
  let surface: React.ReactNode;
  if (kind === "image") {
    surface = (
      <MarkupSurface
        attachmentId={attachmentId}
        location={locationOpen ? location : null}
        locationKind={locationKind}
        markings={markings}
        onCreateMarking={handleCreateMarking}
        onMarkingError={handleMarkingError}
        onSelectLocation={handleLocationSelect}
        selectingLocation={locationOpen}
        tool={tool}
        versionId={versionId}
      >
        <img
          alt={alt}
          className="block max-h-[min(70vh,42rem)] w-full rounded-md bg-muted/30 object-contain"
          height={720}
          src={assetURL}
          width={1280}
        />
      </MarkupSurface>
    );
  } else if (typeof children === "function") {
    surface = children(tool, markupLocationProps);
  } else {
    surface = children;
  }
  return (
    <div className="space-y-3" data-marking-layer>
      <div
        aria-label={FILE_ATTACHMENT_UI_LABELS.markingLayer}
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
      >
        {(Object.keys(TOOL_LABELS) as FileAttachmentMarkingTool[]).map(
          (candidate) => (
            <Button
              aria-pressed={tool === candidate}
              data-tool={candidate}
              key={candidate}
              onClick={handleToolSelect}
              size="xs"
              type="button"
              variant={tool === candidate ? "secondary" : "outline"}
            >
              {TOOL_LABELS[candidate]}
            </Button>
          ),
        )}
        <Button
          disabled={!(undoTarget && onUndoMarking)}
          onClick={handleUndo}
          size="xs"
          type="button"
          variant="outline"
        >
          {FILE_ATTACHMENT_UI_LABELS.undo}
        </Button>
        <Button
          onClick={toggleLocation}
          size="xs"
          type="button"
          variant="outline"
        >
          {FILE_ATTACHMENT_UI_LABELS.bindAsOrigin}
        </Button>
      </div>
      {markingError ? (
        <p className="text-destructive text-xs" role="alert">
          {markingError}
        </p>
      ) : null}
      {locationOpen ? (
        <FileAttachmentLocationBinder
          attachmentId={attachmentId}
          location={location}
          locationKind={locationKind}
          onBind={onBindLocation}
          onClose={closeLocation}
          onLocationChange={handleLocationSelect}
          onLocationKindChange={handleLocationKindChange}
          onPreview={onPreviewLocation}
          pageCount={pageCount}
          projectId={projectId}
          versionId={versionId}
        />
      ) : null}
      {surface}
      {kind === "pdf" && pageCount ? (
        <p className="text-muted-foreground text-xs">
          Page tools record each Marking against the selected File Attachment
          version.
        </p>
      ) : null}
    </div>
  );
}

export { MarkupSurface };
