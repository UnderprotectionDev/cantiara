// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiagramVersionForm } from "../diagram-version-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function typeInto(input: HTMLInputElement | null, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: Element | null) {
  await act(async () => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const rejected = () => Promise.reject(new Error("write failed"));
const succeeded = () => Promise.resolve();

describe("Diagram Version form submission outcome", () => {
  test("Diagram Version name stays after a rejected create and clears after a successful one", async () => {
    act(() =>
      root.render(<DiagramVersionForm disabled={false} onCreate={rejected} />),
    );
    const input = container.querySelector<HTMLInputElement>("input");
    typeInto(input, "Before split");
    await submit(container.querySelector("form"));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
      "Before split",
    );

    act(() =>
      root.render(<DiagramVersionForm disabled={false} onCreate={succeeded} />),
    );
    await submit(container.querySelector("form"));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("");
  });
});
