// biome-ignore-all lint/performance/noJsxPropsBind: The preview trigger uses Base UI open state for its variant.
import type {
  FileAttachment,
  FileAttachmentLocationBindInput,
  FileAttachmentLocationBindPreview,
  FileAttachmentLocationBindPreviewInput,
  FileAttachmentMarking,
  FileAttachmentMarkingInput,
  FileAttachmentPreview as FileAttachmentPreviewData,
} from "@cantiara/api/file-attachments";
import { FILE_ATTACHMENT_UI_LABELS } from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  createPlayer,
  orientationLockFeature,
} from "@videojs/react";
import { Audio } from "@videojs/react/audio";
import { Video, videoFeatures } from "@videojs/react/video";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { client, orpc } from "@/utils/orpc";
import { useBindFileAttachmentLocation } from "../../hooks/use-bind-file-attachment-location";
import {
  downloadFileAttachmentAsset,
  fetchFileAttachmentAsset,
} from "../../lib/file-attachment-assets";
import type { LocationBindStatus } from "../forms/file-attachment-location-form";
import { FileAttachmentUploadControl } from "../forms/file-attachment-upload-form";
import {
  FileAttachmentMarkup,
  type MarkingFeedback,
} from "./file-attachment-markup";
import type { FileAttachmentPdfPreviewProps } from "./file-attachment-pdf";

type AssetStatus = "idle" | "loading" | "ready" | "error";
export interface FileAttachmentPreviewViewProps {
  assetStatus?: AssetStatus;
  assetURL?: string;
  attachment: FileAttachment;
  bindStatus?: LocationBindStatus;
  markingFeedback?: MarkingFeedback;
  markings?: readonly FileAttachmentMarking[];
  onBindLocation?: (
    input: FileAttachmentLocationBindInput,
  ) => void | Promise<void>;
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onDownload?: () => void | Promise<void>;
  onPreviewLocation?: (
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  onRetry?: () => void;
  onUndoMarking?: (marking: FileAttachmentMarking) => void | Promise<void>;
  preview: FileAttachmentPreviewData;
  projectId?: string;
}

export function FileAttachmentPreviewView({
  assetStatus = "idle",
  assetURL,
  attachment,
  bindStatus,
  markings,
  markingFeedback,
  onBindLocation,
  onCreateMarking,
  onDownload,
  onPreviewLocation,
  onRetry,
  preview,
  projectId,
  onUndoMarking,
}: FileAttachmentPreviewViewProps) {
  const resolvedAssetStatus = assetURL ? "ready" : assetStatus;
  const handleDownload = useCallback(() => {
    Promise.resolve(onDownload?.()).catch(() => undefined);
  }, [onDownload]);

  return (
    <article
      aria-labelledby={`file-attachment-preview-${attachment.id}`}
      className="space-y-4 rounded-lg border border-primary/25 bg-card p-4 shadow-sm"
      data-file-attachment-preview={preview.kind}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <p className="surface-kicker">{FILE_ATTACHMENT_UI_LABELS.preview}</p>
          <h3
            className="mt-1 truncate text-base font-semibold"
            id={`file-attachment-preview-${attachment.id}`}
          >
            {attachment.name}
          </h3>
        </div>
        {onDownload ? (
          <Button
            onClick={handleDownload}
            size="sm"
            type="button"
            variant="outline"
          >
            {FILE_ATTACHMENT_UI_LABELS.download}
          </Button>
        ) : null}
      </header>

      {preview.status === "processing" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Preview is processing. This view will update automatically.
        </p>
      ) : null}

      {preview.status === "unavailable" ? (
        <UnavailablePreview
          failureMessage={preview.failure?.message}
          onRetry={onRetry}
          retryable={preview.failure?.retryable !== false}
        />
      ) : null}

      {preview.status === "download-only" ? (
        <p className="text-sm text-muted-foreground">
          ZIP files are available for download only.
        </p>
      ) : null}

      {preview.status === "available" ? (
        <PreviewContent
          assetStatus={resolvedAssetStatus}
          assetURL={assetURL}
          attachment={attachment}
          bindStatus={bindStatus}
          markingFeedback={markingFeedback}
          markings={markings}
          onBindLocation={onBindLocation}
          onCreateMarking={onCreateMarking}
          onPreviewLocation={onPreviewLocation}
          onRetry={onRetry}
          onUndoMarking={onUndoMarking}
          preview={preview}
          projectId={projectId}
        />
      ) : null}
    </article>
  );
}

function UnavailablePreview({
  failureMessage,
  onRetry,
  retryable = true,
}: {
  failureMessage?: string;
  onRetry?: () => void;
  retryable?: boolean;
}) {
  return (
    <div
      aria-label={FILE_ATTACHMENT_UI_LABELS.unavailable}
      className="space-y-3 border border-destructive/30 bg-destructive/5 px-4 py-3"
      role="alert"
    >
      <p className="font-medium text-destructive">
        {FILE_ATTACHMENT_UI_LABELS.unavailable}
      </p>
      <p className="text-sm text-muted-foreground">
        {failureMessage ?? "The preview could not be generated."}
      </p>
      {onRetry && retryable ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {FILE_ATTACHMENT_UI_LABELS.retryPreview}
        </Button>
      ) : null}
    </div>
  );
}

function PreviewContent({
  assetStatus,
  assetURL,
  attachment,
  bindStatus,
  markings,
  markingFeedback,
  onBindLocation,
  onCreateMarking,
  onRetry,
  onPreviewLocation,
  preview,
  projectId,
  onUndoMarking,
}: {
  assetStatus: AssetStatus;
  assetURL?: string;
  attachment: FileAttachment;
  bindStatus?: LocationBindStatus;
  markings?: readonly FileAttachmentMarking[];
  markingFeedback?: MarkingFeedback;
  onBindLocation?: (
    input: FileAttachmentLocationBindInput,
  ) => void | Promise<void>;
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onRetry?: () => void;
  onPreviewLocation?: (
    input: FileAttachmentLocationBindPreviewInput,
  ) => Promise<FileAttachmentLocationBindPreview>;
  preview: FileAttachmentPreviewData;
  projectId?: string;
  onUndoMarking?: (marking: FileAttachmentMarking) => void | Promise<void>;
}) {
  switch (preview.kind) {
    case "image":
      return assetURL ? (
        <FileAttachmentMarkup
          alt={attachment.name}
          assetURL={assetURL}
          attachmentId={attachment.id}
          bindStatus={bindStatus}
          kind="image"
          markingFeedback={markingFeedback}
          markings={markings}
          onBindLocation={onBindLocation}
          onCreateMarking={onCreateMarking}
          onPreviewLocation={onPreviewLocation}
          onUndoMarking={onUndoMarking}
          projectId={projectId}
          versionId={attachment.currentVersion.id}
        />
      ) : (
        <AssetStatusMessage onRetry={onRetry} status={assetStatus} />
      );
    case "pdf":
      return assetURL ? (
        <FileAttachmentMarkup
          assetURL={assetURL}
          attachmentId={attachment.id}
          bindStatus={bindStatus}
          kind="pdf"
          markingFeedback={markingFeedback}
          markings={markings}
          onBindLocation={onBindLocation}
          onCreateMarking={onCreateMarking}
          onPreviewLocation={onPreviewLocation}
          onUndoMarking={onUndoMarking}
          pageCount={preview.pageCount ?? 1}
          projectId={projectId}
          versionId={attachment.currentVersion.id}
        >
          {(tool, locationProps) => (
            <PdfPreview
              assetURL={assetURL}
              attachmentId={attachment.id}
              markings={markings}
              onRetry={onRetry}
              pageCount={preview.pageCount ?? 1}
              tool={tool}
              versionId={attachment.currentVersion.id}
              {...locationProps}
            />
          )}
        </FileAttachmentMarkup>
      ) : (
        <AssetStatusMessage onRetry={onRetry} status={assetStatus} />
      );
    case "csv":
      return preview.csv ? <CsvPreview csv={preview.csv} /> : null;
    case "text":
      return preview.text ? (
        <div className="overflow-auto rounded-md border bg-muted/10 p-3">
          <pre className="font-mono text-xs/relaxed break-words whitespace-pre-wrap">
            {preview.text.content}
          </pre>
          {preview.text.truncated ? (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              Preview is truncated. Download the original for the complete file.
            </p>
          ) : null}
        </div>
      ) : null;
    case "audio":
    case "video":
      return assetURL ? (
        <MediaPreview
          kind={preview.kind}
          playback={preview.playback}
          src={assetURL}
          title={attachment.name}
        />
      ) : (
        <AssetStatusMessage onRetry={onRetry} status={assetStatus} />
      );
    case "download":
      return null;
    default:
      return null;
  }
}

function AssetStatusMessage({
  onRetry,
  status,
}: {
  onRetry?: () => void;
  status: AssetStatus;
}) {
  if (status === "error") {
    return <UnavailablePreview onRetry={onRetry} />;
  }
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Loading preview…
    </p>
  );
}

function CsvPreview({
  csv,
}: {
  csv: NonNullable<FileAttachmentPreviewData["csv"]>;
}) {
  return (
    <div className="overflow-auto rounded-md border">
      <table className="min-w-full border-collapse text-left text-xs">
        <caption className="sr-only">CSV preview</caption>
        <thead className="bg-muted/45">
          <tr>
            {csv.headers.map((header, index) => (
              <th
                className="border-b px-3 py-2 font-medium"
                // biome-ignore lint/suspicious/noArrayIndexKey: CSV columns are fixed preview positions.
                key={`${header}-${index}`}
                scope="col"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {csv.rows.map((row, rowIndex) => (
            <tr
              className="border-b last:border-0"
              // biome-ignore lint/suspicious/noArrayIndexKey: CSV rows are fixed preview positions.
              key={rowIndex}
            >
              {row.map((cell, cellIndex) => (
                <td
                  className="px-3 py-2 align-top"
                  // biome-ignore lint/suspicious/noArrayIndexKey: CSV cells are fixed preview positions.
                  key={`${rowIndex}-${cellIndex}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {csv.truncated ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Preview is truncated. Download the original for the complete file.
        </p>
      ) : null}
    </div>
  );
}

const { Player: AttachmentMediaPlayer, usePlayer: useAttachmentMediaPlayer } =
  createPlayer({ features: [...videoFeatures, orientationLockFeature] });

interface MediaPreviewProps {
  kind: "audio" | "video";
  playback: FileAttachmentPreviewData["playback"];
  src: string;
  title: string;
}

function MediaPreview(props: MediaPreviewProps) {
  return (
    <AttachmentMediaPlayer>
      <MediaPreviewContent {...props} />
    </AttachmentMediaPlayer>
  );
}

function MediaPreviewContent({
  kind,
  playback,
  src,
  title,
}: MediaPreviewProps) {
  const player = useAttachmentMediaPlayer();
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const handleMediaRef = useCallback(
    (element: HTMLAudioElement | HTMLVideoElement | null) => {
      mediaRef.current = element;
    },
    [],
  );
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(playback?.speeds[1] ?? 1);
  const handleSpeedChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSpeed(Number(event.currentTarget.value));
    },
    [],
  );
  const loopId = useId();
  const speedId = useId();
  const handleLoopChange = useCallback((checked: boolean) => {
    setLoop(checked);
  }, []);
  const handleFullscreen = useCallback(() => {
    player.requestFullscreen().catch(() => undefined);
  }, [player]);

  const handleMediaLoaded = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.defaultPlaybackRate = speed;
      mediaRef.current.playbackRate = speed;
    }
  }, [speed]);
  useEffect(handleMediaLoaded, [handleMediaLoaded]);

  return (
    <div className="space-y-3">
      <Container>
        {kind === "audio" ? (
          <Audio
            aria-label={title}
            autoPlay={false}
            className="block w-full"
            controls
            fallback={null}
            loop={loop}
            onLoadedMetadata={handleMediaLoaded}
            preload="metadata"
            ref={handleMediaRef}
            src={src}
          />
        ) : (
          <Video
            aria-label={title}
            autoPlay={false}
            className="block max-h-[min(70vh,42rem)] w-full rounded-md bg-black"
            controls
            fallback={null}
            loop={loop}
            onLoadedMetadata={handleMediaLoaded}
            preload="metadata"
            ref={handleMediaRef}
            src={src}
          />
        )}
      </Container>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2" htmlFor={speedId}>
          <span>{FILE_ATTACHMENT_UI_LABELS.playbackSpeed}</span>
          <NativeSelect
            aria-label={FILE_ATTACHMENT_UI_LABELS.playbackSpeed}
            id={speedId}
            onChange={handleSpeedChange}
            value={speed}
          >
            {(playback?.speeds ?? [1]).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}×
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2" htmlFor={loopId}>
          <Checkbox
            checked={loop}
            id={loopId}
            onCheckedChange={handleLoopChange}
          />
          {FILE_ATTACHMENT_UI_LABELS.loop}
        </label>
        {playback?.fullscreen ? (
          <Button
            onClick={handleFullscreen}
            size="xs"
            type="button"
            variant="outline"
          >
            {FILE_ATTACHMENT_UI_LABELS.fullscreen}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const LazyPdfPreview = lazy(() =>
  import("./file-attachment-pdf").then((module) => ({
    default: module.FileAttachmentPdfPreview,
  })),
);

function PdfPreview(props: FileAttachmentPdfPreviewProps) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Loading PDF preview…
        </p>
      }
    >
      <LazyPdfPreview key={`${props.assetURL}:${props.pageCount}`} {...props} />
    </Suspense>
  );
}

function useFileAttachmentAsset(path: string | undefined) {
  const asset = useQuery({
    enabled: path !== undefined,
    gcTime: 0,
    queryFn: ({ signal }) => fetchFileAttachmentAsset(path ?? "", signal),
    queryKey: ["file-attachment-asset", path],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const blob = path ? asset.data : undefined;
  const [objectURL, setObjectURL] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);
  useEffect(() => {
    if (!blob) {
      setObjectURL(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectURL({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const url = objectURL && objectURL.blob === blob ? objectURL.url : undefined;
  let status: AssetStatus = "idle";
  if (path) {
    if (url) {
      status = "ready";
    } else {
      status = asset.isError && !asset.isFetching ? "error" : "loading";
    }
  }
  return { status, url, refetch: asset.refetch };
}

function previewAssetPath(preview: FileAttachmentPreviewData | undefined) {
  if (!preview) {
    return;
  }
  if (preview.kind === "image") {
    return preview.gallery?.mediumPath;
  }
  if (
    preview.kind === "pdf" ||
    preview.kind === "audio" ||
    preview.kind === "video"
  ) {
    return preview.previewPath;
  }
}

export function FileAttachmentPreviewPanel({
  attachment,
  open,
}: {
  attachment: FileAttachment;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const previewQuery = useQuery({
    ...orpc.previewFileAttachment.queryOptions({
      input: {
        attachmentId: attachment.id,
        versionId: attachment.currentVersion.id,
      },
    }),
    enabled: open,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 1000 : false,
  });
  const preview = previewQuery.data;
  const markingsQuery = useQuery({
    ...orpc.fileAttachmentMarkings.queryOptions({
      input: {
        attachmentId: attachment.id,
        versionId: attachment.currentVersion.id,
      },
    }),
    enabled:
      open &&
      preview?.status === "available" &&
      (preview.kind === "image" || preview.kind === "pdf"),
  });
  const assetPath = previewAssetPath(preview);
  const asset = useFileAttachmentAsset(
    open && preview?.status === "available" ? assetPath : undefined,
  );
  const handlePreviewRetry = useCallback(() => {
    if (
      open &&
      !previewQuery.isError &&
      preview?.status === "available" &&
      assetPath
    ) {
      asset.refetch().catch(() => undefined);
      return;
    }
    previewQuery.refetch().catch(() => undefined);
  }, [
    asset.refetch,
    assetPath,
    open,
    preview?.status,
    previewQuery.isError,
    previewQuery.refetch,
  ]);
  const handleDownload = useCallback(() => {
    if (!preview) {
      return;
    }
    downloadFileAttachmentAsset(
      preview.downloadPath,
      attachment.currentVersion.fileName,
    ).catch(() => undefined);
  }, [attachment.currentVersion.fileName, preview]);
  const invalidateMarkings = useCallback(
    (
      _result: unknown,
      {
        attachmentId,
        versionId,
      }: FileAttachmentMarkingInput | FileAttachmentMarking,
    ) =>
      queryClient.invalidateQueries({
        queryKey: orpc.fileAttachmentMarkings.key({
          input: { attachmentId, versionId },
        }),
      }),
    [queryClient],
  );
  const createMarkingMutation = useMutation({
    meta: { onlineWrite: true, retryInSurface: true },
    mutationKey: orpc.createFileAttachmentMarking.mutationKey(),
    mutationFn: async (input: FileAttachmentMarkingInput) => {
      await client.createFileAttachmentMarking(input);
    },
    onSuccess: invalidateMarkings,
  });
  const undoMarkingMutation = useMutation({
    meta: { onlineWrite: true, retryInSurface: true },
    mutationKey: orpc.undoFileAttachmentMarking.mutationKey(),
    mutationFn: async (marking: FileAttachmentMarking) => {
      await client.undoFileAttachmentMarking({
        attachmentId: marking.attachmentId,
        markingId: marking.id,
        versionId: marking.versionId,
      });
    },
    onSuccess: invalidateMarkings,
  });
  const bindLocationMutation = useBindFileAttachmentLocation();
  const handleBindLocation = useCallback(
    async (input: FileAttachmentLocationBindInput) => {
      await bindLocationMutation.mutateAsync(input);
    },
    [bindLocationMutation.mutateAsync],
  );
  const handleCreateMarking = useCallback(
    async (input: FileAttachmentMarkingInput) => {
      undoMarkingMutation.reset();
      await createMarkingMutation.mutateAsync(input);
    },
    [createMarkingMutation.mutateAsync, undoMarkingMutation.reset],
  );
  const handlePreviewLocation = useCallback(
    (input: FileAttachmentLocationBindPreviewInput) =>
      fetchFresh(queryClient, {
        ...orpc.previewFileAttachmentLocationBind.queryOptions({ input }),
        gcTime: 0,
      }),
    [queryClient],
  );
  const handleUndoMarking = useCallback(
    async (marking: FileAttachmentMarking) => {
      createMarkingMutation.reset();
      await undoMarkingMutation.mutateAsync(marking);
    },
    [createMarkingMutation.reset, undoMarkingMutation.mutateAsync],
  );

  const belongsToPreview = (marking: {
    attachmentId: string;
    versionId: string;
  }) =>
    marking.attachmentId === attachment.id &&
    marking.versionId === attachment.currentVersion.id;
  const failedCreate =
    createMarkingMutation.isError && createMarkingMutation.variables;
  const failedUndo =
    undoMarkingMutation.isError && undoMarkingMutation.variables;
  const pending = [createMarkingMutation, undoMarkingMutation].some(
    (mutation) =>
      mutation.isPending &&
      mutation.variables &&
      belongsToPreview(mutation.variables),
  );
  const markingFeedback: MarkingFeedback = { pending };
  if (failedCreate && belongsToPreview(failedCreate)) {
    markingFeedback.error = FILE_ATTACHMENT_UI_LABELS.markingSaveFailed;
    markingFeedback.retry = () => createMarkingMutation.mutate(failedCreate);
  }
  if (failedUndo && belongsToPreview(failedUndo)) {
    markingFeedback.error = FILE_ATTACHMENT_UI_LABELS.markingUndoFailed;
    markingFeedback.retry = () => undoMarkingMutation.mutate(failedUndo);
  }

  if (!open) {
    return null;
  }
  if (previewQuery.status === "pending") {
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground" role="status">
        Loading preview…
      </p>
    );
  }
  if (previewQuery.isError || !preview) {
    return (
      <div className="border-t pt-3" role="alert">
        <p className="text-sm text-destructive">Preview is unavailable.</p>
        <Button
          className="mt-3"
          onClick={handlePreviewRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {FILE_ATTACHMENT_UI_LABELS.retryPreview}
        </Button>
      </div>
    );
  }

  return (
    <FileAttachmentPreviewView
      assetStatus={asset.status}
      assetURL={asset.url}
      attachment={attachment}
      bindStatus={bindLocationMutation}
      markingFeedback={markingFeedback}
      markings={markingsQuery.data}
      onBindLocation={handleBindLocation}
      onCreateMarking={handleCreateMarking}
      onDownload={handleDownload}
      onPreviewLocation={handlePreviewLocation}
      onRetry={handlePreviewRetry}
      onUndoMarking={handleUndoMarking}
      preview={preview}
      projectId={
        attachment.scope.kind === "project"
          ? attachment.scope.projectId
          : undefined
      }
    />
  );
}

export function FileAttachmentPreviewCard({
  attachment,
}: {
  attachment: FileAttachment;
}) {
  return (
    <Collapsible render={<li className="space-y-3 p-4 sm:p-5" />}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{attachment.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {attachment.currentVersion.preview} · Version{" "}
            {attachment.currentVersion.number}
          </p>
        </div>
        <CollapsibleTrigger
          render={(props, { open }) => (
            <Button
              {...props}
              size="sm"
              variant={open ? "secondary" : "outline"}
            >
              {FILE_ATTACHMENT_UI_LABELS.preview}
            </Button>
          )}
        />
      </div>
      <CollapsibleContent>
        <FileAttachmentPreviewPanel attachment={attachment} open />
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FileAttachmentsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const attachmentsQuery = useQuery(
    orpc.fileAttachments.queryOptions({
      input: { scope: { kind: "project", projectId } },
    }),
  );

  return (
    <section
      aria-labelledby="file-attachments-heading"
      className="space-y-8"
      id="documents"
    >
      <header className="surface-header max-w-3xl">
        <p className="surface-kicker">
          {FILE_ATTACHMENT_UI_LABELS.fileAttachment}
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          id="file-attachments-heading"
        >
          File Attachments
        </h2>
        <p className="mt-3 text-sm/relaxed text-muted-foreground">
          Review supported File Attachments inside Cantiara. Originals remain
          behind the protected asset boundary and are downloaded only on
          request.
        </p>
      </header>

      <FileAttachmentUploadControl projectId={projectId} />

      {attachmentsQuery.status === "pending" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading File Attachments…
        </p>
      ) : null}
      {attachmentsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">
          File Attachments are unavailable. Try loading this page again.
        </p>
      ) : null}
      {attachmentsQuery.data?.length === 0 ? (
        <p className="border-y py-8 text-sm text-muted-foreground">
          No File Attachments are available in this Project yet.
        </p>
      ) : null}
      {attachmentsQuery.data && attachmentsQuery.data.length > 0 ? (
        <ul
          aria-label="Project File Attachments"
          className="divide-y rounded-lg border border-border/70 bg-card/50"
        >
          {attachmentsQuery.data.map((attachment) => (
            <FileAttachmentPreviewCard
              attachment={attachment}
              key={attachment.id}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
