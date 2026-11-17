// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AddNodeForm } from "../add-node-form";

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

describe("Add Node form submission outcome", () => {
  test("Node label stays after a rejected save and clears after a successful one", async () => {
    const model = { links: [], nodes: [] };
    act(() =>
      root.render(
        <AddNodeForm disabled={false} model={model} onSave={rejected} />,
      ),
    );
    typeInto(container.querySelector("input"), "API");
    await submit(container.querySelector("form"));
    expect(container.querySelector("input")?.value).toBe("API");

    act(() =>
      root.render(
        <AddNodeForm disabled={false} model={model} onSave={succeeded} />,
      ),
    );
    await submit(container.querySelector("form"));
    expect(container.querySelector("input")?.value).toBe("");
  });
});
