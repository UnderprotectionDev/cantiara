// @vitest-environment happy-dom

import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import OpenQuestionsSurface from "../../components/open-questions-surface";
import { OpenQuestionDetail } from "../open-question-view";

const rpc = vi.hoisted(() => ({ answer: vi.fn() }));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { transitionProjectSourceRecord: rpc.answer },
  };
});

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

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

test("a stale Answered conflict cannot lock a different Open Question", async () => {
  const pending = Promise.withResolvers<never>();
  rpc.answer.mockReturnValueOnce(pending.promise);
  const testHost = document.createElement("div");
  host = testHost;
  document.body.append(testHost);
  mountedRoot = createRoot(testHost);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const { projectId } = record;
  const first = { ...record, life: "Open" as const, answer: "", rationale: "" };
  const second = { ...first, id: "question-2", title: "Second Open Question" };
  const openQuestions = { readOnly: false, records: [first, second] };
  queryClient.setQueryData<typeof openQuestions>(
    orpc.openQuestions.queryOptions({ input: { projectId } }).queryKey,
    openQuestions,
  );
  queryClient.setQueryData(
    orpc.documents.queryOptions({ input: { projectId } }).queryKey,
    [],
  );
  const questionContext = { evidence: [], readOnly: false };
  for (const question of [first, second]) {
    queryClient.setQueryData<typeof questionContext>(
      orpc.openQuestionContext.queryOptions({
        input: { sourceId: question.id, sourceType: "Open Question" },
      }).queryKey,
      questionContext,
    );
  }
  function render(selectedId: string) {
    act(() =>
      mountedRoot?.render(
        <QueryClientProvider client={queryClient}>
          <OpenQuestionsSurface projectId={projectId} selectedId={selectedId} />
        </QueryClientProvider>,
      ),
    );
  }
  function click(label: string) {
    const button = [...testHost.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button?.disabled).toBe(false);
    act(() => button?.click());
  }
  function type(text: string) {
    const answer =
      testHost.querySelector<HTMLTextAreaElement>("#question-answer");
    if (!answer) {
      throw new Error("No Answer control");
    }
    act(() => setTextareaValue(answer, text));
  }
  render(first.id);
  click("Answered");
  type("First draft");
  click("Save");
  await vi.waitFor(() =>
    expect(rpc.answer).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: first.id, answer: "First draft" }),
    ),
  );
  expect(
    [...testHost.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Cancel",
    )?.disabled,
  ).toBe(true);

  render(second.id);
  expect(testHost.querySelector("#question-answer")).toBeNull();
  click("Answered");
  type("Second draft");
  await act(async () => {
    pending.reject(new ORPCError("CONFLICT"));
    await pending.promise.catch(() => undefined);
  });
  expect(
    testHost.querySelector<HTMLTextAreaElement>("#question-answer")?.value,
  ).toBe("Second draft");
  expect(
    testHost.querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.disabled,
  ).toBe(false);
  expect(testHost.querySelector('[role="alert"]')).toBeNull();
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
