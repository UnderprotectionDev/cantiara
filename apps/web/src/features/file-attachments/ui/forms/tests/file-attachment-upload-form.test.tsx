// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ upload: vi.fn() }));

vi.mock("../../../lib/file-attachment-upload", () => ({
  uploadFileAttachment: hoisted.upload,
}));
vi.mock(
  "@/features/web-macos-client/store/client-shell",
  async (importActual) => {
    const actual =
      await importActual<
        typeof import("@/features/web-macos-client/store/client-shell")
      >();
    return {
      ...actual,
      runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
    };
  },
);

import { FileAttachmentUploadControl } from "../file-attachment-upload-form";

async function mountUpload() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <FileAttachmentUploadControl projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  return { host, root };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function submit(host: HTMLElement) {
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    await settle();
  });
}

test("submitting without a file shows no message and uploads nothing", async () => {
  hoisted.upload.mockReset();
  const { host, root } = await mountUpload();

  await submit(host);

  expect(hoisted.upload).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
});

test("Upload submits the chosen file through the form", async () => {
  hoisted.upload.mockReset();
  hoisted.upload.mockResolvedValue({});
  const { host, root } = await mountUpload();
  const file = new File(["png"], "photo.png", { type: "image/png" });
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  await act(async () => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input?.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });
  expect(host.textContent).toContain("photo.png");

  await submit(host);

  expect(hoisted.upload).toHaveBeenCalledTimes(1);
  expect(hoisted.upload.mock.calls[0]?.[0]).toBe(file);
  await act(async () => root.unmount());
});

test("a failed upload shows the error and keeps the chosen file", async () => {
  hoisted.upload.mockReset();
  hoisted.upload.mockRejectedValue(new Error("Storage is full."));
  const { host, root } = await mountUpload();
  const file = new File(["png"], "photo.png", { type: "image/png" });
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  await act(async () => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input?.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });

  await submit(host);

  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    "Storage is full.",
  );
  expect(host.textContent).toContain("photo.png");
  await act(async () => root.unmount());
});
