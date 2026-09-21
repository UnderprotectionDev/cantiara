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
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
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

interface Point {
  x: number;
  y: number;
}

type SurfaceKind = "image" | "pdf";
type LocationKind = "point" | "region";

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

function clampCoordinate(value: number) {
  return Math.min(1, Math.max(0, value));
}

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

  const { height, width } = surfaceSize;

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
      <Stage
        className="absolute inset-0 h-full w-full"
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
    if (undoTarget) {
      Promise.resolve(onUndoMarking?.(undoTarget)).catch(() => undefined);
    }
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

interface LocationBinderValues {
  description: string;
  height: number;
  page: number;
  projectId: string;
  title: string;
  width: number;
  workId: string;
  x: number;
  y: number;
}

function locationBinderValues(
  location: FileAttachmentLocation,
  projectId = "",
): LocationBinderValues {
  return {
    description: "",
    height: location.kind === "region" ? location.region.height : 0,
    page: location.page ?? 1,
    projectId,
    title: FILE_ATTACHMENT_UI_LABELS.markedSourceLocation,
    workId: "",
    width: location.kind === "region" ? location.region.width : 0,
    x: location.kind === "point" ? location.x : location.region.x,
    y: location.kind === "point" ? location.y : location.region.y,
  };
}

function locationFromBinderValues(
  values: LocationBinderValues,
  locationKind: LocationKind,
  pageCount?: number,
): FileAttachmentLocation {
  const page = pageCount
    ? Math.max(1, Math.min(pageCount, Math.round(values.page) || 1))
    : undefined;
  const pageField = page === undefined ? {} : { page };
  const x = clampCoordinate(values.x);
  const y = clampCoordinate(values.y);
  if (locationKind === "point") {
    return { kind: locationKind, ...pageField, x, y };
  }
  return {
    kind: locationKind,
    ...pageField,
    region: {
      height: Math.min(1 - y, Math.max(0.001, clampCoordinate(values.height))),
      width: Math.min(1 - x, Math.max(0.001, clampCoordinate(values.width))),
      x,
      y,
    },
  };
}

function FileAttachmentLocationBinder({
  attachmentId,
  location,
  locationKind,
  onBind,
  onClose,
  onLocationChange,
  onLocationKindChange,
  onPreview,
  pageCount,
  projectId,
  versionId,
}: {
  attachmentId: string;
  location: FileAttachmentLocation;
  locationKind: LocationKind;
  onBind?: (input: FileAttachmentLocationBindInput) => void | Promise<void>;
  onClose: () => void;
  onLocationChange: (location: FileAttachmentLocation) => void;
  onLocationKindChange: (kind: LocationKind) => void;
  onPreview?: (
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  pageCount?: number;
  projectId?: string;
  versionId: string;
}) {
  const [mode, setMode] = useState<"new" | "existing">("existing");
  const [preview, setPreview] =
    useState<FileAttachmentLocationBindPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bindIdempotencyKey = useRef<string | null>(null);
  const submitAction = useRef<"bind" | "preview">("preview");
  const form = useForm({
    defaultValues: locationBinderValues(location, projectId),
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Preview and confirm share one validated form submission boundary while targeting two distinct File Attachment operations.
    onSubmit: async ({ value }) => {
      const nextLocation = locationFromBinderValues(
        value,
        locationKind,
        pageCount,
      );
      onLocationChange(nextLocation);

      if (submitAction.current === "preview") {
        bindIdempotencyKey.current = null;
        if (!onPreview) {
          setError(FILE_ATTACHMENT_UI_LABELS.locationPreviewUnavailable);
          return;
        }
        if (mode === "new" && !value.projectId.trim()) {
          setError(FILE_ATTACHMENT_UI_LABELS.newWorkProjectRequired);
          return;
        }
        const input =
          mode === "new"
            ? {
                attachmentId,
                description: value.description.trim() || null,
                location: nextLocation,
                mode,
                projectId: value.projectId.trim(),
                title: value.title,
                type: "Task" as const,
                versionId,
              }
            : {
                attachmentId,
                location: nextLocation,
                mode,
                versionId,
                workId: value.workId,
              };
        try {
          setPreview(await onPreview(input));
          setError(null);
        } catch {
          setError(FILE_ATTACHMENT_UI_LABELS.locationPreviewUnavailable);
        }
        return;
      }

      if (!(preview && onBind)) {
        return;
      }
      const clientIdempotencyKey =
        bindIdempotencyKey.current ?? crypto.randomUUID();
      bindIdempotencyKey.current = clientIdempotencyKey;
      const input =
        mode === "new"
          ? {
              attachmentId,
              clientIdempotencyKey,
              description: value.description.trim() || null,
              location: nextLocation,
              mode,
              previewId: preview.previewId,
              projectId: value.projectId.trim(),
              title: value.title,
              type: "Task" as const,
              versionId,
            }
          : {
              attachmentId,
              baseRevision:
                preview.target.mode === "existing"
                  ? preview.target.work.revision
                  : 0,
              clientIdempotencyKey,
              location: nextLocation,
              mode,
              previewId: preview.previewId,
              versionId,
              workId: value.workId,
            };
      try {
        await onBind(input);
        setPreview(null);
        bindIdempotencyKey.current = null;
        onClose();
      } catch {
        setError(FILE_ATTACHMENT_UI_LABELS.locationBindFailed);
      }
    },
  });

  useEffect(() => {
    const values = locationBinderValues(location, projectId);
    form.setFieldValue("height", values.height);
    form.setFieldValue("page", values.page);
    form.setFieldValue("projectId", values.projectId);
    form.setFieldValue("width", values.width);
    form.setFieldValue("x", values.x);
    form.setFieldValue("y", values.y);
    setPreview(null);
    bindIdempotencyKey.current = null;
  }, [form, location, projectId]);

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      form.handleSubmit().catch(() => undefined);
    },
    [form],
  );

  const handleLocationKind = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextKind = event.currentTarget.dataset.locationKind;
      if (nextKind === "point" || nextKind === "region") {
        setPreview(null);
        bindIdempotencyKey.current = null;
        onLocationKindChange(nextKind);
      }
    },
    [onLocationKindChange],
  );
  const handleMode = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextMode = event.currentTarget.dataset.mode;
      if (nextMode === "new" || nextMode === "existing") {
        setPreview(null);
        bindIdempotencyKey.current = null;
        setMode(nextMode);
      }
    },
    [],
  );
  return (
    <form
      className="space-y-3 rounded-md border bg-muted/10 p-3"
      data-location-binder
      onSubmit={handleFormSubmit}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          aria-pressed={locationKind === "point"}
          data-location-kind="point"
          onClick={handleLocationKind}
          size="xs"
          type="button"
          variant={locationKind === "point" ? "secondary" : "outline"}
        >
          {FILE_ATTACHMENT_UI_LABELS.point}
        </Button>
        <Button
          aria-pressed={locationKind === "region"}
          data-location-kind="region"
          onClick={handleLocationKind}
          size="xs"
          type="button"
          variant={locationKind === "region" ? "secondary" : "outline"}
        >
          {FILE_ATTACHMENT_UI_LABELS.region}
        </Button>
        <Button
          aria-pressed={mode === "new"}
          data-mode="new"
          onClick={handleMode}
          size="xs"
          type="button"
          variant={mode === "new" ? "secondary" : "outline"}
        >
          {FILE_ATTACHMENT_UI_LABELS.newWork}
        </Button>
        <Button
          aria-pressed={mode === "existing"}
          data-mode="existing"
          onClick={handleMode}
          size="xs"
          type="button"
          variant={mode === "existing" ? "secondary" : "outline"}
        >
          {FILE_ATTACHMENT_UI_LABELS.existingWork}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {FILE_ATTACHMENT_UI_LABELS.locationSelectionInstruction}
      </p>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        {pageCount ? (
          <label className="grid gap-1" htmlFor="file-attachment-location-page">
            <span>{FILE_ATTACHMENT_UI_LABELS.page}</span>
            <form.Field name="page">
              {(field) => (
                <Input
                  id="file-attachment-location-page"
                  max={pageCount}
                  min={1}
                  name={field.name}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1;
                    field.handleChange(value);
                    onLocationChange(
                      locationFromBinderValues(
                        { ...form.state.values, page: value },
                        locationKind,
                        pageCount,
                      ),
                    );
                    setPreview(null);
                  }}
                  type="number"
                  value={field.state.value}
                />
              )}
            </form.Field>
          </label>
        ) : null}
        <form.Field name="x">
          {(field) => (
            <label className="grid gap-1" htmlFor="file-attachment-location-x">
              <span>{FILE_ATTACHMENT_UI_LABELS.xCoordinate}</span>
              <Input
                id="file-attachment-location-x"
                name={field.name}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  field.handleChange(value);
                  onLocationChange(
                    locationFromBinderValues(
                      { ...form.state.values, x: value },
                      locationKind,
                      pageCount,
                    ),
                  );
                  setPreview(null);
                }}
                type="number"
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="y">
          {(field) => (
            <label className="grid gap-1" htmlFor="file-attachment-location-y">
              <span>{FILE_ATTACHMENT_UI_LABELS.yCoordinate}</span>
              <Input
                id="file-attachment-location-y"
                name={field.name}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  field.handleChange(value);
                  onLocationChange(
                    locationFromBinderValues(
                      { ...form.state.values, y: value },
                      locationKind,
                      pageCount,
                    ),
                  );
                  setPreview(null);
                }}
                type="number"
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        {locationKind === "region" ? (
          <>
            <form.Field name="width">
              {(field) => (
                <label
                  className="grid gap-1"
                  htmlFor="file-attachment-location-width"
                >
                  <span>{FILE_ATTACHMENT_UI_LABELS.width}</span>
                  <Input
                    id="file-attachment-location-width"
                    name={field.name}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 0;
                      field.handleChange(value);
                      onLocationChange(
                        locationFromBinderValues(
                          { ...form.state.values, width: value },
                          locationKind,
                          pageCount,
                        ),
                      );
                      setPreview(null);
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="height">
              {(field) => (
                <label
                  className="grid gap-1"
                  htmlFor="file-attachment-location-height"
                >
                  <span>{FILE_ATTACHMENT_UI_LABELS.height}</span>
                  <Input
                    id="file-attachment-location-height"
                    name={field.name}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 0;
                      field.handleChange(value);
                      onLocationChange(
                        locationFromBinderValues(
                          { ...form.state.values, height: value },
                          locationKind,
                          pageCount,
                        ),
                      );
                      setPreview(null);
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
          </>
        ) : null}
      </div>
      {mode === "existing" ? (
        <form.Field name="workId">
          {(field) => (
            <label
              className="grid gap-1 text-xs"
              htmlFor="file-attachment-location-work-id"
            >
              <span>{FILE_ATTACHMENT_UI_LABELS.workId}</span>
              <Input
                id="file-attachment-location-work-id"
                name={field.name}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setPreview(null);
                }}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
      ) : (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {projectId ? null : (
            <form.Field name="projectId">
              {(field) => (
                <label
                  className="grid gap-1 sm:col-span-2"
                  htmlFor="file-attachment-location-project-id"
                >
                  <span>{FILE_ATTACHMENT_UI_LABELS.projectId}</span>
                  <Input
                    id="file-attachment-location-project-id"
                    name={field.name}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setPreview(null);
                    }}
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
          )}
          <form.Field name="title">
            {(field) => (
              <label
                className="grid gap-1"
                htmlFor="file-attachment-location-title"
              >
                <span>{FILE_ATTACHMENT_UI_LABELS.title}</span>
                <Input
                  id="file-attachment-location-title"
                  name={field.name}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setPreview(null);
                  }}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <label
                className="grid gap-1 sm:col-span-2"
                htmlFor="file-attachment-location-description"
              >
                <span>{FILE_ATTACHMENT_UI_LABELS.description}</span>
                <Textarea
                  className="min-h-16"
                  id="file-attachment-location-description"
                  name={field.name}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setPreview(null);
                  }}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
        </div>
      )}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="text-muted-foreground text-xs" role="status">
          <p>{FILE_ATTACHMENT_UI_LABELS.reviewLocationBind}</p>
          <p className="mt-1 font-medium text-foreground">
            {preview.target.mode === "existing"
              ? `${preview.target.work.key} · ${preview.target.work.title}`
              : `${preview.target.title} · ${preview.target.type} · ${preview.target.projectId}`}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            submitAction.current = "preview";
          }}
          size="xs"
          type="submit"
          variant="outline"
        >
          {FILE_ATTACHMENT_UI_LABELS.preview}
        </Button>
        <Button
          disabled={!(preview && onBind)}
          onClick={() => {
            submitAction.current = "bind";
          }}
          size="xs"
          type="submit"
        >
          {FILE_ATTACHMENT_UI_LABELS.confirm}
        </Button>
        <Button onClick={onClose} size="xs" type="button" variant="ghost">
          {FILE_ATTACHMENT_UI_LABELS.cancel}
        </Button>
      </div>
    </form>
  );
}

export { MarkupSurface };
