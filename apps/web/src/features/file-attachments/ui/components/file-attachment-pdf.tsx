import type {
  FileAttachmentLocation,
  FileAttachmentMarking,
  FileAttachmentMarkingInput,
} from "@cantiara/api/file-attachments";
import { FILE_ATTACHMENT_UI_LABELS } from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { useCallback, useState } from "react";
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
  location: FileAttachmentLocation | null;
  locationKind: "point" | "region";
  markings?: readonly FileAttachmentMarking[];
  onCreateMarking?: (input: FileAttachmentMarkingInput) => void | Promise<void>;
  onMarkingError?: () => void;
  onRetry?: () => void;
  onSelectLocation: (location: FileAttachmentLocation) => void;
  pageCount: number;
  selectingLocation: boolean;
  tool: "pen" | "highlighter" | "arrow" | "rectangle";
  versionId: string;
}

export function FileAttachmentPdfPreview({
  attachmentId,
  assetURL,
  location,
  locationKind,
  markings,
  onCreateMarking,
  onMarkingError,
  onRetry,
  onSelectLocation,
  pageCount,
  selectingLocation,
  tool,
  versionId,
}: FileAttachmentPdfPreviewProps) {
  const [loadedPages, setLoadedPages] = useState<number | null>(null);
  const [renderedPages, setRenderedPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const pagesToRender =
    loadedPages === null ? 0 : Math.min(pageCount, loadedPages);
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => setLoadedPages(numPages),
    [],
  );
  const handleFailure = useCallback(() => setFailed(true), []);
  const handleRenderSuccess = useCallback(
    () => setRenderedPages((current) => current + 1),
    [],
  );
  let status: "loading" | "ready" | "error" = "loading";
  if (failed) {
    status = "error";
  } else if (loadedPages !== null && renderedPages >= pagesToRender) {
    status = "ready";
  }

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
      <Document
        error={null}
        file={assetURL}
        loading={null}
        noData={null}
        onLoadError={handleFailure}
        onLoadSuccess={handleLoadSuccess}
        onSourceError={handleFailure}
      >
        <div className="grid justify-items-center gap-4">
          {Array.from({ length: pagesToRender }, (_, index) => index + 1).map(
            (pageNumber) => (
              <MarkupSurface
                attachmentId={attachmentId}
                key={pageNumber}
                location={location}
                locationKind={locationKind}
                markings={markings ?? []}
                onCreateMarking={onCreateMarking}
                onMarkingError={onMarkingError}
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
                    onRenderError={handleFailure}
                    onRenderSuccess={handleRenderSuccess}
                    pageNumber={pageNumber}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    scale={PDF_PAGE_SCALE}
                  />
                </div>
              </MarkupSurface>
            ),
          )}
        </div>
      </Document>
    </section>
  );
}
