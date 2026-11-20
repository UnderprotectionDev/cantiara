// biome-ignore-all lint/performance/noJsxPropsBind: Form fields and action buttons close over the current TanStack Form field handlers and binder state.
import type {
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
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import {
  type LocationKind,
  locationFromFields,
  type useLocationFieldsForm,
} from "../../hooks/use-location-fields-form";

export type { LocationKind } from "../../hooks/use-location-fields-form";

export interface LocationBindStatus {
  isError: boolean;
  isPending: boolean;
  reset: () => void;
}

export default function FileAttachmentLocationBinder({
  attachmentId,
  bindStatus,
  geometry,
  onBind,
  onClose,
  onLocationKindChange,
  onPreview,
  pageCount,
  projectId,
  versionId,
}: {
  attachmentId: string;
  bindStatus?: LocationBindStatus;
  geometry: ReturnType<typeof useLocationFieldsForm>;
  onBind?: (input: FileAttachmentLocationBindInput) => void | Promise<void>;
  onClose: () => void;
  onLocationKindChange: (kind: LocationKind) => void;
  onPreview?: (
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  pageCount?: number;
  projectId?: string;
  versionId: string;
}) {
  const inspect = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: (input: FileAttachmentLocationBindPreviewInput) =>
      onPreview?.(input) ??
      Promise.reject(
        new Error(FILE_ATTACHMENT_UI_LABELS.locationPreviewUnavailable),
      ),
  });
  const { data: preview } = inspect;
  const resetBind = bindStatus?.reset;
  const resetPreview = useCallback(() => {
    inspect.reset();
    resetBind?.();
  }, [inspect.reset, resetBind]);
  const pending = inspect.isPending || bindStatus?.isPending;
  const bindIdempotencyKey = useRef<string | null>(null);

  const form = useForm({
    defaultValues: {
      description: "",
      projectId: projectId ?? "",
      title: String(FILE_ATTACHMENT_UI_LABELS.markedSourceLocation),
      workId: "",
      mode: "existing" as "existing" | "new",
    },
    onSubmitMeta: { action: "preview" } as { action: "bind" | "preview" },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Preview and confirm share one validated form submission boundary while targeting two distinct File Attachment operations.
    onSubmit: async ({ value, meta }) => {
      const { mode } = value;
      const nextLocation = locationFromFields(geometry.state.values, pageCount);

      if (meta.action === "preview") {
        resetBind?.();
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
          setError(null);
          await inspect.mutateAsync(previewInput.data);
        } catch {
          // The preview observer exposes this failure.
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
        resetPreview();
        bindIdempotencyKey.current = null;
        onClose();
      } catch {
        // Query reports the failure and keeps this plan available for retry.
      }
    },
  });

  const mode = useSelector(form.store, (state) => state.values.mode);
  const locationKind = useSelector(
    geometry.store,
    (state) => state.values.kind,
  );
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const previewError = inspect.isError
    ? FILE_ATTACHMENT_UI_LABELS.locationPreviewUnavailable
    : null;
  const bindError = bindStatus?.isError
    ? FILE_ATTACHMENT_UI_LABELS.locationBindFailed
    : null;
  const error = validationError ?? previewError ?? bindError;
  function setError(message: string | null) {
    form.setErrorMap({
      onSubmit: message ? { form: message, fields: {} } : undefined,
    });
  }

  const invalidateLocationPreview = useEffectEvent(() => {
    resetPreview();
    bindIdempotencyKey.current = null;
  });

  useEffect(() => {
    invalidateLocationPreview();
    let previousValues = geometry.state.values;
    const subscription = geometry.store.subscribe(() => {
      const { values } = geometry.state;
      if (values !== previousValues) {
        previousValues = values;
        invalidateLocationPreview();
      }
    });
    return () => subscription.unsubscribe();
  }, [geometry]);

  const handleFormSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      submitForm(form).catch(() => undefined);
    },
    [form],
  );

  const handleLocationKind = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextKind = event.currentTarget.dataset.locationKind;
      if (nextKind === "point" || nextKind === "region") {
        onLocationKindChange(nextKind);
      }
    },
    [onLocationKindChange],
  );
  const handleMode = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextMode = event.currentTarget.dataset.mode;
      if (nextMode === "new" || nextMode === "existing") {
        resetPreview();
        bindIdempotencyKey.current = null;
        form.setFieldValue("mode", nextMode);
      }
    },
    [form, resetPreview],
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
      <p className="text-xs text-muted-foreground">
        {FILE_ATTACHMENT_UI_LABELS.locationSelectionInstruction}
      </p>
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        {pageCount ? (
          <label className="grid gap-1" htmlFor="file-attachment-location-page">
            <span>{FILE_ATTACHMENT_UI_LABELS.page}</span>
            <geometry.Field name="page">
              {(field) => (
                <Input
                  id="file-attachment-location-page"
                  max={pageCount}
                  min={1}
                  name={field.name}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1;
                    field.handleChange(value);
                  }}
                  type="number"
                  value={field.state.value}
                />
              )}
            </geometry.Field>
          </label>
        ) : null}
        <geometry.Field name="x">
          {(field) => (
            <label className="grid gap-1" htmlFor="file-attachment-location-x">
              <span>{FILE_ATTACHMENT_UI_LABELS.xCoordinate}</span>
              <Input
                id="file-attachment-location-x"
                name={field.name}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  field.handleChange(value);
                }}
                type="number"
                value={field.state.value}
              />
            </label>
          )}
        </geometry.Field>
        <geometry.Field name="y">
          {(field) => (
            <label className="grid gap-1" htmlFor="file-attachment-location-y">
              <span>{FILE_ATTACHMENT_UI_LABELS.yCoordinate}</span>
              <Input
                id="file-attachment-location-y"
                name={field.name}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  field.handleChange(value);
                }}
                type="number"
                value={field.state.value}
              />
            </label>
          )}
        </geometry.Field>
        {locationKind === "region" ? (
          <>
            <geometry.Field name="width">
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
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </label>
              )}
            </geometry.Field>
            <geometry.Field name="height">
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
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </label>
              )}
            </geometry.Field>
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
                  resetPreview();
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
                      resetPreview();
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
                    resetPreview();
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
                    resetPreview();
                  }}
                  value={field.state.value}
                />
              </label>
            )}
          </form.Field>
        </div>
      )}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="text-xs text-muted-foreground" role="status">
          <p>{FILE_ATTACHMENT_UI_LABELS.reviewLocationBind}</p>
          <p className="mt-1 font-medium text-foreground">
            {preview.target.mode === "existing"
              ? `${preview.target.work.key} · ${preview.target.work.title}`
              : `${preview.target.title} · ${preview.target.type} · ${preview.target.projectId}`}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={pending} size="xs" type="submit" variant="outline">
          {FILE_ATTACHMENT_UI_LABELS.preview}
        </Button>
        <Button
          disabled={pending || !(preview && onBind)}
          onClick={() =>
            submitForm(form, { action: "bind" }).catch(() => undefined)
          }
          size="xs"
          type="button"
        >
          {FILE_ATTACHMENT_UI_LABELS.confirm}
        </Button>
        <Button
          disabled={bindStatus?.isPending}
          onClick={onClose}
          size="xs"
          type="button"
          variant="ghost"
        >
          {FILE_ATTACHMENT_UI_LABELS.cancel}
        </Button>
      </div>
    </form>
  );
}
