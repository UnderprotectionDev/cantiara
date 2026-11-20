// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test handlers are inline doubles.
// biome-ignore-all lint/performance/noAwaitInLoops: Timers settle one after another.
import { FILE_ATTACHMENT_UI_LABELS } from "@cantiara/api/file-attachments";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import FileAttachmentLocationBinder from "../file-attachment-location-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function settle() {
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function mount(onPreview: () => Promise<never>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const cache = new QueryClient();
  act(() => {
    root?.render(
      <QueryClientProvider client={cache}>
        <FileAttachmentLocationBinder
          attachmentId="a1"
          location={{ kind: "point", x: 0.2, y: 0.3 }}
          locationKind="point"
          onClose={() => undefined}
          onLocationChange={() => undefined}
          onLocationKindChange={() => undefined}
          onPreview={onPreview}
          projectId="p1"
          versionId="v1"
        />
      </QueryClientProvider>,
    );
  });
}

function click(selector: string) {
  return act(async () => {
    host?.querySelector<HTMLElement>(selector)?.click();
    await settle();
  });
}

test("the New Work mode is form state: it picks the fields and the preview input mode", async () => {
  const onPreview = vi.fn().mockRejectedValue(new Error("offline"));
  mount(onPreview);

  const pressed = (mode: string) =>
    host?.querySelector(`[data-mode="${mode}"]`)?.getAttribute("aria-pressed");
  expect(pressed("existing")).toBe("true");
  await click('[data-mode="new"]');
  expect(pressed("new")).toBe("true");
  expect(host?.textContent).toContain(FILE_ATTACHMENT_UI_LABELS.title);

  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  });
  expect(onPreview).toHaveBeenCalledTimes(1);
  expect(onPreview.mock.calls[0]?.[0]).toMatchObject({
    mode: "new",
    projectId: "p1",
  });
});
