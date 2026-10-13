// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ResearchSessionNoteEditor } from "./research-session-notes";
import { ResearchSessionEditor } from "./research-sessions-view";

const cancel = () => undefined;
const save = async () => undefined;
test("Research Sessions shows four Consent choices, separate context and a consent gate explanation", () => {
  const html = renderToStaticMarkup(
    <ResearchSessionEditor
      onCancel={cancel}
      onSave={save}
      timeZone="Europe/Istanbul"
    />,
  );
  for (const label of [
    "Research Session",
    "Purpose",
    "Question guide",
    "Not asked",
    "Allowed",
    "Not allowed",
    "Not applicable",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain(
    "Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed.",
  );
  expect(html).toContain(
    "Consent is context, not a legal compliance judgment.",
  );
  expect(html).not.toContain("required Contact");
});

test("Research Sessions requires an explicit note type and explains each kind without a mixed body", () => {
  const html = renderToStaticMarkup(
    <ResearchSessionNoteEditor
      consent="Not allowed"
      onCancel={cancel}
      onSave={save}
    />,
  );
  expect(html).toContain("Choose note type");
  expect(html).toContain("Participant quote");
  expect(html).toContain("Observation");
  expect(html).toContain("Founder interpretation");
  expect(html).not.toContain("<textarea");
});

const unexpectedPreview = () => Promise.reject(new Error("Unexpected preview"));

test("conversion requires an explicit target type before preview and never starts with Confirm", async () => {
  const { ResearchNoteBindingEditor } = await import("./research-note-binding");
  const html = renderToStaticMarkup(
    <ResearchNoteBindingEditor
      mode="create"
      note={{
        id: "q1",
        kind: "Participant quote",
        text: "Use CSV",
        speakerLabel: null,
        relationIds: [],
      }}
      onCancel={cancel}
      onConfirm={unexpectedPreview}
      onPreview={unexpectedPreview}
      record={{
        id: "session-1",
        projectId: "project-1",
        revision: 3,
        title: "CSV interview",
      }}
      targets={{
        projects: [{ id: "project-1", name: "Research" }],
        records: [],
      }}
    />,
  );
  expect(html).toContain("Choose target type");
  expect(html).toContain("Selected text");
  expect(html).not.toContain(">Confirm<");
});

test("historical evidence shows lifecycle reasons and time, keeps accessible links and hides unavailable target titles", async () => {
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { researchSessionRecordSchema } = await import(
    "@cantiara/api/research-sessions"
  );
  const { researchEvidenceBindingSchema } = await import(
    "@cantiara/api/research-session-bindings"
  );
  const { ResearchSessionNotes } = await import("./research-session-notes");
  const record = researchSessionRecordSchema.parse({
    id: "session",
    projectId: "project",
    sourceType: "Research Session",
    consentRecordedBy: "account",
    consentRecordedAt: "2026-10-12T09:00:00.000Z",
    title: "Interview",
    purpose: "Research",
    consent: "Allowed",
    revision: 2,
    createdAt: "2026-10-12T09:00:00.000Z",
    updatedAt: "2026-10-12T09:00:00.000Z",
  });
  const reasons = [
    "Archived",
    "In Trash",
    "Permanently deleted",
    "No access",
  ] as const;
  const bindings = reasons.map((reason) =>
    researchEvidenceBindingSchema.parse({
      id: reason,
      pin: {
        source: {
          recordType: "Research Session",
          recordId: record.id,
          projectId: record.projectId,
          revision: 2,
          componentId: "note",
        },
        start: 0,
        end: 3,
        excerpt: "CSV",
        before: "",
        after: "",
      },
      target: {
        type: "Work",
        recordId: "target",
        projectId:
          reason === "Archived" || reason === "In Trash"
            ? "target-project"
            : null,
        label: null,
        brokenReason: reason,
        canOpenSourceRecord: reason === "Archived" || reason === "In Trash",
      },
      origin: true,
      actorId: "account",
      createdAt: "2026-10-12T09:00:00.000Z",
    }),
  );
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    ["research-session-evidence", record.projectId, record.id, record.revision],
    bindings,
  );
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ResearchSessionNotes
        bindingActions={{
          confirm: unexpectedPreview,
          preview: unexpectedPreview,
          targets: unexpectedPreview,
          list: async () => bindings,
        }}
        onSave={save}
        onStartEditing={cancel}
        readOnly={false}
        record={record}
      />
    </QueryClientProvider>,
  );
  for (const reason of reasons) {
    expect(html).toContain(reason);
  }
  expect(html).toContain('dateTime="2026-10-12T09:00:00.000Z"');
  expect(html.match(/Open source record/g)).toHaveLength(2);
  expect(html).toContain("/projects/target-project#work-target");
  expect(html).not.toContain("Private target title");
  queryClient.clear();
});

test("opening archived Feedback reads its native record and a failed fresh read never displays the cached body", async () => {
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { researchSessionRecordSchema } = await import(
    "@cantiara/api/research-sessions"
  );
  const { researchEvidenceBindingSchema } = await import(
    "@cantiara/api/research-session-bindings"
  );
  const { ResearchSessionNotes } = await import("./research-session-notes");
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { vi } = await import("vitest");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const record = researchSessionRecordSchema.parse({
    id: "feedback-session",
    projectId: "project",
    sourceType: "Research Session",
    consentRecordedBy: "account",
    consentRecordedAt: "2026-10-12T09:00:00.000Z",
    title: "Interview",
    purpose: "Research",
    consent: "Allowed",
    revision: 2,
    createdAt: "2026-10-12T09:00:00.000Z",
    updatedAt: "2026-10-12T09:00:00.000Z",
  });
  const binding = researchEvidenceBindingSchema.parse({
    id: "feedback-binding",
    pin: {
      source: {
        recordType: "Research Session",
        recordId: record.id,
        projectId: record.projectId,
        revision: 2,
        componentId: "note",
      },
      start: 0,
      end: 3,
      excerpt: "CSV",
      before: "",
      after: "",
    },
    target: {
      type: "Feedback",
      recordId: "feedback",
      projectId: "project",
      label: null,
      brokenReason: "Archived",
      canOpenSourceRecord: true,
    },
    origin: true,
    actorId: "account",
    createdAt: "2026-10-12T09:00:00.000Z",
  });
  const feedback = vi.fn().mockResolvedValue({
    id: "feedback",
    title: "CSV feedback",
    status: "Archived",
    originalMessage: "Private original feedback",
    channel: "Interview",
    occurredAt: "2026-10-12T09:00:00.000Z",
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    ["research-session-evidence", record.projectId, record.id, record.revision],
    [binding],
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function click(label: string) {
    const button = Array.from(document.querySelectorAll("button")).find(
      (item) => item.textContent === label,
    );
    if (!button) {
      throw new Error(`${label} control required`);
    }
    button.click();
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <ResearchSessionNotes
            bindingActions={{
              feedback,
              confirm: unexpectedPreview,
              preview: unexpectedPreview,
              targets: unexpectedPreview,
              list: async () => [binding],
            }}
            onSave={save}
            onStartEditing={cancel}
            readOnly={false}
            record={record}
          />
        </QueryClientProvider>,
      ),
    );
    expect(host.textContent).not.toContain("Private original feedback");
    await act(async () => click("Open source record"));
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "Private original feedback",
      );
    });
    await act(async () => click("Close"));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).toBeNull(),
    );
    feedback.mockRejectedValue(new Error("Access revoked"));
    await act(async () => click("Open source record"));
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "Source record is unavailable.",
      );
    });
    expect(
      document.querySelector('[role="dialog"]')?.textContent,
    ).not.toContain("Private original feedback");
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  }
});
