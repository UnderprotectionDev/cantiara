// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test props close over the recorded calls.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PlaceRecordForm } from "../place-record-form";

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

describe("Place Record form submission outcome", () => {
  test("Existing record choice stays after a rejected place", async () => {
    const free = [{ id: "w1", sourceType: "Work" as const, title: "Ship it" }];
    act(() =>
      root.render(
        <PlaceRecordForm disabled={false} free={free} onPlace={rejected} />,
      ),
    );
    const select = container.querySelector("select");
    act(() => {
      if (select) {
        select.value = "Work:w1";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await submit(container.querySelector("form"));
    expect(container.querySelector("select")?.value).toBe("Work:w1");

    act(() =>
      root.render(
        <PlaceRecordForm disabled={false} free={free} onPlace={succeeded} />,
      ),
    );
    await submit(container.querySelector("form"));
    expect(container.querySelector("select")?.value).toBe("");
  });
});
