import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import GitHubWaitingStatus from "./github-waiting-status";

describe("GitHub waiting status", () => {
  test("renders the accessible waiting label only while visible", () => {
    const waiting = renderToStaticMarkup(
      <GitHubWaitingStatus visible={true} />,
    );
    const idle = renderToStaticMarkup(<GitHubWaitingStatus visible={false} />);

    expect(waiting).toContain('role="status"');
    expect(waiting).toContain("Waiting for GitHub");
    expect(idle).toBe("");
  });
});
