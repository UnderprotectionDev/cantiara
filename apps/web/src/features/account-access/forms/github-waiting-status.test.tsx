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
    expect(waiting).toContain("GitHub is taking a moment to respond.");
    expect(waiting).toContain('aria-live="polite"');
    expect(waiting).toContain('role="status"');
    expect(waiting).toContain("animate-spin");
    expect(waiting).toContain("motion-reduce:animate-none");
    expect(idle).toBe("");
  });
});
