// biome-ignore-all lint/performance/noJsxPropsBind: Form fields and action buttons close over the current TanStack Form field handlers and binder state.
import type {
  FileAttachmentLocation,
  FileAttachmentLocationBindInput,
  FileAttachmentLocationBindPreview,
  FileAttachmentLocationBindPreviewInput,
} from "@cantiara/api/file-attachments";
import {
  FILE_ATTACHMENT_UI_LABELS,
  fileAttachmentLocationBindInputSchema,
  fileAttachmentLocationBindPreviewInputSchema,
} from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useCallback, useEffect, useRef, useState } from "react";
import { clampCoordinate } from "../../lib/file-attachment-markup-geometry";

export type LocationKind = "point" | "region";

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

export default function FileAttachmentLocationBinder({
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
        const previewInput =
          fileAttachmentLocationBindPreviewInputSchema.safeParse(
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
                },
          );
        if (!previewInput.success) {
          setError(
            previewInput.error.issues.some(
              ({ path }) => path[0] === "projectId",
            )
              ? FILE_ATTACHMENT_UI_LABELS.newWorkProjectRequired
              : FILE_ATTACHMENT_UI_LABELS.locationPreviewUnavailable,
          );
          return;
        }
        try {
          setPreview(await onPreview(previewInput.data));
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
      const bindInput = fileAttachmentLocationBindInputSchema.safeParse(
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
            },
      );
      if (!bindInput.success) {
        setError(FILE_ATTACHMENT_UI_LABELS.locationBindFailed);
        return;
      }
      try {
        await onBind(bindInput.data);
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
