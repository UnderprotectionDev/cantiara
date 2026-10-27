import { z } from "zod";

/**
 * Attention Signals (spec 71): the closed registry, the two Notification
 * Center sections and the pure grouping of stored signals. Producer features
 * own the trigger, negatives and close condition of their ids; this contract
 * only gates which ids may be minted and how they are presented.
 */

export const ATTENTION_SECTIONS = [
  "Action Required",
  "Information Flow",
] as const;
export type AttentionSection = (typeof ATTENTION_SECTIONS)[number];

/** `Needs Action` is a registry presentation class, not a third section. */
export type AttentionPresentationClass = AttentionSection | "Needs Action";

export const DEFAULT_OPEN_ATTENTION_SECTION: AttentionSection =
  "Action Required";

const registryRow = <const Id extends string>(
  id: Id,
  presentation: AttentionPresentationClass,
) => ({ id, presentation }) as const;

export const ATTENTION_SIGNAL_REGISTRY = [
  registryRow("due-date", "Action Required"),
  registryRow("reappear-date", "Action Required"),
  registryRow("personal-reminder", "Action Required"),
  registryRow("review-later", "Action Required"),
  registryRow("open-risk", "Action Required"),
  registryRow("work-blocked", "Needs Action"),
  registryRow("source-version-in-use", "Action Required"),
  registryRow("external-run-returned", "Action Required"),
  registryRow("release-observation-missing", "Action Required"),
  registryRow("github-check-failed", "Action Required"),
  registryRow("work-pr-status-conflict", "Action Required"),
  registryRow("unlinked-open-pr", "Action Required"),
  registryRow("published-release-open-scope", "Action Required"),
  registryRow("automation-failed", "Action Required"),
  registryRow("public-roadmap-review-due", "Action Required"),
  registryRow("unreviewed-test-report", "Action Required"),
  registryRow("test-result-conflict", "Action Required"),
  registryRow("handoff-result-after-cancel", "Information Flow"),
  registryRow("smart-collection-entry", "Information Flow"),
  registryRow("github-activity", "Information Flow"),
] as const;

export type AttentionSignalId =
  (typeof ATTENTION_SIGNAL_REGISTRY)[number]["id"];

export const ATTENTION_SIGNAL_IDS = ATTENTION_SIGNAL_REGISTRY.map(
  (row) => row.id,
) as [AttentionSignalId, ...AttentionSignalId[]];

const REGISTRY_BY_ID: ReadonlyMap<string, AttentionPresentationClass> = new Map(
  ATTENTION_SIGNAL_REGISTRY.map((row) => [row.id, row.presentation]),
);

export function isRegisteredAttentionSignalId(
  id: unknown,
): id is AttentionSignalId {
  return typeof id === "string" && REGISTRY_BY_ID.has(id);
}

export function attentionPresentationClass(
  id: AttentionSignalId,
): AttentionPresentationClass {
  const presentation = REGISTRY_BY_ID.get(id);
  if (!presentation) {
    throw new Error(`Unregistered attention signal id ${id}.`);
  }
  return presentation;
}

/** The one section a presentation class is shown in. */
export function attentionSectionForClass(
  presentation: AttentionPresentationClass,
): AttentionSection {
  return presentation === "Information Flow"
    ? "Information Flow"
    : "Action Required";
}

export function attentionSectionOf(id: AttentionSignalId): AttentionSection {
  return attentionSectionForClass(attentionPresentationClass(id));
}

const identity = z.string().trim().min(1).max(200);

/** The main source a signal belongs to; the unit of a Source group. */
export const attentionSourceGroupSchema = z
  .object({ id: identity, kind: identity })
  .strict();
export type AttentionSourceGroup = z.infer<typeof attentionSourceGroupSchema>;

/**
 * Emit input. The exact source event id and target id are both required; the
 * presentation class is never an input, so a producer cannot refile a signal.
 */
export const emitAttentionSignalInputSchema = z
  .object({
    eventId: identity,
    group: attentionSourceGroupSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    projectId: identity.nullable().default(null),
    reason: z.string().trim().min(1).max(500),
    signalId: z.enum(ATTENTION_SIGNAL_IDS),
    targetId: identity,
  })
  .strict();
export type EmitAttentionSignalInput = z.input<
  typeof emitAttentionSignalInputSchema
>;
export type ParsedEmitAttentionSignalInput = z.output<
  typeof emitAttentionSignalInputSchema
>;

export const attentionSignalSchema = z.object({
  closedAt: z.iso.datetime().nullable(),
  eventId: z.string(),
  group: attentionSourceGroupSchema,
  id: z.string(),
  occurredAt: z.iso.datetime(),
  presentation: z.enum(["Action Required", "Needs Action", "Information Flow"]),
  projectId: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  reason: z.string(),
  section: z.enum(ATTENTION_SECTIONS),
  signalId: z.enum(ATTENTION_SIGNAL_IDS),
  targetId: z.string(),
});
export type AttentionSignal = z.infer<typeof attentionSignalSchema>;

export const attentionSourceGroupViewSchema = z.object({
  group: attentionSourceGroupSchema,
  key: z.string(),
  signals: z.array(attentionSignalSchema),
});
export type AttentionSourceGroupView = z.infer<
  typeof attentionSourceGroupViewSchema
>;

export const attentionSectionViewSchema = z.object({
  defaultOpen: z.boolean(),
  groups: z.array(attentionSourceGroupViewSchema),
  section: z.enum(ATTENTION_SECTIONS),
});
export type AttentionSectionView = z.infer<typeof attentionSectionViewSchema>;

export const notificationCenterSchema = z.object({
  sections: z.array(attentionSectionViewSchema),
});
export type NotificationCenter = z.infer<typeof notificationCenterSchema>;

export const emitAttentionSignalOutputSchema = z.object({
  outcome: z.enum(["created", "duplicate"]),
  signal: attentionSignalSchema,
});
export type EmitAttentionSignalOutput = z.infer<
  typeof emitAttentionSignalOutputSchema
>;

/** Stored row; the section and class are derived from the registry, not kept. */
export type StoredAttentionSignal = Omit<
  AttentionSignal,
  "presentation" | "section"
>;

export function toAttentionSignal(
  stored: StoredAttentionSignal,
): AttentionSignal {
  const presentation = attentionPresentationClass(stored.signalId);
  return {
    ...stored,
    presentation,
    section: attentionSectionForClass(presentation),
  };
}

export const sourceGroupKey = (group: AttentionSourceGroup) =>
  `${group.kind}:${group.id}`;

/**
 * Presentation only: each signal sits in exactly one section and, inside it,
 * under its main source. Reasons, events, times and read/closed marks are kept
 * per signal; nothing is merged or rewritten.
 */
export function deriveNotificationCenter(
  stored: readonly StoredAttentionSignal[],
): NotificationCenter {
  const byTime = (a: AttentionSignal, b: AttentionSignal) =>
    b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id);
  return {
    sections: ATTENTION_SECTIONS.map((section) => {
      const groups = new Map<string, AttentionSourceGroupView>();
      for (const signal of stored.map(toAttentionSignal).sort(byTime)) {
        if (signal.section !== section) {
          continue;
        }
        const key = sourceGroupKey(signal.group);
        const existing = groups.get(key);
        if (existing) {
          existing.signals.push(signal);
        } else {
          groups.set(key, { group: signal.group, key, signals: [signal] });
        }
      }
      return {
        defaultOpen: section === DEFAULT_OPEN_ATTENTION_SECTION,
        groups: [...groups.values()],
        section,
      };
    }),
  };
}

export interface AttentionSignalsAccess {
  center: (accountId: string) => Promise<NotificationCenter>;
  /** Producer-side gate: rejects unregistered ids and dedupes event + target. */
  emit: (
    accountId: string,
    input: EmitAttentionSignalInput,
  ) => Promise<EmitAttentionSignalOutput>;
}
