// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProductionIncidentForm } from "../production-incident-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

type Submit = ComponentProps<typeof ProductionIncidentForm>["onSubmit"];

function mount(onSubmit: Submit) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProductionIncidentForm
        mode="create"
        onSubmit={onSubmit}
        timeZone="UTC"
      />,
    );
  });
}

function type(id: string, value: string) {
  const input = host?.querySelector(`#${id}`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Record Production Incident form submit", () => {
  test("sends the trimmed title and the occurrence time to the create command", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(onSubmit);
    type("production-incident-title", "  Checkout outage  ");
    type("production-incident-occurred-at", "2026-10-19T08:30");
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      occurredAt: "2026-10-19T08:30:00.000Z",
      title: "Checkout outage",
    });
  });

  test("a missing title is refused with an alert and no create command", async () => {
    const onSubmit = vi.fn<Submit>(async () => undefined);
    mount(onSubmit);
    type("production-incident-title", "   ");
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')).not.toBeNull();
  });
});
