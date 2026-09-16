import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import GitHubWaitingStatus from "./github-waiting-status";

describe("GitHub waiting status", () => {
  test("shows the accessible waiting message only while visible", () => {
    const waiting = renderToStaticMarkup(
      <GitHubWaitingStatus visible={true} />,
    );
    const idle = renderToStaticMarkup(<GitHubWaitingStatus visible={false} />);

    expect(waiting).toContain("Waiting for GitHub");
    expect(waiting).toContain('aria-live="polite"');
    expect(idle).toBe("");
  });
});
