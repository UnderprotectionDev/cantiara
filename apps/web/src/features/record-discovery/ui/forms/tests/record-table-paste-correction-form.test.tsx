// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import RecordTablePasteCorrectionForm, {
  recordTablePasteCorrectionFormId,
} from "../record-table-paste-correction-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("Correct row hands over only the edited fields", async () => {
  const onCorrect = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <RecordTablePasteCorrectionForm
          fields={[
            {
              choices: undefined,
              currentValue: "",
              field: "plannedStartDate",
              label: "Planned start date",
            },
            {
              choices: undefined,
              currentValue: "Launch",
              field: "title",
              label: "Title",
            },
          ]}
          onCorrect={onCorrect}
          rowIndex={0}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>(
      '[aria-label="Correct Planned start date in row 1"]',
    );
    if (!input) {
      throw new Error("Correction control required");
    }
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "2026-02-02");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve(
        host
          .querySelector(`#${recordTablePasteCorrectionFormId(0)}`)
          ?.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
      );
    });
    expect(onCorrect).toHaveBeenCalledWith({
      plannedStartDate: "2026-02-02",
    });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
