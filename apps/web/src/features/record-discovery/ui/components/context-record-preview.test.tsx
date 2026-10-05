import { PassThrough } from "node:stream";
import type { Document } from "@cantiara/api/documents";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import {
  ContextRecordPreviewPanel,
  ContextRecordPreviewProvider,
  closeContextRecordPreviewOnNavigation,
  OpenSourceRecordButton,
  type SourceRecordPreviewTarget,
  sourceRecordPreviewHref,
} from "./context-record-preview";

const noop = () => undefined;

vi.mock("@cantiara/ui/components/sheet", async () => {
  const React = await import("react");
  const MockContainer = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => React.createElement("div", { className }, children);

  return {
    Sheet: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
      open ? React.createElement("div", { "data-open": true }, children) : null,
    SheetContent: MockContainer,
    SheetDescription: MockContainer,
    SheetFooter: MockContainer,
    SheetHeader: MockContainer,
    SheetTitle: MockContainer,
  };
});

function renderToMarkup(children: ReactNode) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let markup = "";
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      markup += chunk;
    });
    output.on("end", () => resolve(markup));
    output.on("error", reject);

    let stream: ReturnType<typeof renderToPipeableStream> | null = null;
    stream = renderToPipeableStream(children, {
      onAllReady() {
        stream?.pipe(output);
      },
      onError: reject,
      onShellError: reject,
    });
  });
}

const work: WorkProfile = {
  archivedAt: "2026-10-01T09:00:00.000Z",
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-25T09:00:00.000Z",
  description: "Confirm the provider's access requirements.",
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAN-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  roadmapHorizon: "Next",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  statusChangedAt: "2026-09-25T08:00:00.000Z",
  targetDate: null,
  title: "Verify provider callback",
  type: "Task",
  updatedAt: "2026-09-25T09:00:00.000Z",
};

describe("Context record preview", () => {
  test("renders the shared source action with its record-specific accessible name", () => {
    const html = renderToStaticMarkup(
      <ContextRecordPreviewProvider>
        <OpenSourceRecordButton
          sourceLabel="CAN-1 · Verify provider callback"
          target={{ kind: "work", projectId: "project-1", workId: "work-1" }}
        />
      </ContextRecordPreviewProvider>,
    );

    expect(html).toContain("Open source record</button>");
    expect(html).toContain(
      'aria-label="Open source record: CAN-1 · Verify provider callback"',
    );
    expect(html).not.toContain("Open full page");
  });

  test("links each supported source to its canonical full page", () => {
    const targets: [SourceRecordPreviewTarget, string][] = [
      [
        { kind: "work", projectId: "project-1", workId: "work/1" },
        "/projects/project-1#work-work%2F1",
      ],
      [
        { kind: "document", documentId: "doc-1", projectId: "project-1" },
        "/projects/project-1#document-doc-1",
      ],
      [
        { kind: "document", documentId: "wiki-1", projectId: null },
        "/personal-wiki#document-wiki-1",
      ],
      [
        {
          kind: "project-source-record",
          projectId: "project-1",
          sourceId: "decision-1",
          sourceType: "Decision",
        },
        "/projects/project-1#source-decision-decision-1",
      ],
    ];

    for (const [target, href] of targets) {
      expect(sourceRecordPreviewHref(target)).toBe(href);
    }
  });

  test("reads the canonical Work in a temporary panel with a full-page action", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.work.queryOptions({ input: { workId: work.id } }).queryKey,
      work,
    );

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ContextRecordPreviewPanel
          onClose={noop}
          record={{
            kind: "work",
            projectId: work.projectId,
            workId: work.id,
          }}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Verify provider callback");
    expect(html).toContain("Confirm the provider&#x27;s access requirements.");
    expect(html).toContain("Horizon");
    expect(html).toContain("Next");
    expect(html).toContain("Archived");
    expect(html).toContain("Open full page");
    expect(html).toContain('href="/projects/project-1#work-work-1"');
    expect(html).not.toContain("Save as Smart Collection");
    expect(html).not.toContain(">Save</button>");
  });

  test("closes the temporary panel when a link navigates away", () => {
    const onClose = vi.fn();
    const closest = vi.fn(() => ({}));

    closeContextRecordPreviewOnNavigation(
      { target: { closest } } as unknown as Parameters<
        typeof closeContextRecordPreviewOnNavigation
      >[0],
      onClose,
    );

    expect(closest).toHaveBeenCalledWith("a[href]");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("loads live blocks and record references in a read-only Document preview", async () => {
    const body = [
      "Document context.",
      "",
      ':::live-work{workId="embedded-work"}',
      "",
      "[[record:Work:referenced-work|Friendly work label]]",
    ].join("\n");
    const sourceDocument: Document = {
      body,
      createdAt: "2026-09-25T09:00:00.000Z",
      id: "document-1",
      projectId: "project-1",
      revision: 1,
      title: "Preview source document",
      type: "Spec",
      updatedAt: "2026-09-25T09:00:00.000Z",
    };
    const queryClient = new QueryClient();
    const documentInput = { documentId: sourceDocument.id };
    const bodyInput = { ...documentInput, body };
    const embeddedWork = {
      id: "embedded-work",
      key: "CAN-2",
      plannedStartDate: null,
      priority: [],
      projectId: "project-1",
      status: "In Progress",
      targetDate: null,
      title: "Embedded source title",
      type: "Task",
    };
    const referenceToken =
      "[[record:Work:referenced-work|Friendly work label]]";

    queryClient.setQueryData(
      orpc.document.queryOptions({ input: documentInput }).queryKey,
      sourceDocument,
    );
    queryClient.setQueryData(
      orpc.documentLiveWorkBlocks.queryOptions({ input: bodyInput }).queryKey,
      [{ source: embeddedWork, workId: embeddedWork.id }],
    );
    queryClient.setQueryData(
      orpc.documentLiveOtherBlocks.queryOptions({ input: bodyInput }).queryKey,
      [],
    );
    queryClient.setQueryData(
      orpc.documentRecordReferences.queryOptions({ input: bodyInput }).queryKey,
      [
        {
          end: body.indexOf(referenceToken) + referenceToken.length,
          label: "Friendly work label",
          recordId: "referenced-work",
          recordType: "Work",
          source: {
            id: "referenced-work",
            projectId: "project-1",
            title: "Referenced source title",
          },
          start: body.indexOf(referenceToken),
        },
      ],
    );

    const html = await renderToMarkup(
      <QueryClientProvider client={queryClient}>
        <ContextRecordPreviewPanel
          onClose={noop}
          onOpenSourceRecord={vi.fn()}
          record={{
            documentId: sourceDocument.id,
            kind: "document",
            projectId: sourceDocument.projectId,
          }}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Document context.");
    expect(html).toContain("Embedded source title");
    expect(html).toContain("Referenced source title");
    expect(html).toContain(
      'aria-label="Open source record: CAN-2 · Embedded source title"',
    );
    expect(html).toContain(
      'aria-label="Open source record: Referenced source title"',
    );
    expect(html).not.toContain('href="/projects/project-1#work-embedded-work"');
    expect(html).not.toContain(
      'href="/projects/project-1#work-referenced-work"',
    );
    expect(html).not.toContain("Loading source record…");
    expect(html).not.toContain("Change status");
    expect(html).not.toContain("Save as Smart Collection");
    expect(html).not.toContain(">Save</button>");
  });
});
