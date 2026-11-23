import type {
  FileAttachmentLocation,
  FileAttachmentMarking,
  FileAttachmentMarkingInput,
} from "@cantiara/api/file-attachments";
import { FILE_ATTACHMENT_UI_LABELS } from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useCallback, useLayoutEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { MarkupSurface } from "./file-attachment-markup";

// React-PDF drives the single pinned `pdfjs-dist` engine, so the worker comes
// from that same package version.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const PDF_PAGE_SCALE = 1.2;

export interface FileAttachmentPdfPreviewProps {
  assetURL: string;
  attachmentId: string;
  disabled?: boolean;
  location: FileAttachmentLocation | null;
  locationKind: "point" | "region";
  markings?: readonly FileAttachmentMarking[];
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  onSelectLocation: (location: FileAttachmentLocation) => void;
  pageCount: number;
  selectingLocation: boolean;
  tool: "pen" | "highlighter" | "arrow" | "rectangle";
  versionId: string;
}

export function FileAttachmentPdfPreview(props: FileAttachmentPdfPreviewProps) {
  return (
    <PdfPreviewSession
      key={JSON.stringify([
        props.attachmentId,
        props.assetURL,
        props.versionId,
        props.pageCount,
      ])}
      {...props}
    />
  );
}

interface PdfPreviewState {
  failed: boolean;
  generation: number;
  numPages: number | null;
  renderedPages: ReadonlySet<number>;
  retrying: boolean;
}

const initialSession: PdfPreviewState = {
  generation: 0,
  numPages: null,
  renderedPages: new Set(),
  failed: false,
  retrying: false,
};

function PdfPreviewSession({
  attachmentId,
  assetURL,
  location,
  locationKind,
  markings,
  onCreateMarking,
  disabled,
  onRetry,
  onSelectLocation,
  pageCount,
  selectingLocation,
  tool,
  versionId,
}: FileAttachmentPdfPreviewProps) {
  const session = useCreateStore(initialSession);
  const { generation, numPages, renderedPages, failed, retrying } =
    useSelector(session);
  const active = useRef<boolean>(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const updateCurrentGeneration = useCallback(
    (updater: (current: PdfPreviewState) => PdfPreviewState) => {
      if (active.current) {
        session.setState((current) =>
          current.generation === generation ? updater(current) : current,
        );
      }
    },
    [generation, session],
  );
  const handleLoadSuccess = useCallback(
    ({ numPages: loaded }: { numPages: number }) =>
      updateCurrentGeneration((current) => ({ ...current, numPages: loaded })),
    [updateCurrentGeneration],
  );
  const handleFailure = useCallback(
    () =>
      updateCurrentGeneration((current) =>
        current.failed ? current : { ...current, failed: true },
      ),
    [updateCurrentGeneration],
  );
  const handleRenderSuccess = useCallback(
    ({ pageNumber }: { pageNumber: number }) =>
      updateCurrentGeneration((current) => {
        if (current.renderedPages.has(pageNumber)) {
          return current;
        }
        return {
          ...current,
          renderedPages: new Set([...current.renderedPages, pageNumber]),
        };
      }),
    [updateCurrentGeneration],
  );
  const handleRetry = useCallback(() => {
    session.setState((current) => ({
      ...initialSession,
      generation: current.generation + 1,
      retrying: true,
    }));

    const finishRetry = () => {
      if (active.current) {
        session.setState((current) => ({ ...current, retrying: false }));
      }
    };
    const refetch = onRetry?.();
    if (refetch) {
      refetch.then(finishRetry, finishRetry);
    } else {
      finishRetry();
    }
  }, [onRetry, session]);

  const pages = Array.from(
    { length: Math.min(pageCount, numPages ?? 0) },
    (_, index) => index + 1,
  );
  const loading =
    !failed &&
    (numPages === null || pages.some((page) => !renderedPages.has(page)));

  return (
    <section aria-label="PDF preview" className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading PDF preview…
        </p>
      ) : null}
      {failed ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-destructive">
            PDF preview is unavailable. Download the original file instead.
          </p>
          {onRetry ? (
            <Button
              onClick={handleRetry}
              size="sm"
              type="button"
              variant="outline"
            >
              {FILE_ATTACHMENT_UI_LABELS.retryPreview}
            </Button>
          ) : null}
        </div>
      ) : null}
      {retrying ? null : (
        <Document
          error={null}
          file={assetURL}
          key={generation}
          loading={null}
          noData={null}
          onLoadError={handleFailure}
          onLoadSuccess={handleLoadSuccess}
          onSourceError={handleFailure}
          suspense={false}
        >
          <div className="grid justify-items-center gap-4">
            {pages.map((pageNumber) => (
              <MarkupSurface
                attachmentId={attachmentId}
                disabled={disabled}
                key={pageNumber}
                location={location}
                locationKind={locationKind}
                markings={markings ?? []}
                onCreateMarking={onCreateMarking}
                onSelectLocation={onSelectLocation}
                page={pageNumber}
                selectingLocation={selectingLocation}
                tool={tool}
                versionId={versionId}
              >
                <div
                  aria-label={`PDF page ${pageNumber} of ${pageCount}`}
                  role="img"
                >
                  <Page
                    className="max-w-full rounded-md border bg-white shadow-sm"
                    error={null}
                    loading={null}
                    noData={null}
                    onLoadError={handleFailure}
                    onRenderError={handleFailure}
                    onRenderSuccess={handleRenderSuccess}
                    pageNumber={pageNumber}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    scale={PDF_PAGE_SCALE}
                  />
                </div>
              </MarkupSurface>
            ))}
          </div>
        </Document>
      )}
    </section>
  );
}
