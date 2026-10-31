import {
  PERSONAL_DATA_ERASE_REASON,
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
  PERSONAL_DATA_VALUE_MAX_LENGTH,
  type PersonalDataActor,
  PersonalDataError,
  type PersonalDataGrantConsumer,
  type PersonalDataRedaction,
  type PersonalDataSnapshot,
} from "@cantiara/api/personal-data-rights";
import {
  REDACTED_VALUE_MARK,
  redactJson,
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocator,
  type SecurityRedactionLocatorKind,
  SecurityRedactionSpreadIncompleteError,
  type SecurityRedactionTargetOutcome,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";

/**
 * Erase orchestration of Personal Data Rights: which values go to Security
 * Redaction (78), how its outcomes are merged and how its refusals map. The
 * Account scope is the narrowest 78 offers for a Contact (it takes `Account`
 * or `Project`, never a Contact), so a short name can also match text outside
 * the Contact's records; the preview lists those copies by location first.
 */

/**
 * The personal values the erase hands to Security Redaction, longest first so
 * a message that contains a name is removed before the name itself.
 * `oversized` counts values above the 78 limit: 78 cannot take them, so the
 * tombstone clears them from the Contact's own Feedback and the result and
 * preview say so instead of claiming every copy was searched.
 */
export function personalValues(snapshot: PersonalDataSnapshot): {
  oversized: number;
  values: string[];
} {
  const candidates = [
    snapshot.contact.displayName,
    ...snapshot.contact.emails,
    ...snapshot.feedback.map((item) => item.originalMessage),
  ];
  const unique = new Set<string>();
  const oversized = new Set<string>();
  for (const value of candidates) {
    if (!value) {
      continue;
    }
    const target =
      value.length <= PERSONAL_DATA_VALUE_MAX_LENGTH ? unique : oversized;
    target.add(value);
  }
  return {
    oversized: oversized.size,
    values: [...unique].sort(
      (a, b) => b.length - a.length || a.localeCompare(b),
    ),
  };
}

const ERASE_NOTICES = [
  "Erasing is irreversible. The name, email aliases and original messages are removed from every place listed, and no restore brings them back.",
  "A content-free tombstone stays so ids, times and links keep their shape.",
  "This is not Trash and not Account closure: the record is not moved anywhere, and your Account and Workspace stay as they are.",
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
];

/** The preview notices, plus a plain gap line when a message is over the 78 limit. */
export function eraseNotices(oversized: number): string[] {
  if (oversized === 0) {
    return ERASE_NOTICES;
  }
  return [
    ...ERASE_NOTICES,
    `${oversized} original ${oversized === 1 ? "message is" : "messages are"} longer than Security Redaction accepts. ${oversized === 1 ? "It is" : "They are"} cleared from the Contact's own Feedback, but copies elsewhere are not searched.`,
  ];
}

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

export function sameLocator(
  a: SecurityRedactionLocator,
  b: SecurityRedactionLocator,
) {
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
export async function redactValues({
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

const SESSION_FREE_TEXT_FIELDS = ["consentNote", "questionGuide", "scopeNote"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The content-free Research Session of an erased participant: the captured
 * notes (quotes, observations, identifying notes, Founder interpretation) and
 * the free-text fields become the mark, and the personal values are redacted
 * from whatever text remains. Ids, kinds, times, consent, status and the
 * session `revision` stay, so history keeps its shape.
 */
export function contentFreeSession(
  data: unknown,
  values: readonly string[],
): unknown {
  const session = asRecord(data);
  if (!session) {
    return data;
  }
  const next: Record<string, unknown> = { ...session };
  for (const field of SESSION_FREE_TEXT_FIELDS) {
    if (typeof next[field] === "string" && next[field] !== "") {
      next[field] = REDACTED_VALUE_MARK;
    }
  }
  if (Array.isArray(next.content)) {
    next.content = next.content.map((entry) => {
      const captured = asRecord(entry);
      const content = asRecord(captured?.content);
      if (!(captured && content) || content.kind === "File Attachment") {
        return entry;
      }
      return {
        ...captured,
        content: {
          ...content,
          ...(typeof content.text === "string"
            ? { text: REDACTED_VALUE_MARK }
            : {}),
          ...(typeof content.speakerLabel === "string"
            ? { speakerLabel: REDACTED_VALUE_MARK }
            : {}),
        },
      };
    });
  }
  let result: unknown = next;
  for (const value of values) {
    result = redactJson(result, value).value;
  }
  return result;
}

/**
 * The content-free pinned text of one evidence binding: the captured excerpt
 * and the before/after context become the mark and the range collapses onto
 * the mark, so a stored pin still satisfies `versionPinnedEvidenceSchema`
 * (`end - start === excerpt.length`) when a read reparses it. The bound source
 * identity stays, so the link keeps its shape. Idempotent.
 */
export function contentFreePin(pin: unknown): unknown {
  const pinned = asRecord(pin);
  if (
    !pinned ||
    typeof pinned.excerpt !== "string" ||
    pinned.excerpt === REDACTED_VALUE_MARK
  ) {
    return pin;
  }
  return {
    ...pinned,
    before: "",
    after: "",
    excerpt: REDACTED_VALUE_MARK,
    start: 0,
    end: REDACTED_VALUE_MARK.length,
  };
}
