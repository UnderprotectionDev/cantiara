import {
  type DocumentDiscoveryResult,
  documentMatchContext,
} from "@cantiara/api/record-discovery";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import DocumentDiscoveryResults from "./document-discovery-results";

const results: DocumentDiscoveryResult[] = [null, "project-one"].map(
  (projectId, index) => ({
    document: {
      id: `document-${index}`,
      projectId,
      title: "Connection recovery",
      body: "PostgreSQL connection",
      type: "General",
      revision: 1,
      createdAt: "",
      updatedAt: "",
      folder: "Troubleshooting",
      parentDocumentId: null,
    },
    projectName: projectId === null ? null : "Example Project",
    projectArchivedAt: null,
    projectStatus: projectId === null ? null : "Active",
    snippet: "PostgreSQL connection",
    matchCount: 1,
  }),
);

function renderResults(data: DocumentDiscoveryResult[], query = "PostgreSQL") {
  const rootRoute = createRootRoute({});
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/personal-wiki"] }),
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/personal-wiki" }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/projects/$projectId",
      }),
    ]),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <DocumentDiscoveryResults query={query} results={data} />
    </RouterContextProvider>,
  );
}

test("discovery rows badge both homes and open their existing source records", () => {
  const markup = renderResults(results);
  expect(markup).toContain("Personal Wiki");
  expect(markup).toContain("Project: Example Project");
  expect(markup).toContain('href="/personal-wiki#document-document-0"');
  expect(markup).toContain('href="/projects/project-one#document-document-1"');
  expect(markup).toContain("<mark>PostgreSQL</mark>");
  expect(markup.match(/>Open source record</g)).toHaveLength(2);
  expect(markup).toContain('aria-describedby="discovery-scope-document-0"');
});

test("an archived Project marks its source Document as Archived", () => {
  const markup = renderResults([
    { ...results[1], projectArchivedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  expect(markup).toContain(">Archived<");
  expect(markup).not.toContain(">Active<");
});

test("match context and highlights share whole-word case matching and escape source markup", () => {
  const body = "<script>PostgreSQL</script> postgresql postgresql_extra";
  const context = documentMatchContext("Connection", body, "POSTGRESQL");
  expect(context.matchCount).toBe(2);
  const markup = renderResults([{ ...results[0], ...context }], "POSTGRESQL");
  expect(markup).not.toContain("<script>");
  expect(markup).toContain("&lt;script&gt;");
  expect(markup.match(/<mark>/g)).toHaveLength(context.matchCount);
});
