import { stripSecrets } from "@cantiara/api/data-export-secrets";
import {
  erasePersonalDataInputSchema,
  PERSONAL_DATA_EXCLUSIONS,
  PERSONAL_DATA_PACKAGE_NOTICE,
  type PersonalDataArtifact,
  type PersonalDataAudit,
  type PersonalDataEraser,
  PersonalDataError,
  type PersonalDataFormat,
  type PersonalDataGrantConsumer,
  type PersonalDataPreviewSource,
  type PersonalDataReader,
  type PersonalDataRedaction,
  type PersonalDataRightsAccess,
  type PersonalDataSnapshot,
  personalDataErasePreviewInputSchema,
  personalDataPreviewInputSchema,
  personalDataProduceInputSchema,
} from "@cantiara/api/personal-data-rights";
import type {
  SecurityRedactionLocator,
  SecurityRedactionLocatorKind,
} from "@cantiara/api/security-redaction";
import {
  eraseNotices,
  personalValues,
  redactValues,
  sameLocator,
} from "./personal-data-erase";

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function personLabel(snapshot: PersonalDataSnapshot): string {
  return (
    snapshot.contact.displayName ??
    snapshot.contact.emails[0] ??
    snapshot.contact.id
  );
}

function sources(snapshot: PersonalDataSnapshot): PersonalDataPreviewSource[] {
  return [
    {
      items: [{ id: snapshot.contact.id, label: personLabel(snapshot) }],
      kind: "Contact",
    },
    {
      items: snapshot.contact.emails.map((email) => ({
        id: email,
        label: email,
      })),
      kind: "Email aliases",
    },
    {
      items: snapshot.feedback.map((item) => ({
        id: item.id,
        label: item.title,
      })),
      kind: "Feedback",
    },
    {
      items: snapshot.research.map((item) => ({
        id: item.id,
        label: item.title,
      })),
      kind: "Research",
    },
    {
      items: snapshot.evidence.map((item) => ({
        id: item.id,
        label: `${item.role}: ${item.sourceRecordId} -> ${item.targetRecordId}`,
      })),
      kind: "Related evidence",
    },
  ];
}

const PERSON_NOTE_KINDS = new Set([
  "Identifying personal note",
  "Observation",
  "Participant quote",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The Research Session as it concerns this Contact. Free text the founder
 * wrote about the session or about other people (purpose, question guide,
 * scope note, consent note, facilitator, Founder interpretation notes) and the
 * participant id stay out; what remains is when and how the session ran, the
 * consent and the notes captured about the participant.
 */
function researchView(data: unknown) {
  const session = record(data) ?? {};
  const notes = (Array.isArray(session.content) ? session.content : []).flatMap(
    (entry) => {
      const captured = record(entry);
      const content = record(captured?.content);
      if (!(content && PERSON_NOTE_KINDS.has(String(content.kind)))) {
        return [];
      }
      if (
        content.kind === "Observation" &&
        !content.containsPersonalInformation
      ) {
        return [];
      }
      return [
        {
          kind: content.kind,
          speakerLabel: content.speakerLabel ?? null,
          text: content.text,
        },
      ];
    },
  );
  return {
    channel: session.channel ?? null,
    consent: session.consent ?? null,
    durationMinutes: session.durationMinutes ?? null,
    notes,
    scheduledAt: session.scheduledAt ?? null,
    status: session.status ?? null,
    title: session.title ?? null,
  };
}

/** The package body: only the five listed sources, secrets stripped centrally. */
function packageBody(snapshot: PersonalDataSnapshot, removed: Set<string>) {
  return stripSecrets(
    {
      contact: {
        archivedAt: snapshot.contact.archivedAt,
        createdAt: snapshot.contact.createdAt,
        displayName: snapshot.contact.displayName,
        id: snapshot.contact.id,
        updatedAt: snapshot.contact.updatedAt,
      },
      emailAliases: snapshot.contact.emails,
      feedback: snapshot.feedback,
      // Ids, role and kind only: the founder's interpretation text may name others.
      relatedEvidence: snapshot.evidence.map((item) => ({
        createdAt: item.createdAt,
        id: item.id,
        role: item.role,
        sourceRecordId: item.sourceRecordId,
        targetRecordId: item.targetRecordId,
        targetRecordType: item.targetRecordType,
      })),
      research: snapshot.research.map((item) => ({
        id: item.id,
        ...researchView(item.data),
      })),
    },
    removed,
  );
}

function markdownOf(
  body: ReturnType<typeof packageBody>,
  label: string,
): string {
  const lines = [
    `# Personal data: ${label}`,
    "",
    PERSONAL_DATA_PACKAGE_NOTICE,
    "",
    "## Contact",
    "",
    "```json",
    JSON.stringify(body.contact, null, 2),
    "```",
    "",
    "## Email aliases",
    "",
    ...body.emailAliases.map((email) => `- ${email}`),
    "",
    "## Feedback",
    "",
    ...body.feedback.flatMap((item) => [
      `### ${item.title}`,
      "",
      `Status: ${item.status}. Occurred: ${item.occurredAt}.`,
      "",
      item.originalMessage,
      "",
    ]),
    "## Research",
    "",
    ...body.research.flatMap((item) => [
      `### ${item.title}`,
      "",
      "```json",
      JSON.stringify(item, null, 2),
      "```",
      "",
    ]),
    "## Related evidence",
    "",
    ...body.relatedEvidence.map(
      (item) =>
        `- ${item.role}: ${item.sourceRecordId} -> ${item.targetRecordId} (${item.targetRecordType})`,
    ),
    "",
  ];
  return lines.join("\n");
}

const MEDIA_TYPES: Record<PersonalDataFormat, string> = {
  JSON: "application/json",
  Markdown: "text/markdown",
};

/** What `createPersonalDataRights` calls besides the reader. */
export interface PersonalDataRightsOptions {
  audit?: PersonalDataAudit;
  eraser?: PersonalDataEraser;
  now?: () => Date;
  /** The Security Redaction (78) interface; the only removal path. */
  redaction?: PersonalDataRedaction;
}

/**
 * Personal Data Rights: the readable person package of one Contact and its
 * erase. The reader is the only package adapter; this module closes the world
 * (five listed sources), strips Secret class values with the Selected Export
 * rule, and produces only for the fingerprint of a preview the founder saw.
 * Erase never spreads on its own: it checks the typed Account name, consumes
 * the grant once and calls Security Redaction apply.
 */
export function createPersonalDataRights(
  reader: PersonalDataReader,
  options: PersonalDataRightsOptions = {},
): PersonalDataRightsAccess {
  const now = options.now ?? (() => new Date());

  async function load(accountId: string, contactId: string) {
    const snapshot = await reader.read(accountId, contactId);
    if (!snapshot) {
      throw new PersonalDataError("contact_not_found");
    }
    const removed = new Set<string>();
    const body = packageBody(snapshot, removed);
    return {
      body,
      fingerprint: await sha256(JSON.stringify(body)),
      removed,
      snapshot,
    };
  }

  function requireErase() {
    const { eraser, redaction } = options;
    if (!(eraser && redaction)) {
      throw new Error("Erase Personal Data is not configured.");
    }
    return { eraser, redaction };
  }

  return {
    async erase(actor, rawInput, consumeGrant) {
      const input = erasePersonalDataInputSchema.parse(rawInput);
      const { eraser, redaction } = requireErase();
      const { fingerprint, snapshot } = await load(
        actor.accountId,
        input.contactId,
      );
      if (fingerprint !== input.previewFingerprint) {
        throw new PersonalDataError("preview_required");
      }
      // Typing the name is its own step and runs before the grant, so a typo
      // never burns the one-time proof.
      if (input.typedName !== actor.accountName) {
        throw new PersonalDataError("name_mismatch");
      }
      const { values, oversized } = personalValues(snapshot);
      // The grant is bound to this erase and consumed exactly once, however
      // many values Security Redaction is called for.
      let consumed: Promise<boolean> | null = null;
      const consumeOnce: PersonalDataGrantConsumer = (grant) => {
        consumed ??= consumeGrant(grant);
        return consumed;
      };
      const outcomes = await redactValues({
        actor,
        consumeOnce,
        input,
        redaction,
        values,
      });
      // 78 already removed the other copies and cannot be undone: a failing
      // tombstone is a named refusal, never a silent partial erase.
      const tombstone = await eraser
        .tombstone(actor.accountId, snapshot.contact.id, values)
        .catch((error: unknown) => {
          throw new PersonalDataError("tombstone_incomplete", {
            cause: error,
          });
        });
      await options.audit?.record({
        accountId: actor.accountId,
        at: now().toISOString(),
        contactId: snapshot.contact.id,
        type: "personal-data.erased",
      });
      return {
        contactId: snapshot.contact.id,
        notRedacted: oversized,
        removal: outcomes,
        status: "erased",
        tombstone,
      };
    },
    async previewErase(actor, rawInput) {
      const input = personalDataErasePreviewInputSchema.parse(rawInput);
      const { redaction } = requireErase();
      const { fingerprint, snapshot } = await load(
        actor.accountId,
        input.contactId,
      );
      const copies: SecurityRedactionLocator[] = [];
      const notSearched = new Set<SecurityRedactionLocatorKind>();
      const { oversized, values } = personalValues(snapshot);
      for (const sensitiveValue of values) {
        // biome-ignore lint/performance/noAwaitInLoops: preview reads are cheap and ordered.
        const found = await redaction.preview(actor, {
          scope: { kind: "Account" },
          sensitiveValue,
        });
        for (const locator of found?.locators ?? []) {
          if (!copies.some((known) => sameLocator(known, locator))) {
            copies.push(locator);
          }
        }
        for (const kind of found?.notSearched ?? []) {
          notSearched.add(kind);
        }
      }
      return {
        contactId: snapshot.contact.id,
        contactLabel: personLabel(snapshot),
        copies,
        fingerprint,
        notices: eraseNotices(oversized),
        notSearched: [...notSearched],
        sources: sources(snapshot),
        typedNameTarget: { kind: "Account", name: actor.accountName },
      };
    },
    async preview(accountId, rawInput) {
      const input = personalDataPreviewInputSchema.parse(rawInput);
      const { fingerprint, snapshot } = await load(accountId, input.contactId);
      return {
        contactId: snapshot.contact.id,
        contactLabel: personLabel(snapshot),
        excluded: PERSONAL_DATA_EXCLUSIONS,
        fingerprint,
        notice: PERSONAL_DATA_PACKAGE_NOTICE,
        sources: sources(snapshot),
      };
    },
    async produce(accountId, rawInput): Promise<PersonalDataArtifact> {
      const input = personalDataProduceInputSchema.parse(rawInput);
      const { body, fingerprint, removed, snapshot } = await load(
        accountId,
        input.contactId,
      );
      if (fingerprint !== input.previewFingerprint) {
        throw new PersonalDataError("preview_required");
      }
      const bytes =
        input.format === "JSON"
          ? JSON.stringify(
              { notice: PERSONAL_DATA_PACKAGE_NOTICE, ...body },
              null,
              2,
            )
          : markdownOf(body, personLabel(snapshot));
      await options.audit?.record({
        accountId,
        at: now().toISOString(),
        contactId: snapshot.contact.id,
        type: "personal-data.exported",
      });
      return {
        bytes,
        fileName: `personal-data-${snapshot.contact.id}.${input.format === "JSON" ? "json" : "md"}`,
        format: input.format,
        mediaType: MEDIA_TYPES[input.format],
        secretsExcluded: [...removed].sort(),
      };
    },
  };
}
