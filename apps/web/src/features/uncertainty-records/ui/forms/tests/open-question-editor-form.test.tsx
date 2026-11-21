// @vitest-environment happy-dom

import { ORPCError } from "@orpc/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { act, type ComponentProps, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { OpenQuestionEditor } from "../open-question-editor-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const noop = () => undefined;
const save = async () => undefined;
const record = {
  id: "question-1",
  projectId: "project-1",
  sourceType: "Open Question" as const,
  title: "Preferred cadence",
  question: "Which cadence?",
  context: "Pilot",
  life: "Answered" as const,
  answer: "Weekly",
  rationale: "Three interviews",
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-09T10:00:00.000Z",
  revision: 2,
};

let mountedRoot: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  host?.remove();
  mountedRoot = undefined;
  host = undefined;
});

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(textarea),
    "value",
  )?.set;
  if (!setter) {
    throw new Error("Textarea value setter is unavailable.");
  }
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

test("Uncertainty Records answer form requires an answer and offers optional rationale and evidence", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionEditor
      documents={[]}
      onCancel={noop}
      onSave={save}
      record={record}
    />,
  );
  expect(html).toContain("Answer");
  expect(html).toContain("Rationale (optional)");
  expect(html).toContain("Evidence (optional)");
  expect(html).toContain("Cancel");
});

test.each([
  { code: "INTERNAL_SERVER_ERROR", conflict: false },
  { code: "CONFLICT", conflict: true },
])(
  "Open Question retains entered answer and rationale after $code",
  async ({ code, conflict }) => {
    host = document.createElement("div");
    document.body.append(host);
    mountedRoot = createRoot(host);
    const onSave = vi.fn<ComponentProps<typeof OpenQuestionEditor>["onSave"]>(
      () => Promise.reject(new ORPCError(code)),
    );
    const queryClient = new QueryClient();
    function Editor() {
      const saveMutation = useMutation({
        mutationFn: (input: Parameters<typeof onSave>) => onSave(...input),
      });
      const { mutateAsync } = saveMutation;
      const saveDraft = useCallback(
        (...input: Parameters<typeof onSave>) => mutateAsync(input),
        [mutateAsync],
      );
      return (
        <OpenQuestionEditor
          documents={[]}
          onCancel={noop}
          onSave={saveDraft}
          record={{ ...record, answer: "", life: "Open", rationale: "" }}
          writeError={saveMutation.error}
        />
      );
    }
    await act(() => {
      mountedRoot?.render(
        <QueryClientProvider client={queryClient}>
          <Editor />
        </QueryClientProvider>,
      );
    });

    const answer = host.querySelector<HTMLTextAreaElement>("#question-answer");
    const rationale = host.querySelector<HTMLTextAreaElement>(
      "#question-rationale",
    );
    const saveButton = host.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!answer) {
      throw new Error("Open Question answer form did not render.");
    }
    if (!rationale) {
      throw new Error("Open Question rationale field did not render.");
    }
    if (!saveButton) {
      throw new Error("Open Question Save button did not render.");
    }

    await act(() => {
      setTextareaValue(answer, "Every other week");
      setTextareaValue(rationale, "The pilot showed a stable cadence.");
      saveButton.click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "Every other week",
        rationale: "The pilot showed a stable cadence.",
      }),
      expect.objectContaining({ id: record.id }),
    );
    await vi.waitFor(() => {
      expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
        "Your text is kept here.",
      );
    });
    expect(answer.value).toBe("Every other week");
    expect(rationale.value).toBe("The pilot showed a stable cadence.");
    expect(saveButton.disabled).toBe(conflict);
    act(() => setTextareaValue(answer, "Every week"));
    expect(saveButton.disabled).toBe(conflict);
    if (conflict) {
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        "Cancel and reopen before saving.",
      );
    }
  },
);
