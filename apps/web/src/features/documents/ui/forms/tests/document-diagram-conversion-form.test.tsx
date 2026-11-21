// @vitest-environment happy-dom
import type { MermaidConversionInput } from "@cantiara/api/technical-diagrams";
import { Dialog, DialogContent } from "@cantiara/ui/components/dialog";
import {
  QueryClient,
  QueryClientProvider,
  skipToken,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import DocumentDiagramConversionDialog from "../document-diagram-conversion-form";

const requestPreview = vi.fn(
  async (input: MermaidConversionInput, _signal: AbortSignal) => ({
    blockEnd: input.blockEnd,
    blockStart: input.blockStart,
    canConvert: true,
    documentRevision: input.documentRevision,
    model: { links: [], nodes: [] },
    originalBlock: input.originalBlock,
    previewToken: `preview:${input.title}`,
    source: { blockLine: 1 },
    title: input.title,
    unparseableLines: [],
  }),
);

vi.mock("@/utils/orpc", () => ({
  orpc: {
    previewMermaidConversion: {
      queryOptions: ({
        input,
      }: {
        input: MermaidConversionInput | typeof skipToken;
      }) => ({
        queryKey: ["preview", input],
        queryFn:
          input === skipToken
            ? skipToken
            : ({ signal }: { signal: AbortSignal }) =>
                requestPreview(input, signal),
      }),
    },
  },
}));

test("Convert to Technical Diagram requires the current preview and cancels pending title work on close", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const mutateAsync = vi
    .fn()
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockResolvedValue(undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const cache = new QueryClient();
  const conversionKey = { current: null };
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const render = (open: boolean) =>
    act(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <Dialog open={open}>
            <DialogContent>
              <DocumentDiagramConversionDialog
                conversionKey={conversionKey}
                conversionSelection={{ end: 10, revision: 1, start: 0 }}
                diagramWrite={{
                  isError: false,
                  isPending: false,
                  error: null,
                  mutateAsync,
                }}
                open={open}
                record={{ id: "doc-1", title: "Original" }}
              />
            </DialogContent>
          </Dialog>
        </QueryClientProvider>,
      ),
    );
  try {
    await render(true);
    await advance(20);
    const field = document.querySelector<HTMLInputElement>(
      "#converted-diagram-title",
    );
    const submit = document.querySelector<HTMLButtonElement>(
      'button[form="convert-diagram-form"]',
    );
    if (!(field && submit)) {
      throw new Error("Conversion controls are missing");
    }
    const type = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });

    expect(submit.disabled).toBe(false);
    await type("   ");
    expect(submit.disabled).toBe(true);
    await type("Che");
    await advance(100);
    await type(" Checkout flow ");
    expect(field.value).toBe(" Checkout flow ");
    expect(
      document.querySelector('[aria-label="Conversion preview"]'),
    ).toBeNull();
    await act(() =>
      document
        .querySelector("#convert-diagram-form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(requestPreview.mock.calls.map(([input]) => input.title)).toEqual([
      "Original",
    ]);
    await advance(260);
    await advance(10);
    expect(submit.disabled).toBe(false);
    await act(() => submit.click());
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Checkout flow",
        previewToken: "preview:Checkout flow",
      }),
    );

    await type("Checkout flow");
    await act(() => submit.click());
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1]?.[0]).toEqual(
      mutateAsync.mock.calls[0]?.[0],
    );

    await type("Discarded");
    await render(false);
    await advance(300);
    expect(requestPreview.mock.calls.map(([input]) => input.title)).toEqual([
      "Original",
      "Checkout flow",
    ]);
  } finally {
    await act(() => root.unmount());
    cache.clear();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
