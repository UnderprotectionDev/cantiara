// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { DocumentFormulaPopover } from "../document-formula-form";

async function submitFormula(latex: string) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const run = vi.fn();
  const insertInlineMath = vi.fn(() => ({ run }));
  const chain = {
    focus: vi.fn(() => ({ insertBlockMath: vi.fn(), insertInlineMath })),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <DocumentFormulaPopover editor={{ chain: () => chain } as any} />,
    ),
  );
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('button[aria-label="Insert formula"]')
      ?.click(),
  );
  const input = document.body.querySelector<HTMLInputElement>(
    "#document-formula-latex",
  ) as HTMLInputElement;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, latex);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return Promise.resolve();
  });
  await act(() => {
    document.body
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });
  const alert = document.body.querySelector('[role="alert"]')?.textContent;
  await act(async () => root.unmount());
  host.remove();
  return { alert, insertInlineMath };
}

test("an empty formula shows the schema message and inserts nothing", async () => {
  const { alert, insertInlineMath } = await submitFormula("   ");
  expect(alert).toBe("LaTeX is required.");
  expect(insertInlineMath).not.toHaveBeenCalled();
});

test("a formula is inserted trimmed", async () => {
  const { insertInlineMath } = await submitFormula(" x^2 ");
  expect(insertInlineMath).toHaveBeenCalledWith({ latex: "x^2" });
});
