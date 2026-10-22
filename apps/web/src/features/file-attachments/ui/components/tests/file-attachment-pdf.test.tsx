// @vitest-environment happy-dom
import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { FileAttachmentPdfPreview } from "../file-attachment-pdf";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const pdfEngine = vi.hoisted(() => ({
  failLoad: false,
  numPages: 3,
}));

vi.mock("react-pdf", () => ({
  Document: ({
    children,
    onLoadError,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadError: () => void;
    onLoadSuccess: (pdf: { numPages: number }) => void;
  }) => {
    useEffect(() => {
      if (pdfEngine.failLoad) {
        onLoadError();
        return;
      }
      onLoadSuccess({ numPages: pdfEngine.numPages });
    }, [onLoadError, onLoadSuccess]);
    return <div>{children}</div>;
  },
  Page: ({
    onRenderSuccess,
    pageNumber,
  }: {
    onRenderSuccess: () => void;
    pageNumber: number;
  }) => {
    useEffect(() => {
      onRenderSuccess();
    }, [onRenderSuccess]);
    return <canvas data-page-number={pageNumber} />;
  },
  pdfjs: { GlobalWorkerOptions: {} },
}));

// Konva needs a real 2D canvas; the markup layer has its own tests.
vi.mock("../file-attachment-markup", () => ({
  MarkupSurface: ({ children }: { children: ReactNode }) => (
    <div data-markup-surface>{children}</div>
  ),
}));

const noop = () => undefined;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  pdfEngine.failLoad = false;
  pdfEngine.numPages = 3;
});

function mountPdf(pageCount: number, onRetry?: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <FileAttachmentPdfPreview
        assetURL="blob:http://localhost/document"
        attachmentId="attachment-1"
        location={null}
        locationKind="point"
        onRetry={onRetry}
        onSelectLocation={noop}
        pageCount={pageCount}
        selectingLocation={false}
        tool="pen"
        versionId="version-1"
      />,
    );
  });
  return host;
}

describe("File Attachment PDF preview", () => {
  test("labels one markable canvas per page up to the previewed page count", () => {
    const view = mountPdf(2);

    expect(
      view.querySelector('[aria-label="PDF page 1 of 2"] canvas'),
    ).not.toBeNull();
    expect(
      view.querySelector('[aria-label="PDF page 2 of 2"] canvas'),
    ).not.toBeNull();
    expect(view.querySelector('[aria-label="PDF page 3 of 2"]')).toBeNull();
    expect(view.querySelectorAll("[data-markup-surface]")).toHaveLength(2);
    expect(view.textContent).not.toContain("Loading PDF preview");
  });

  test("keeps a PDF that failed to load downloadable and retryable", () => {
    pdfEngine.failLoad = true;
    const onRetry = vi.fn();
    const view = mountPdf(2, onRetry);

    expect(view.querySelector("[role=alert]")?.textContent).toContain(
      "PDF preview is unavailable. Download the original file instead.",
    );
    const retry = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Retry preview"),
    );
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
