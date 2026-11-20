// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

vi.mock("@/utils/orpc", () => ({ client: {} }));

import DocumentDiagramConversionDialog from "../document-diagram-conversion-form";

async function submit(title: string) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <DocumentDiagramConversionDialog
        {...({
          conversionKey: { current: null },
          conversionPreview: { data: undefined, isError: false },
          conversionSelection: { end: 10, start: 0 },
          conversionTitle: title,
          convertDiagram: { isError: false, isPending: false, mutateAsync },
          originalBlockOutcome: "Keep independent",
          record: { title: "Doc" },
          setConversionSelection: vi.fn(),
          setConversionTitle: vi.fn(),
          setOriginalBlockOutcome: vi.fn(),
        } as any)}
      />,
    ),
  );
  await act(() => {
    document.body
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });
  await act(async () => root.unmount());
  host.remove();
  return mutateAsync;
}

test("converting submits through the form only with a valid title", async () => {
  expect(await submit("   ")).not.toHaveBeenCalled();
  expect(await submit("Checkout flow")).toHaveBeenCalledTimes(1);
});
