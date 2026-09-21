import type {
  FileAttachment,
  FileAttachmentPreview as FileAttachmentPreviewData,
} from "@cantiara/api/file-attachments";
import { FILE_ATTACHMENT_UI_LABELS } from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import {
  MediaPlayer,
  type MediaPlayerInstance,
  MediaProvider,
} from "@vidstack/react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
  downloadFileAttachmentAsset,
  fetchFileAttachmentAsset,
} from "../../lib/file-attachment-assets";

type AssetStatus = "idle" | "loading" | "ready" | "error";
export interface FileAttachmentPreviewViewProps {
  assetStatus?: AssetStatus;
  assetURL?: string;
  attachment: FileAttachment;
  onDownload?: () => void | Promise<void>;
  onRetry?: () => void;
  preview: FileAttachmentPreviewData;
}

export function FileAttachmentPreviewView({
  assetStatus = "idle",
  assetURL,
  attachment,
  onDownload,
  onRetry,
  preview,
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
            className="mt-1 truncate font-semibold text-base"
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
        <p className="text-muted-foreground text-sm" role="status">
          Preview is processing. This view will update automatically.
        </p>
      ) : null}

      {preview.status === "unavailable" ? (
        <UnavailablePreview
          failureMessage={preview.failure?.message}
          onRetry={onRetry}
        />
      ) : null}

      {preview.status === "download-only" ? (
        <p className="text-muted-foreground text-sm">
          ZIP files are available for download only.
        </p>
      ) : null}

      {preview.status === "available" ? (
        <PreviewContent
          assetStatus={resolvedAssetStatus}
          assetURL={assetURL}
          attachment={attachment}
          onRetry={onRetry}
          preview={preview}
        />
      ) : null}
    </article>
  );
}

function UnavailablePreview({
  failureMessage,
  onRetry,
}: {
  failureMessage?: string;
  onRetry?: () => void;
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
      <p className="text-muted-foreground text-sm">
        {failureMessage ?? "The preview could not be generated."}
      </p>
      {onRetry ? (
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
  onRetry,
  preview,
}: {
  assetStatus: AssetStatus;
  assetURL?: string;
  attachment: FileAttachment;
  onRetry?: () => void;
  preview: FileAttachmentPreviewData;
}) {
  switch (preview.kind) {
    case "image":
      return assetURL ? (
        <img
          alt={attachment.name}
          className="max-h-[min(70vh,42rem)] w-full rounded-md bg-muted/30 object-contain"
          height={720}
          src={assetURL}
          width={1280}
        />
      ) : (
        <AssetStatusMessage onRetry={onRetry} status={assetStatus} />
      );
    case "pdf":
      return assetURL ? (
        <PdfPreview
          assetURL={assetURL}
          onRetry={onRetry}
          pageCount={preview.pageCount ?? 1}
        />
      ) : (
        <AssetStatusMessage onRetry={onRetry} status={assetStatus} />
      );
    case "csv":
      return preview.csv ? <CsvPreview csv={preview.csv} /> : null;
    case "text":
      return preview.text ? (
        <div className="overflow-auto rounded-md border bg-muted/10 p-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs/relaxed">
            {preview.text.content}
          </pre>
          {preview.text.truncated ? (
            <p className="mt-3 border-t pt-3 text-muted-foreground text-xs">
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
    <p className="text-muted-foreground text-sm" role="status">
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
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          Preview is truncated. Download the original for the complete file.
        </p>
      ) : null}
    </div>
  );
}

function MediaPreview({
  kind,
  playback,
  src,
  title,
}: {
  kind: "audio" | "video";
  playback: FileAttachmentPreviewData["playback"];
  src: string;
  title: string;
}) {
  const mediaRef = useRef<MediaPlayerInstance | null>(null);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(playback?.speeds[1] ?? 1);
  const handleSpeedChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSpeed(Number(event.currentTarget.value));
    },
    [],
  );
  const handleLoopChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLoop(event.currentTarget.checked);
    },
    [],
  );
  const handleFullscreen = useCallback(() => {
    mediaRef.current?.enterFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
    }
  }, [speed]);

  return (
    <div className="space-y-3">
      <MediaPlayer
        autoPlay={false}
        className={
          kind === "audio"
            ? "block w-full"
            : "block max-h-[min(70vh,42rem)] w-full rounded-md bg-black"
        }
        controls
        loop={loop}
        playbackRate={speed}
        preload="metadata"
        ref={mediaRef}
        src={src}
        title={title}
        viewType={kind}
      >
        <MediaProvider />
      </MediaPlayer>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <span>{FILE_ATTACHMENT_UI_LABELS.playbackSpeed}</span>
          <select
            aria-label={FILE_ATTACHMENT_UI_LABELS.playbackSpeed}
            className="rounded-md border bg-background px-2 py-1"
            onChange={handleSpeedChange}
            value={speed}
          >
            {(playback?.speeds ?? [1]).map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input checked={loop} onChange={handleLoopChange} type="checkbox" />
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

function PdfPreview({
  assetURL,
  onRetry,
  pageCount,
}: {
  assetURL: string;
  onRetry?: () => void;
  pageCount: number;
}) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    const pageIndex = canvas?.dataset.pageIndex;
    if (pageIndex !== undefined) {
      canvasRefs.current[Number(pageIndex)] = canvas;
    }
  }, []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let documentProxy: PDFDocumentProxy | undefined;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: PDF page rendering keeps loading, cancellation, canvas setup, and cleanup in one effect seam.
    async function renderPages() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ url: assetURL });
        documentProxy = await loadingTask.promise;
        if (cancelled) {
          return;
        }

        const pagesToRender = Math.min(pageCount, documentProxy.numPages);
        for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
          const canvas = canvasRefs.current[pageNumber - 1];
          if (!canvas) {
            continue;
          }
          // biome-ignore lint/performance/noAwaitInLoops: PDF pages render sequentially to preserve canvas order.
          const page = await documentProxy.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.2 });
          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("PDF canvas is unavailable.");
          }
          await page.render({
            canvas,
            canvasContext: context,
            transform:
              outputScale === 1
                ? undefined
                : [outputScale, 0, 0, outputScale, 0, 0],
            viewport,
          }).promise;
        }
        if (!cancelled) {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    renderPages().catch(() => undefined);
    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => undefined);
      documentProxy?.cleanup().catch(() => undefined);
    };
  }, [assetURL, pageCount]);

  return (
    <section aria-label="PDF preview" className="space-y-3">
      {status === "loading" ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading PDF preview…
        </p>
      ) : null}
      {status === "error" ? (
        <div className="space-y-3" role="alert">
          <p className="text-destructive text-sm">
            PDF preview is unavailable. Download the original file instead.
          </p>
          {onRetry ? (
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              {FILE_ATTACHMENT_UI_LABELS.retryPreview}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid justify-items-center gap-4">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (pageNumber) => (
            <canvas
              aria-label={`PDF page ${pageNumber} of ${pageCount}`}
              className="max-w-full rounded-md border bg-white shadow-sm"
              data-page-index={pageNumber - 1}
              key={pageNumber}
              ref={setCanvasRef}
            />
          ),
        )}
      </div>
    </section>
  );
}

function useFileAttachmentAsset(path: string | undefined) {
  const [state, setState] = useState<{
    status: AssetStatus;
    url?: string;
  }>({ status: "idle" });

  useEffect(() => {
    if (!path) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    let objectURL: string | undefined;
    setState({ status: "loading" });
    fetchFileAttachmentAsset(path, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) {
          return;
        }
        objectURL = URL.createObjectURL(blob);
        setState({ status: "ready", url: objectURL });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      });

    return () => {
      controller.abort();
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
    };
  }, [path]);

  return state;
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
  const previewQuery = useQuery({
    ...orpc.previewFileAttachment.queryOptions({
      input: {
        attachmentId: attachment.id,
        versionId: attachment.currentVersion.id,
      },
    }),
    enabled: open,
  });
  const preview = previewQuery.data;
  const assetPath = previewAssetPath(preview);
  const asset = useFileAttachmentAsset(
    preview?.status === "available" ? assetPath : undefined,
  );
  const handlePreviewRetry = useCallback(() => {
    previewQuery.refetch().catch(() => undefined);
  }, [previewQuery.refetch]);
  const handleDownload = useCallback(() => {
    if (!preview) {
      return;
    }
    downloadFileAttachmentAsset(
      preview.downloadPath,
      attachment.currentVersion.fileName,
    ).catch(() => undefined);
  }, [attachment.currentVersion.fileName, preview]);

  useEffect(() => {
    if (!open || preview?.status !== "processing") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      previewQuery.refetch().catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [open, preview?.status, previewQuery.refetch]);

  if (!open) {
    return null;
  }
  if (previewQuery.isPending) {
    return (
      <p className="border-t pt-3 text-muted-foreground text-sm" role="status">
        Loading preview…
      </p>
    );
  }
  if (previewQuery.isError || !preview) {
    return (
      <div className="border-t pt-3" role="alert">
        <p className="text-destructive text-sm">Preview is unavailable.</p>
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
      onDownload={handleDownload}
      onRetry={handlePreviewRetry}
      preview={preview}
    />
  );
}

export function FileAttachmentPreviewCard({
  attachment,
}: {
  attachment: FileAttachment;
}) {
  const [open, setOpen] = useState(false);
  const handleToggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  return (
    <li className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-sm">{attachment.name}</h3>
          <p className="mt-1 text-muted-foreground text-xs">
            {attachment.currentVersion.preview} · Version{" "}
            {attachment.currentVersion.number}
          </p>
        </div>
        <Button
          aria-expanded={open}
          onClick={handleToggle}
          size="sm"
          type="button"
          variant={open ? "secondary" : "outline"}
        >
          {FILE_ATTACHMENT_UI_LABELS.preview}
        </Button>
      </div>
      <FileAttachmentPreviewPanel attachment={attachment} open={open} />
    </li>
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
        <p className="surface-kicker">Documents</p>
        <h2
          className="mt-2 text-balance font-semibold text-2xl tracking-tight sm:text-3xl"
          id="file-attachments-heading"
        >
          File Attachments
        </h2>
        <p className="mt-3 text-muted-foreground text-sm/relaxed">
          Review supported File Attachments inside Cantiara. Originals remain
          behind the protected asset boundary and are downloaded only on
          request.
        </p>
      </header>

      {attachmentsQuery.isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading File Attachments…
        </p>
      ) : null}
      {attachmentsQuery.isError ? (
        <p className="text-destructive text-sm" role="alert">
          File Attachments are unavailable. Try loading this page again.
        </p>
      ) : null}
      {attachmentsQuery.data?.length === 0 ? (
        <p className="border-y py-8 text-muted-foreground text-sm">
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
