import { stripSecrets } from "@cantiara/api/data-export-secrets";
import {
  PERSONAL_DATA_EXCLUSIONS,
  PERSONAL_DATA_PACKAGE_NOTICE,
  type PersonalDataArtifact,
  PersonalDataError,
  type PersonalDataFormat,
  type PersonalDataPreviewSource,
  type PersonalDataReader,
  type PersonalDataRightsAccess,
  type PersonalDataSnapshot,
  personalDataPreviewInputSchema,
  personalDataProduceInputSchema,
} from "@cantiara/api/personal-data-rights";

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

/**
 * Personal Data Rights: the readable person package of one Contact. The reader
 * is the only adapter; this module closes the world (five listed sources),
 * strips Secret class values with the Selected Export rule, and produces only
 * for the fingerprint of a preview the founder saw.
 */
export function createPersonalDataRights(
  reader: PersonalDataReader,
): PersonalDataRightsAccess {
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

  return {
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
