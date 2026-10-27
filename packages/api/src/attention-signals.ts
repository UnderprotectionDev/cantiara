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
  /** The source record was deleted: the reason is replaced, never shown. */
  tombstone: z.boolean(),
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
  "presentation" | "section" | "tombstone"
>;

export const ATTENTION_TOMBSTONE_REASON = "The source record was deleted.";

export function toAttentionSignal(
  stored: StoredAttentionSignal,
  tombstone = false,
): AttentionSignal {
  const presentation = attentionPresentationClass(stored.signalId);
  return {
    ...stored,
    presentation,
    reason: tombstone ? ATTENTION_TOMBSTONE_REASON : stored.reason,
    section: attentionSectionForClass(presentation),
    tombstone,
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
  deletedGroups: ReadonlySet<string> = new Set(),
): NotificationCenter {
  const byTime = (a: AttentionSignal, b: AttentionSignal) =>
    b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id);
  return {
    sections: ATTENTION_SECTIONS.map((section) => {
      const groups = new Map<string, AttentionSourceGroupView>();
      const signals = stored
        .map((row) =>
          toAttentionSignal(row, deletedGroups.has(sourceGroupKey(row.group))),
        )
        .sort(byTime);
      for (const signal of signals) {
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

export const attentionSignalTargetSchema = z
  .object({ signalRowId: identity })
  .strict();
export type AttentionSignalTarget = z.infer<typeof attentionSignalTargetSchema>;

/** Read and closed marks are attention state only; the source is not written. */
export const markAttentionSignalInputSchema = z
  .object({
    mark: z.enum(["read", "unread", "closed", "reopened"]),
    signalRowId: identity,
  })
  .strict();
export type MarkAttentionSignalInput = z.infer<
  typeof markAttentionSignalInputSchema
>;

/**
 * The result of opening a signal. `event` opens the exact source event in
 * visible context; `record` opens the record and explains the missing exact
 * target without retargeting; `tombstone` opens nothing and leaks no content.
 */
export const openAttentionSignalOutputSchema = z.discriminatedUnion("outcome", [
  z.object({
    eventId: z.string(),
    group: attentionSourceGroupSchema,
    outcome: z.literal("event"),
    targetId: z.string(),
  }),
  z.object({
    explanation: z.string(),
    group: attentionSourceGroupSchema,
    missingEventId: z.string(),
    outcome: z.literal("record"),
  }),
  z.object({
    explanation: z.string(),
    outcome: z.literal("tombstone"),
  }),
]);
export type OpenAttentionSignalOutput = z.infer<
  typeof openAttentionSignalOutputSchema
>;

export const ATTENTION_FOLLOW_UP_WORK_TYPES = [
  "Task",
  "Bug",
  "Research",
] as const;

export const attentionFollowUpRelationSchema = z.object({
  id: z.string(),
  kind: z.string(),
  relation: z.literal("Origin"),
});

export const attentionFollowUpPreviewSchema = z.object({
  fingerprint: z.string(),
  relations: z.array(attentionFollowUpRelationSchema),
  signalRowId: z.string(),
  work: z.object({
    description: z.string(),
    projectId: z.string(),
    title: z.string(),
    type: z.enum(ATTENTION_FOLLOW_UP_WORK_TYPES),
  }),
});
export type AttentionFollowUpPreview = z.infer<
  typeof attentionFollowUpPreviewSchema
>;

export const previewAttentionFollowUpInputSchema = z
  .object({
    signalRowId: identity,
    workType: z.enum(ATTENTION_FOLLOW_UP_WORK_TYPES).default("Task"),
  })
  .strict();
export type PreviewAttentionFollowUpInput = z.input<
  typeof previewAttentionFollowUpInputSchema
>;

/** One apply per attempt id: a retry returns the same İş, never a second. A fresh preview
 * mints a fresh attempt, so applying twice through two previews is the founder's explicit
 * second follow-up; multiples from one notification are never implicit. */
export const createAttentionFollowUpInputSchema = z
  .object({
    attemptId: identity,
    fingerprint: identity,
    signalRowId: identity,
    workType: z.enum(ATTENTION_FOLLOW_UP_WORK_TYPES).default("Task"),
  })
  .strict();
export type CreateAttentionFollowUpInput = z.input<
  typeof createAttentionFollowUpInputSchema
>;

export const attentionFollowUpResultSchema = z.object({
  created: z.boolean(),
  signal: attentionSignalSchema,
  workId: z.string(),
});
export type AttentionFollowUpResult = z.infer<
  typeof attentionFollowUpResultSchema
>;

/**
 * The İş a `Create Follow-up Work` apply would create, with its Kökeni
 * relations. Pure: the preview and the apply derive the same plan, so a
 * changed signal makes the previewed fingerprint stale. A deleted source adds
 * no source relation and quotes no content.
 */
export function buildAttentionFollowUpPlan(
  signal: AttentionSignal,
  workType: (typeof ATTENTION_FOLLOW_UP_WORK_TYPES)[number],
) {
  const title = signal.tombstone
    ? "Follow up on a deleted source"
    : `Follow up: ${signal.reason}`.slice(0, 200);
  const description = signal.tombstone
    ? ""
    : `Follow-up for ${signal.signalId} on ${signal.group.kind} ${signal.group.id}.`;
  const relations: z.infer<typeof attentionFollowUpRelationSchema>[] = [
    { id: signal.id, kind: "Notification", relation: "Origin" },
  ];
  if (!signal.tombstone) {
    relations.push({
      id: signal.group.id,
      kind: signal.group.kind,
      relation: "Origin",
    });
  }
  return { description, relations, title, type: workType };
}

export interface AttentionSignalsAccess {
  center: (accountId: string) => Promise<NotificationCenter>;
  createFollowUp: (
    accountId: string,
    input: CreateAttentionFollowUpInput,
  ) => Promise<AttentionFollowUpResult>;
  /** Producer-side gate: rejects unregistered ids and dedupes event + target. */
  emit: (
    accountId: string,
    input: EmitAttentionSignalInput,
  ) => Promise<EmitAttentionSignalOutput>;
  mark: (
    accountId: string,
    input: MarkAttentionSignalInput,
  ) => Promise<AttentionSignal>;
  open: (
    accountId: string,
    input: AttentionSignalTarget,
  ) => Promise<OpenAttentionSignalOutput>;
  previewFollowUp: (
    accountId: string,
    input: PreviewAttentionFollowUpInput,
  ) => Promise<AttentionFollowUpPreview>;
}
