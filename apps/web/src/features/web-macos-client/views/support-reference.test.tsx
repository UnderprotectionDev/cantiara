import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  buildSupportReferenceFailure,
  SupportReferenceNotice,
} from "./support-reference";

const supportError = {
  data: {
    reasonCode: "unexpected",
    retryPolicy: "once",
    supportReference: "SUP-123E4567-E89B-12D3-A456-426614174000",
    writeOutcome: "not-written",
  },
  message: "token=secret-token private Workspace body",
};

describe("Client Shell Support reference notice", () => {
  test("shows a bounded Retry for an unwritten failure", () => {
    const failure = buildSupportReferenceFailure(supportError, {
      kind: "mutation",
      retryCount: 0,
    });
    const html = renderToStaticMarkup(
      <SupportReferenceNotice failure={failure} />,
    );

    expect(failure.reason).toBe("This action could not be completed.");
    expect(failure.canRetry).toBe(true);
    expect(failure.retryBound).toBe("You can retry once.");
    expect(html).not.toContain(`<p>${failure.reason}</p>`);
    expect(html).toContain("Data was not written.");
    expect(html).toContain("You can retry once.");
    expect(html).toContain("Support reference");
    expect(html).toContain("SUP-123E4567-E89B-12D3-A456-426614174000");
    expect(html).not.toContain("secret-token");
    expect(html).not.toContain("private Workspace body");
    expect(html).not.toContain("pager");
    expect(html).not.toContain("S1");
  });

  test("does not offer Retry after data was written", () => {
    const failure = buildSupportReferenceFailure(
      {
        ...supportError,
        data: { ...supportError.data, writeOutcome: "written" },
      },
      { kind: "mutation", retryCount: 0 },
    );

    expect(failure.writeOutcome).toBe("written");
    expect(failure.writeOutcomeLabel).toBe("Data was written.");
    expect(failure.canRetry).toBe(false);
    expect(failure.retryBound).toBe("Do not retry.");
  });

  test("does not offer Retry when the write outcome is unknown", () => {
    const failure = buildSupportReferenceFailure(
      {
        ...supportError,
        data: { ...supportError.data, writeOutcome: "unknown" },
      },
      { kind: "mutation", retryCount: 0 },
    );

    expect(failure.writeOutcome).toBe("unknown");
    expect(failure.writeOutcomeLabel).toBe("Data write outcome is unknown.");
    expect(failure.canRetry).toBe(false);
    expect(failure.retryBound).toBe("Do not retry.");
  });

  test("keeps a stale unwritten mutation failure reachable", () => {
    const failure = buildSupportReferenceFailure(
      {
        ...supportError,
        data: { ...supportError.data, retryPolicy: "never" },
      },
      { kind: "mutation" },
    );

    expect(failure.canRetry).toBe(false);
    expect(failure.duration).toBe(Number.POSITIVE_INFINITY);
    expect(failure.retryBound).toBe("Do not retry.");
  });

  test("explains a stale mutation in plain language", () => {
    const failure = buildSupportReferenceFailure(
      {
        ...supportError,
        data: {
          ...supportError.data,
          code: "STALE_BASE_REVISION",
          retryPolicy: "never",
        },
      },
      { kind: "mutation" },
    );

    expect(failure.reason).toBe("This page is out of date.");
  });

  test("auto-dismisses a query failure and keeps the Support reference safe", () => {
    const failure = buildSupportReferenceFailure(supportError, {
      kind: "query",
    });

    expect(failure.canRetry).toBe(false);
    expect(failure.duration).toBeGreaterThan(0);
    expect(failure.writeOutcomeLabel).toBe("Data was not written.");
    expect(failure.supportReference).toBe(
      "SUP-123E4567-E89B-12D3-A456-426614174000",
    );
  });

  test("uses restart-the-API copy instead of HTTP jargon", () => {
    const failure = buildSupportReferenceFailure(
      { data: { ...supportError.data, reasonCode: "restart-api" } },
      { kind: "query" },
    );

    expect(failure.reason).toBe("Please restart the API and try again.");
    expect(failure.reason).not.toContain("404");
    expect(failure.reason).not.toContain("Not Found");
  });

  test("shows the explicit Update required copy without offering a retry", () => {
    const failure = buildSupportReferenceFailure(
      { data: { ...supportError.data, reasonCode: "update-required" } },
      { kind: "mutation" },
    );

    expect(failure.reason).toBe("Update required");
    expect(failure.canRetry).toBe(false);
    expect(failure.retryBound).toBe("Do not retry.");
  });

  test("does not fabricate a Support reference for an offline failure", () => {
    const failure = buildSupportReferenceFailure(new Error("Failed to fetch"), {
      kind: "query",
    });
    const html = renderToStaticMarkup(
      <SupportReferenceNotice failure={failure} />,
    );

    expect(failure.reason).toBe("You’re offline");
    expect(failure.supportReference).toBeNull();
    expect(html).toContain("<p>Support reference unavailable.</p>");
    expect(html).not.toContain(
      "<span>Support reference</span> <code>Support reference unavailable.</code>",
    );
  });
});
