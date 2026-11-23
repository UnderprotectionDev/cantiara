// @vitest-environment happy-dom
import { act, type ComponentProps, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { FileAttachmentPdfPreview } from "../file-attachment-pdf";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface PageCallbacks {
  onLoadError: () => void;
  onRenderError: () => void;
  onRenderSuccess: (page: { pageNumber: number }) => void;
  pageNumber: number;
}

interface DocumentCallbacks {
  onLoadError: () => void;
  onLoadSuccess: (pdf: { numPages: number }) => void;
  onSourceError: () => void;
}

const pdfEngine = vi.hoisted(() => ({
  autoLoad: true,
  autoRender: true,
  document: null as DocumentCallbacks | null,
  pages: new Map<number, PageCallbacks>(),
  numPages: 3,
}));

vi.mock("react-pdf", () => ({
  Document: ({
    children,
    onLoadError,
    onLoadSuccess,
    onSourceError,
  }: DocumentCallbacks & { children: ReactNode }) => {
    useEffect(() => {
      pdfEngine.document = { onLoadError, onLoadSuccess, onSourceError };
      if (pdfEngine.autoLoad) {
        onLoadSuccess({ numPages: pdfEngine.numPages });
      }
    }, [onLoadError, onLoadSuccess, onSourceError]);
    return <div>{children}</div>;
  },
  Page: (callbacks: PageCallbacks) => {
    const { onRenderSuccess, pageNumber } = callbacks;
    useEffect(() => {
      if (pdfEngine.autoRender) {
        onRenderSuccess({ pageNumber });
      }
    }, [onRenderSuccess, pageNumber]);
    useEffect(() => {
      pdfEngine.pages.set(callbacks.pageNumber, callbacks);
    }, [callbacks]);
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
  pdfEngine.autoLoad = true;
  pdfEngine.autoRender = true;
  pdfEngine.document = null;
  pdfEngine.pages.clear();
  pdfEngine.numPages = 3;
});

function renderPdf(
  pageCount: number,
  overrides: Partial<ComponentProps<typeof FileAttachmentPdfPreview>> = {},
) {
  act(() => {
    root?.render(
      <FileAttachmentPdfPreview
        assetURL="blob:http://localhost/document"
        attachmentId="attachment-1"
        location={null}
        locationKind="point"
        onSelectLocation={noop}
        pageCount={pageCount}
        selectingLocation={false}
        tool="pen"
        versionId="version-1"
        {...overrides}
      />,
    );
  });
}

function mountPdf(
  pageCount: number,
  overrides?: Partial<ComponentProps<typeof FileAttachmentPdfPreview>>,
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  renderPdf(pageCount, overrides);
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

  test.each(["onSourceError", "onLoadError"] as const)(
    "offers a local retry on document %s",
    (failure) => {
      pdfEngine.autoLoad = false;
      const onRetry = vi.fn();
      const view = mountPdf(2, { onRetry });

      act(() => pdfEngine.document?.[failure]());
      const alert = view.querySelector("[role=alert]");
      expect(alert?.textContent).toContain(
        "PDF preview is unavailable. Download the original file instead.",
      );
      const retry = alert?.querySelector("button");
      expect(retry?.textContent).toBe("Retry preview");
      act(() => retry?.click());
      expect(onRetry).toHaveBeenCalledOnce();
      expect(view.querySelector("[role=alert]")).toBeNull();
      expect(view.querySelector("[role=status]")?.textContent).toBe(
        "Loading PDF preview…",
      );
    },
  );

  test("keeps loading until each required page has rendered", () => {
    pdfEngine.autoRender = false;
    const view = mountPdf(2);

    act(() => {
      pdfEngine.pages.get(1)?.onRenderSuccess({ pageNumber: 1 });
      pdfEngine.pages.get(1)?.onRenderSuccess({ pageNumber: 1 });
    });
    expect(view.querySelector("[role=status]")?.textContent).toBe(
      "Loading PDF preview…",
    );

    act(() => pdfEngine.pages.get(2)?.onRenderSuccess({ pageNumber: 2 }));
    expect(view.querySelector("[role=status]")).toBeNull();
  });

  test.each(["onLoadError", "onRenderError"] as const)(
    "shows the local fallback on a page %s",
    (failure) => {
      pdfEngine.autoRender = false;
      const view = mountPdf(2, { onRetry: noop });

      act(() => pdfEngine.pages.get(1)?.[failure]());
      expect(view.querySelectorAll("[role=alert]")).toHaveLength(1);
      expect(view.querySelector("[role=status]")).toBeNull();
      expect(view.querySelector("[role=alert] button")?.textContent).toBe(
        "Retry preview",
      );
    },
  );

  test.each([
    {
      name: "asset URL",
      pageCount: 1,
      props: { assetURL: "blob:http://localhost/replacement" },
    },
    { name: "version", pageCount: 1, props: { versionId: "version-2" } },
    { name: "page count", pageCount: 2, props: {} },
  ])(
    "resets the visible preview when the $name changes",
    ({ pageCount, props }) => {
      const view = mountPdf(1);
      expect(view.querySelector("[role=status]")).toBeNull();

      const oldDocument = pdfEngine.document;
      const oldPage = pdfEngine.pages.get(1);
      pdfEngine.autoLoad = false;
      pdfEngine.autoRender = false;
      renderPdf(pageCount, props);

      act(() => {
        oldDocument?.onLoadSuccess({ numPages: 1 });
        oldPage?.onRenderSuccess({ pageNumber: 1 });
        oldPage?.onRenderError();
      });
      expect(view.querySelector("[role=status]")?.textContent).toBe(
        "Loading PDF preview…",
      );
      expect(view.querySelector("canvas")).toBeNull();
      expect(view.querySelector("[role=alert]")).toBeNull();

      act(() => pdfEngine.document?.onLoadSuccess({ numPages: 3 }));
      expect(view.querySelectorAll("canvas")).toHaveLength(pageCount);
      expect(view.querySelector("[role=status]")).not.toBeNull();
    },
  );

  test("ignores renderer callbacks from before Retry preview and after closing", () => {
    pdfEngine.autoRender = false;
    const view = mountPdf(1, { onRetry: noop });
    const oldPage = pdfEngine.pages.get(1);
    act(() => oldPage?.onLoadError());

    act(() =>
      view.querySelector<HTMLButtonElement>("[role=alert] button")?.click(),
    );
    act(() => {
      oldPage?.onRenderSuccess({ pageNumber: 1 });
      oldPage?.onRenderError();
    });
    expect(view.querySelector("[role=alert]")).toBeNull();
    expect(view.querySelector("[role=status]")).not.toBeNull();

    const currentPage = pdfEngine.pages.get(1);
    act(() => currentPage?.onRenderSuccess({ pageNumber: 1 }));
    expect(view.querySelector("[role=status]")).toBeNull();

    act(() => root?.render(null));
    act(() => currentPage?.onRenderError());
    renderPdf(1);
    expect(view.querySelector("[role=alert]")).toBeNull();
    expect(view.querySelector("[role=status]")).not.toBeNull();
  });

  test("waits for the asset refetch before starting the next PDF render", async () => {
    const refetch = Promise.withResolvers<void>();
    pdfEngine.autoRender = false;
    const view = mountPdf(1, { onRetry: () => refetch.promise });
    const oldPage = pdfEngine.pages.get(1);
    act(() => oldPage?.onLoadError());

    act(() =>
      view.querySelector<HTMLButtonElement>("[role=alert] button")?.click(),
    );
    expect(view.querySelector("[role=status]")?.textContent).toBe(
      "Loading PDF preview…",
    );
    expect(view.querySelector("canvas")).toBeNull();
    expect(view.querySelector("[role=alert]")).toBeNull();

    await act(async () => refetch.resolve());
    act(() => pdfEngine.pages.get(1)?.onRenderSuccess({ pageNumber: 1 }));
    expect(view.querySelector("canvas")).not.toBeNull();
    expect(view.querySelector("[role=status]")).toBeNull();
  });
});
