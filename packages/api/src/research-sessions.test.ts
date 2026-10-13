import { expect, test } from "vitest";
import {
  captureResearchSessionContent,
  researchSessionConsentGates,
  researchSessionConvertPreview,
  researchSessionFieldsSchema,
  researchSessionRecordSchema,
  researchSessionSnapshotPreview,
} from "./research-sessions";

test.each(["Not asked", "Not allowed"] as const)(
  "%s closes every protected Research Session gate",
  (consent) => {
    expect(researchSessionConsentGates(consent)).toEqual({
      quote: false,
      identifyingNote: false,
      file: false,
      share: false,
      publish: false,
      convert: false,
    });
  },
);
test.each(["Allowed", "Not applicable"] as const)(
  "%s opens consent gates without replacing convert preview",
  (consent) => {
    expect(researchSessionConsentGates(consent)).toEqual({
      quote: true,
      identifyingNote: true,
      file: true,
      share: true,
      publish: true,
      convert: true,
    });
  },
);
test("Research Session is Project scoped and does not require a Contact", () => {
  expect(
    researchSessionFieldsSchema.parse({
      title: "Export interview",
      purpose: "Understand export needs",
      questionGuide: "Which formats?",
    }),
  ).toMatchObject({
    status: "Planned",
    consent: "Not asked",
    participantContactId: null,
  });
  for (const status of ["Invited", "Attended", "Active"]) {
    expect(
      researchSessionFieldsSchema.safeParse({
        title: "Interview",
        purpose: "Export",
        questionGuide: "Formats?",
        status,
      }).success,
    ).toBe(false);
  }
});

test("an unconsented capture cannot gain bytes, speaker labels, counts or relation hints after permission expands", () => {
  const blocked = {
    kind: "Participant quote",
    id: "quote-1",
    text: "Private participant words",
    speakerLabel: "Private founder",
    relationIds: ["contact-private"],
  };
  expect(() => captureResearchSessionContent("Not allowed", blocked)).toThrow(
    "Consent",
  );
  const legacy = { content: blocked, consentAtCapture: "Not allowed" };
  const session = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "session-1",
    projectId: "project-1",
    sourceType: "Research Session",
    revision: 2,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedBy: "founder-1",
    consentRecordedAt: instant,
    consent: "Allowed",
    content: [legacy],
  });
  expect(
    researchSessionSnapshotPreview(session, {
      contentIds: ["quote-1"],
      participant: false,
      consent: false,
    }),
  ).toEqual([]);
});

const instant = "2026-10-10T10:00:00.000Z";
const sessionFields = {
  title: "Interview",
  purpose: "Understand export",
  questionGuide: "Formats?",
};

test("snapshot selection is closed world, detached, and suppressed again after Consent is revoked", () => {
  const captured = captureResearchSessionContent("Allowed", {
    id: "quote-allowed",
    kind: "Participant quote",
    text: "Use CSV",
    speakerLabel: "Participant A",
    relationIds: ["private-contact"],
  });
  const session = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "session-1",
    projectId: "project-1",
    sourceType: "Research Session",
    revision: 1,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedBy: "founder-1",
    consentRecordedAt: instant,
    consent: "Allowed",
    participantContactId: "private-contact",
    participantConsentAtLink: "Not asked",
    content: [captured],
  });
  expect(
    researchSessionSnapshotPreview(session, {
      contentIds: [],
      participant: true,
      consent: false,
    }),
  ).toEqual([]);
  const snapshot = researchSessionSnapshotPreview(session, {
    contentIds: ["quote-allowed"],
    participant: false,
    consent: false,
  });
  expect(snapshot).toEqual([
    {
      id: "quote-allowed",
      kind: "Participant quote",
      text: "Use CSV",
      speakerLabel: null,
      relationIds: [],
    },
  ]);
  const [capturedQuote] = session.content;
  if (!capturedQuote) {
    throw new Error("Captured quote required");
  }
  capturedQuote.content.id = "changed";
  session.consent = "Not allowed";
  expect(
    researchSessionSnapshotPreview(session, {
      contentIds: ["changed"],
      participant: true,
      consent: true,
    }),
  ).toEqual([]);
  expect(snapshot[0]).toMatchObject({ id: "quote-allowed", text: "Use CSV" });
});

test.each(["Not asked", "Not allowed", "Allowed", "Not applicable"] as const)(
  "convert preview reuses current and captured Consent for %s",
  (consent) => {
    const session = researchSessionRecordSchema.parse({
      ...sessionFields,
      id: "session-1",
      projectId: "project-1",
      sourceType: "Research Session",
      revision: 3,
      createdAt: instant,
      updatedAt: instant,
      consentRecordedBy: "founder-1",
      consentRecordedAt: instant,
      consent,
      content: [
        captureResearchSessionContent("Allowed", {
          kind: "Participant quote",
          id: "q1",
          text: "Use CSV",
        }),
      ],
    });
    if (consent === "Not asked" || consent === "Not allowed") {
      expect(() => researchSessionConvertPreview(session, "q1")).toThrow(
        "Consent",
      );
    } else {
      expect(researchSessionConvertPreview(session, "q1")).toMatchObject({
        sessionId: "session-1",
        sessionRevision: 3,
        content: { id: "q1", text: "Use CSV" },
      });
      const [capturedQuote] = session.content;
      if (!capturedQuote) {
        throw new Error("Captured quote required");
      }
      capturedQuote.consentAtCapture = "Not allowed";
      expect(() => researchSessionConvertPreview(session, "q1")).toThrow(
        "Consent",
      );
    }
  },
);
test("capture cannot accept client-supplied permission provenance", () => {
  expect(() =>
    captureResearchSessionContent("Allowed", {
      kind: "Participant quote",
      id: "q1",
      text: "Words",
      consentAtCapture: "Allowed",
    }),
  ).toThrow();
});

test("convert preview refuses a File Attachment as research text evidence", () => {
  const session = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "session-1",
    projectId: "project-1",
    sourceType: "Research Session",
    revision: 3,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedBy: "founder-1",
    consentRecordedAt: instant,
    consent: "Allowed",
    content: [
      captureResearchSessionContent("Allowed", {
        id: "attachment-1",
        kind: "File Attachment",
        fileId: "file-1",
        fileVersionId: "version-1",
      }),
    ],
  });
  expect(() => researchSessionConvertPreview(session, "attachment-1")).toThrow(
    "Choose a research note or quote.",
  );
});

test("Research Sessions captures Observation and Founder interpretation without turning them into participant words", () => {
  for (const kind of ["Observation", "Founder interpretation"] as const) {
    const captured = captureResearchSessionContent("Allowed", {
      id: kind,
      kind,
      text: "The export flow needs fewer steps.",
      containsPersonalInformation: true,
    });
    expect(captured.content).toEqual({
      id: kind,
      kind,
      text: "The export flow needs fewer steps.",
      containsPersonalInformation: true,
      relationIds: [],
    });
    expect(() =>
      captureResearchSessionContent("Allowed", {
        ...captured.content,
        speakerLabel: "Contact name",
        sentiment: "positive",
      }),
    ).toThrow();
  }
});

test.each(["Not asked", "Not allowed"] as const)(
  "%s permits only explicitly nonpersonal observations and interpretations",
  (consent) => {
    for (const kind of ["Observation", "Founder interpretation"] as const) {
      expect(() =>
        captureResearchSessionContent(consent, {
          id: kind,
          kind,
          text: "Private address",
        }),
      ).toThrow("Consent");
      expect(() =>
        captureResearchSessionContent(consent, {
          id: kind,
          kind,
          text: "Private address",
          containsPersonalInformation: true,
        }),
      ).toThrow("Consent");
      expect(
        captureResearchSessionContent(consent, {
          id: kind,
          kind,
          text: "The button was hard to find",
          containsPersonalInformation: false,
        }),
      ).toMatchObject({
        content: { kind, containsPersonalInformation: false },
        consentAtCapture: consent,
      });
    }
    expect(() =>
      captureResearchSessionContent(consent, {
        id: "q",
        kind: "Participant quote",
        text: "Words",
        containsPersonalInformation: false,
      }),
    ).toThrow();
  },
);

test("new snapshot candidates never disclose a Speaker label even with participant selection", () => {
  const session = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "s",
    projectId: "p",
    sourceType: "Research Session",
    revision: 1,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedAt: instant,
    consentRecordedBy: "founder",
    consent: "Allowed",
    participantContactId: "contact",
    participantConsentAtLink: "Allowed",
    content: [
      captureResearchSessionContent("Allowed", {
        id: "q",
        kind: "Participant quote",
        text: "Use CSV",
        speakerLabel: "Private Contact email",
      }),
    ],
  });
  for (const participant of [true, false]) {
    const preview = researchSessionSnapshotPreview(session, {
      contentIds: ["q"],
      participant,
      consent: false,
    });
    expect(JSON.stringify(preview)).not.toContain("Private Contact email");
    expect(preview[0]).toMatchObject({
      kind: "Participant quote",
      text: "Use CSV",
      speakerLabel: null,
    });
  }
});

test("Research Sessions previews an exact range, target fields and Origin without changing the note", async () => {
  const { previewResearchSessionBinding } = await import(
    "./research-session-bindings"
  );
  const session = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "session-1",
    projectId: "project-1",
    sourceType: "Research Session",
    revision: 3,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedBy: "founder-1",
    consentRecordedAt: instant,
    consent: "Allowed",
    content: [
      captureResearchSessionContent("Allowed", {
        id: "q1",
        kind: "Participant quote",
        text: "Please use CSV exports today.",
      }),
    ],
  });
  const plan = previewResearchSessionBinding(session, {
    id: session.id,
    projectId: session.projectId,
    baseRevision: 3,
    clientIdempotencyKey: "preview-1",
    contentId: "q1",
    start: 11,
    end: 22,
    target: {
      mode: "create",
      type: "Assumption",
      projectId: "project-2",
      title: "CSV demand",
    },
  });
  expect(plan).toMatchObject({
    pin: {
      source: { recordId: "session-1", revision: 3, componentId: "q1" },
      start: 11,
      end: 22,
      excerpt: "CSV exports",
    },
    target: {
      mode: "create",
      type: "Assumption",
      projectId: "project-2",
      title: "CSV demand",
    },
    fields: { title: "CSV demand", statement: "CSV exports" },
    origin: { kind: "Origin", sourceRecordId: "session-1" },
  });
  const [original] = session.content;
  if (!original) {
    throw new Error("Note required");
  }
  original.content = {
    id: "q1",
    kind: "Observation",
    text: "Changed",
    relationIds: [],
    containsPersonalInformation: false,
  };
  session.revision = 4;
  expect(plan.pin.excerpt).toBe("CSV exports");
  expect(plan.pin.source.revision).toBe(3);
});

test("research pin refuses whitespace-only selections before creating any preview", async () => {
  const { previewResearchSessionBinding } = await import(
    "./research-session-bindings"
  );
  const record = researchSessionRecordSchema.parse({
    ...sessionFields,
    id: "s",
    projectId: "p",
    sourceType: "Research Session",
    revision: 1,
    createdAt: instant,
    updatedAt: instant,
    consentRecordedBy: "founder",
    consentRecordedAt: instant,
    consent: "Allowed",
    content: [
      captureResearchSessionContent("Allowed", {
        id: "n",
        kind: "Participant quote",
        text: "CSV   exports",
      }),
    ],
  });
  expect(() =>
    previewResearchSessionBinding(record, {
      id: "s",
      projectId: "p",
      baseRevision: 1,
      clientIdempotencyKey: "preview",
      contentId: "n",
      start: 3,
      end: 6,
      target: {
        mode: "create",
        type: "Feedback",
        projectId: "p",
        title: "CSV",
      },
    }),
  ).toThrow();
});
