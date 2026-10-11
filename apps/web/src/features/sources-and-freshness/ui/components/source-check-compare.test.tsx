import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SourceCheckCompare } from "./source-check-compare";

test("compares the exact historical capture to the candidate without labeling the historical capture current", () => {
  const version = {
    sourceId: "source-1",
    revision: 1,
    title: "Original",
    url: "https://example.org/old",
    capturedContent: "Original finding.\n",
    accessedAt: "2026-10-01T09:00:00Z",
    savedAt: "2026-10-01T09:00:00Z",
    provider: null,
    externalRecordType: null,
    externalId: null,
  };
  const check = {
    id: "check-1",
    sourceId: "source-1",
    revision: 1,
    comparedRevision: 1,
    checkedAt: "2026-10-11T09:00:00Z",
    checkedBy: "founder",
    startUrl: version.url,
    fetchResult: {
      finalUrl: "https://example.org/new",
      httpStatus: 200,
      contentType: "text/plain",
    },
    fingerprint: "hash",
    error: null,
    decision: null,
    approvedRevision: null,
    candidate: {
      ...version,
      title: "Revised",
      url: "https://example.org/new",
      capturedContent: "Revised finding.\n",
    },
  };
  const html = renderToStaticMarkup(
    <SourceCheckCompare
      check={check}
      preferences={DEFAULT_ACCOUNT_PREFERENCES}
      version={version}
    />,
  );
  expect(html).toContain("Source Check");
  expect(html).toContain("Historical snapshot");
  expect(html).toContain("Candidate snapshot");
  expect(html).toContain("Removed");
  expect(html).toContain("Added");
  expect(html).toContain("https://example.org/new");
});
