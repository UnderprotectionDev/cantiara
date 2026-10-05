import type {
  SmartCollectionSourceType,
  SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ContextRecordPreviewProvider } from "@/features/record-discovery/ui/components/context-record-preview";
import { orpc } from "@/utils/orpc";
import ProjectSmartCollectionsSurface from "./project-smart-collections-surface";

const projectId = "project-1";
const rootRoute = createRootRoute({});
const projectRoute = createRoute({
  component: () => null,
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const routeTree = rootRoute.addChildren([projectRoute]);

function emptyView(
  id: string,
  sourceType: SmartCollectionSourceType,
): SmartCollectionViewSource {
  return {
    collectionId: `collection-${id}`,
    collectionName: "Review",
    conditions: {},
    documents: [],
    id,
    name: "Default",
    presentation: "List",
    projectId,
    projectSourceRecords: [],
    scope: { projectIds: [projectId] },
    sourceType,
    works: [],
    workspaceId: "workspace-1",
  };
}

const views: SmartCollectionViewSource[] = [
  {
    ...emptyView("work-view", "Work"),
    works: [
      {
        createdAt: "2026-09-30T12:00:00.000Z",
        effort: null,
        id: "work-1",
        key: "CAN-1",
        membershipReasons: ["Status: In Progress"],
        projectId,
        status: "In Progress",
        statusChangedAt: "2026-10-04T12:00:00.000Z",
        title: "Verify callback",
        type: "Task",
      },
    ],
  },
  {
    ...emptyView("document-view", "Document"),
    documents: [
      {
        id: "document-1",
        membershipReasons: ["Document type: Spec"],
        projectId,
        title: "Payment spec",
        type: "Spec",
        workspaceId: "workspace-1",
      },
    ],
  },
  {
    ...emptyView("wiki-view", "Wiki Document"),
    documents: [
      {
        id: "wiki-document-1",
        membershipReasons: ["Document type: Note"],
        projectId: null,
        title: "Research notes",
        type: "Note",
        workspaceId: "workspace-1",
      },
    ],
  },
  {
    ...emptyView("decision-view", "Decision"),
    projectSourceRecords: [
      {
        id: "decision-1",
        membershipReasons: ["Status: Active"],
        projectId,
        sourceType: "Decision",
        status: "Active",
        title: "Use the hosted callback",
      },
    ],
  },
];

function renderSurface() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const viewsOptions = orpc.smartCollectionViews.queryOptions({
    input: { projectId },
  });
  queryClient.setQueryData(viewsOptions.queryKey, views);
  const projectsOptions = orpc.projects.queryOptions();
  queryClient.setQueryData(projectsOptions.queryKey, []);
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: [`/projects/${projectId}`],
    }),
    routeTree,
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <ContextRecordPreviewProvider>
          <ProjectSmartCollectionsSurface projectId={projectId} />
        </ContextRecordPreviewProvider>
      </RouterContextProvider>
    </QueryClientProvider>,
  );
}

describe("Smart Collection source preview actions", () => {
  test("opens Work, Document, Wiki Document, and Project source records through the shared action", () => {
    const html = renderSurface();

    expect(html.match(/>Open source record<\/button>/g)).toHaveLength(4);
    expect(html).toContain(
      'aria-label="Open source record: CAN-1 · Verify callback"',
    );
    expect(html).toContain('aria-label="Open source record: Payment spec"');
    expect(html).toContain('aria-label="Open source record: Research notes"');
    expect(html).toContain(
      'aria-label="Open source record: Use the hosted callback"',
    );
    expect(html).not.toContain('href="/projects/project-1#work-work-1"');
    expect(html).not.toContain(
      'href="/projects/project-1#document-document-1"',
    );
    expect(html).not.toContain(
      'href="/personal-wiki#document-wiki-document-1"',
    );
    expect(html).not.toContain(
      'href="/projects/project-1#source-decision-decision-1"',
    );
  });
});
