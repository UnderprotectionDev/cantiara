// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { WebCaptureSendForm } from "../web-capture-send-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const link = { token: "t" } as never;
const targets = [
  {
    id: "workspace",
    label: "Workspace",
    name: "Capture Inbox",
    projectId: null,
  },
  { id: "p1", label: "Project", name: "Cantiara", projectId: "p1" },
] as never;

async function submit(draft: Record<string, unknown>, targetId = "p1") {
  const onSend = vi.fn().mockResolvedValue(undefined);
  const onInvalid = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <WebCaptureSendForm
        draft={draft as never}
        isSending={false}
        link={link}
        onInvalid={onInvalid}
        onSend={onSend}
        onTargetSearchChange={vi.fn()}
        targetSearch=""
        targets={targets}
      />,
    );
    return Promise.resolve();
  });
  const select = host.querySelector("select") as HTMLSelectElement;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, targetId);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return Promise.resolve();
  });
  await act(() => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });
  await act(() => root.unmount());
  host.remove();
  return { onInvalid, onSend };
}

test("Send submits the chosen Target Inbox once the API send schema accepts the capture", async () => {
  const { onInvalid, onSend } = await submit({
    clientIdempotencyKey: "key-1",
    content: "hello",
    kind: "selected-text",
    link: "https://example.com/a",
    originUrl: "https://example.com/a",
  });
  expect(onInvalid).not.toHaveBeenCalled();
  expect(onSend).toHaveBeenCalledWith("p1");
});

test("a screenshot without a staged image is rejected before sending", async () => {
  const { onInvalid, onSend } = await submit({
    clientIdempotencyKey: "key-2",
    content: "",
    kind: "screenshot",
    originUrl: "https://example.com/a",
  });
  expect(onInvalid).toHaveBeenCalled();
  expect(onSend).not.toHaveBeenCalled();
});
