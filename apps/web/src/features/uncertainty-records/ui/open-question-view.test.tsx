// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import { OpenQuestionDetail, OpenQuestionEditor } from "./open-question-view";
import OpenQuestionsSurface from "./open-questions-surface";

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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )?.set;
  if (!setter) {
    throw new Error("Input value setter is unavailable.");
  }
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

test("Uncertainty Records shows missing evidence without hiding the answer or blocking explicit closure", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionDetail
      evidence={[]}
      onAnswer={noop}
      onClose={save}
      record={record}
    />,
  );
  expect(html).toContain("Which cadence?");
  expect(html).toContain("Weekly");
  expect(html).toContain("Three interviews");
  expect(html).toContain("No evidence linked.");
  expect(html).toContain("No longer applicable");
  expect(html).not.toContain("Create Decision");
});
test("Uncertainty Records keeps historical answer and exact evidence visible when read-only", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionDetail
      evidence={[
        {
          documentId: "doc",
          documentRevision: 1,
          selectedText: "Pilot result",
          selectionStart: 0,
          selectionEnd: 12,
        },
      ]}
      onAnswer={noop}
      onClose={save}
      readOnly
      record={{ ...record, life: "No longer applicable" }}
    />,
  );
  expect(html).toContain("Weekly");
  expect(html).toContain("Pilot result");
  expect(html).toContain("Version 1");
  expect(html).not.toContain("<button");
});
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

test("Open Question errors retain entered answer and rationale", async () => {
  host = document.createElement("div");
  document.body.append(host);
  mountedRoot = createRoot(host);
  const onSave = vi.fn(() => Promise.reject(new Error("Save failed")));

  await act(() => {
    mountedRoot?.render(
      <OpenQuestionEditor
        documents={[]}
        onCancel={noop}
        onSave={onSave}
        record={{ ...record, answer: "", life: "Open", rationale: "" }}
      />,
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
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Your text is kept here.",
  );
  expect(answer.value).toBe("Every other week");
  expect(rationale.value).toBe("The pilot showed a stable cadence.");
});

test.each(["Create", "Answered"] as const)(
  "Open Question keeps the %s draft when a background records refresh fails",
  async (mode) => {
    const testHost = document.createElement("div");
    host = testHost;
    document.body.append(testHost);
    mountedRoot = createRoot(testHost);
    const { projectId } = record;
    const openRecord = {
      ...record,
      answer: "",
      life: "Open" as const,
      rationale: "",
    };
    const selectedRecord = mode === "Answered" ? openRecord : undefined;
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });
    const recordsQuery = orpc.openQuestions.queryOptions({
      input: { projectId },
    });
    const recordsData = {
      records: [selectedRecord ?? record],
      readOnly: false,
    };
    queryClient.setQueryData<typeof recordsData>(
      recordsQuery.queryKey,
      recordsData,
    );
    const documentsQuery = orpc.documents.queryOptions({
      input: { projectId },
    });
    queryClient.setQueryData(documentsQuery.queryKey, []);
    if (selectedRecord) {
      const contextQuery = orpc.openQuestionContext.queryOptions({
        input: {
          sourceId: selectedRecord.id,
          sourceType: "Open Question",
        },
      });
      const contextData = {
        evidence: [],
        readOnly: false,
      };
      queryClient.setQueryData<typeof contextData>(
        contextQuery.queryKey,
        contextData,
      );
    }

    await act(() => {
      mountedRoot?.render(
        <QueryClientProvider client={queryClient}>
          <OpenQuestionsSurface
            projectId={projectId}
            selectedId={selectedRecord?.id}
          />
        </QueryClientProvider>,
      );
    });

    const startButton = Array.from(testHost.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === mode,
    );
    if (!startButton) {
      throw new Error(`Open Question ${mode} action did not render.`);
    }
    await act(async () => startButton.click());

    if (mode === "Create") {
      const title = testHost.querySelector<HTMLInputElement>("#question-title");
      const question =
        testHost.querySelector<HTMLTextAreaElement>("#question-question");
      const context =
        testHost.querySelector<HTMLTextAreaElement>("#question-context");
      if (!(title && question && context)) {
        throw new Error("Open Question create form did not render.");
      }
      await act(() => {
        setInputValue(title, "Focus refresh draft");
        setTextareaValue(question, "Will it persist?");
        setTextareaValue(context, "Window focus refresh");
      });
    } else {
      const answer =
        testHost.querySelector<HTMLTextAreaElement>("#question-answer");
      const rationale = testHost.querySelector<HTMLTextAreaElement>(
        "#question-rationale",
      );
      if (!(answer && rationale)) {
        throw new Error("Open Question answer form did not render.");
      }
      await act(() => {
        setTextareaValue(answer, "Yes, it persists.");
        setTextareaValue(rationale, "The cached record remained available.");
      });
    }

    const editor = testHost.querySelector("form");
    const records = queryClient
      .getQueryCache()
      .find({ queryKey: recordsQuery.queryKey });
    if (!(editor && records)) {
      throw new Error("Open Question form or records query was unavailable.");
    }
    const refreshError = new Error("Temporarily unavailable");
    records.setOptions({
      ...records.options,
      queryFn: () => Promise.reject(refreshError),
      retry: false,
    });
    await act(async () => {
      await records.fetch().catch(() => undefined);
    });

    expect(records.state.status).toBe("error");
    expect(records.observers).toHaveLength(1);
    expect(testHost.querySelector("form")).toBe(editor);
    await vi.waitFor(() => {
      expect(testHost.textContent).toContain(
        "Open Questions could not be refreshed. Your draft is safe.",
      );
    });
    if (mode === "Create") {
      expect(
        testHost.querySelector<HTMLInputElement>("#question-title")?.value,
      ).toBe("Focus refresh draft");
      expect(
        testHost.querySelector<HTMLTextAreaElement>("#question-question")
          ?.value,
      ).toBe("Will it persist?");
      expect(
        testHost.querySelector<HTMLTextAreaElement>("#question-context")?.value,
      ).toBe("Window focus refresh");
    } else {
      expect(
        testHost.querySelector<HTMLTextAreaElement>("#question-answer")?.value,
      ).toBe("Yes, it persists.");
      expect(
        testHost.querySelector<HTMLTextAreaElement>("#question-rationale")
          ?.value,
      ).toBe("The cached record remained available.");
    }
  },
);
