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
      speakerLabel: "Participant A",
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
