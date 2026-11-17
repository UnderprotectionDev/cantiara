// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: The test renders the form with inline handlers.

import type { WorkNotNowTrail } from "@cantiara/api/work-not-now";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { NotNowReconsideration } from "../not-now-reconsideration-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

test("Reconsidering submits the form once with the schema-valid handling", async () => {
  const onReconsider = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <NotNowReconsideration
        archived={false}
        canStart={false}
        connection="online"
        currentTrail={{ id: "trail-1" } as WorkNotNowTrail}
        historyPending={false}
        onReconsider={onReconsider}
        onReviewLaterHandlingChange={() => undefined}
        onStartNew={() => undefined}
        reconsiderPending={false}
        reviewLaterHandling="Keep Review later"
        workId="work-1"
      />,
    );
  });
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(onReconsider).toHaveBeenCalledTimes(1);
});
