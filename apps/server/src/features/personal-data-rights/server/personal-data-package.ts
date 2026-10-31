import { stripSecrets } from "@cantiara/api/data-export-secrets";
import {
  erasePersonalDataInputSchema,
  PERSONAL_DATA_ERASE_REASON,
  PERSONAL_DATA_EXCLUSIONS,
  PERSONAL_DATA_PACKAGE_NOTICE,
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
  PERSONAL_DATA_VALUE_MAX_LENGTH,
  type PersonalDataActor,
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
import {
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocator,
  type SecurityRedactionLocatorKind,
  SecurityRedactionSpreadIncompleteError,
  type SecurityRedactionTargetOutcome,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function contactLabel(snapshot: PersonalDataSnapshot): string {
  return (
    snapshot.contact.displayName ??
    snapshot.contact.emails[0] ??
    snapshot.contact.id
  );
}

function sources(snapshot: PersonalDataSnapshot): PersonalDataPreviewSource[] {
  return [
    {
      items: [{ id: snapshot.contact.id, label: contactLabel(snapshot) }],
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
      relatedEvidence: snapshot.evidence,
      research: snapshot.research,
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
      JSON.stringify(item.data, null, 2),
      "```",
      "",
    ]),
    "## Related evidence",
    "",
    ...body.relatedEvidence.map(
      (item) =>
        `- ${item.role}: ${item.sourceRecordId} -> ${item.targetRecordId} (${item.targetRecordType})${
          item.interpretation ? `, ${item.interpretation}` : ""
        }`,
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
 * The personal values the erase hands to Security Redaction, longest first so
 * a message that contains a name is removed before the name itself. A value
 * above the 78 limit is not passed as a locator; the tombstone still clears
 * it from the Contact's own Feedback.
 */
export function personalValues(snapshot: PersonalDataSnapshot): string[] {
  const candidates = [
    snapshot.contact.displayName,
    ...snapshot.contact.emails,
    ...snapshot.feedback.map((item) => item.originalMessage),
  ];
  const unique = new Set<string>();
  for (const value of candidates) {
    if (value && value.length <= PERSONAL_DATA_VALUE_MAX_LENGTH) {
      unique.add(value);
    }
  }
  return [...unique].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

const ERASE_NOTICES = [
  "Erasing is irreversible. The name, email aliases and original messages are removed from every place listed, and no restore brings them back.",
  "A content-free tombstone stays so ids, times and links keep their shape.",
  "This is not Trash and not Account closure: the record is not moved anywhere, and your Account and Workspace stay as they are.",
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
];

const STATUS_RANK: SecurityRedactionTargetOutcome["status"][] = [
  "not-wired",
  "no-stored-copy",
  "nothing-found",
  "removed",
];

/** `removed` outranks the quieter statuses when one target ran for several values. */
function mergedStatus(
  earlier: SecurityRedactionTargetOutcome["status"] | undefined,
  next: SecurityRedactionTargetOutcome["status"],
): SecurityRedactionTargetOutcome["status"] {
  return earlier && STATUS_RANK.indexOf(earlier) > STATUS_RANK.indexOf(next)
    ? earlier
    : next;
}

function sameLocator(a: SecurityRedactionLocator, b: SecurityRedactionLocator) {
  return (
    a.kind === b.kind &&
    a.location === b.location &&
    a.recordId === b.recordId &&
    a.recordKind === b.recordKind
  );
}

function redactionRefusal(error: unknown): unknown {
  if (error instanceof SecurityRedactionTypedNameMismatchError) {
    return new PersonalDataError("name_mismatch", { cause: error });
  }
  if (error instanceof SecurityRedactionGrantRejectedError) {
    return new PersonalDataError("grant_rejected", { cause: error });
  }
  if (error instanceof SecurityRedactionSpreadIncompleteError) {
    return new PersonalDataError("spread_incomplete", { cause: error });
  }
  return error;
}

/**
 * Calls Security Redaction apply once per personal value and sums the per
 * target outcomes. The shared `consumeOnce` makes every call ride on one
 * grant; a Contact with no value still consumes it, so the gate is the same.
 */
async function redactValues({
  actor,
  consumeOnce,
  input,
  redaction,
  values,
}: {
  actor: PersonalDataActor;
  consumeOnce: PersonalDataGrantConsumer;
  input: { grant: string; typedName: string };
  redaction: PersonalDataRedaction;
  values: readonly string[];
}): Promise<SecurityRedactionTargetOutcome[]> {
  const outcomes = new Map<
    SecurityRedactionLocatorKind,
    SecurityRedactionTargetOutcome
  >();
  try {
    if (values.length === 0 && !(await consumeOnce(input.grant))) {
      throw new SecurityRedactionGrantRejectedError();
    }
    for (const sensitiveValue of values) {
      // biome-ignore lint/performance/noAwaitInLoops: values apply in declared order, longest first.
      const result = await redaction.apply(
        actor,
        {
          grant: input.grant,
          reason: PERSONAL_DATA_ERASE_REASON,
          scope: { kind: "Account" },
          sensitiveValue,
          typedName: input.typedName,
        },
        () => consumeOnce(input.grant),
      );
      for (const target of result?.removal.targets ?? []) {
        const earlier = outcomes.get(target.kind);
        outcomes.set(target.kind, {
          copies: (earlier?.copies ?? 0) + target.copies,
          kind: target.kind,
          status: mergedStatus(earlier?.status, target.status),
        });
      }
    }
  } catch (error) {
    throw redactionRefusal(error);
  }
  return [...outcomes.values()];
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
      const values = personalValues(snapshot);
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
      const tombstone = await eraser.tombstone(
        actor.accountId,
        snapshot.contact.id,
        values,
      );
      await options.audit?.record({
        accountId: actor.accountId,
        at: now().toISOString(),
        contactId: snapshot.contact.id,
        type: "personal-data.erased",
      });
      return {
        contactId: snapshot.contact.id,
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
      for (const sensitiveValue of personalValues(snapshot)) {
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
        contactLabel: contactLabel(snapshot),
        copies,
        fingerprint,
        notices: ERASE_NOTICES,
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
        contactLabel: contactLabel(snapshot),
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
          : markdownOf(body, contactLabel(snapshot));
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
