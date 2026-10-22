import { z } from "zod";

/**
 * GitHub Integration seam (spec 61, ticket 03: Work-GitHub links and PR roles).
 *
 * A Work-GitHub link joins one Work to one GitHub dış kaydı (Issue or Pull
 * request) or to a commit or branch of a linked Repository. Linking or
 * unlinking writes neither the GitHub record nor the Work: no status, close or
 * blocker. A link is not an Evidence link and not a usage embed. Every link
 * carries one role of the closed catalog; Work Automation (spec 62) consumes
 * `Required for completion`, this seam never completes Work.
 */

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

// ---------------------------------------------------------------------------
// English UI labels (spec 61 Implementation Decisions) and the closed catalogs.
// ---------------------------------------------------------------------------

export const GITHUB_ROLE_REQUIRED_LABEL = "Required for completion";
export const GITHUB_ROLE_CONTEXTUAL_LABEL = "Contextual";
export const GITHUB_CREATE_WORK_LABEL = "Create work and link";
export const GITHUB_LINK_WORK_LABEL = "Link Work";
export const GITHUB_UNLINK_WORK_LABEL = "Unlink";
export const GITHUB_DISMISS_SIGNAL_LABEL = "Dismiss";

export const GITHUB_WORK_LINK_ROLES = [
  GITHUB_ROLE_REQUIRED_LABEL,
  GITHUB_ROLE_CONTEXTUAL_LABEL,
] as const;
export type GitHubWorkLinkRole = (typeof GITHUB_WORK_LINK_ROLES)[number];

export const GITHUB_WORK_LINK_KINDS = [
  "Issue",
  "Pull request",
  "Commit",
  "Branch",
] as const;
export type GitHubWorkLinkKind = (typeof GITHUB_WORK_LINK_KINDS)[number];

/** Where a link came from, shown with the link; a key match names its key. */
export const GITHUB_WORK_LINK_ORIGINS = [
  "Manual",
  "Key match",
  GITHUB_CREATE_WORK_LABEL,
] as const;
export type GitHubWorkLinkOrigin = (typeof GITHUB_WORK_LINK_ORIGINS)[number];

/** The supported closing-intent words (PRD 12); nothing else makes a role required. */
export const GITHUB_CLOSING_KEYWORDS = ["Fixes", "Closes", "Resolves"] as const;

export const GITHUB_WORK_TYPES = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
] as const;
export type GitHubWorkType = (typeof GITHUB_WORK_TYPES)[number];

export const GITHUB_SUGGESTION_REASONS = [
  "Multiple Work keys",
  "No Work with this key",
  "Key belongs to another Project",
] as const;
export type GitHubSuggestionReason = (typeof GITHUB_SUGGESTION_REASONS)[number];

/** Registered Unified Notification Center ids this feature emits (PRD 04). */
export const GITHUB_ATTENTION_SIGNAL_TYPES = [
  "unlinked-open-pr",
  "work-pr-status-conflict",
] as const;
export type GitHubAttentionSignalType =
  (typeof GITHUB_ATTENTION_SIGNAL_TYPES)[number];

/** Both registered ids sit in `Eylem Gerekiyor` (`Action Required`). */
export const GITHUB_ATTENTION_PRESENTATION = "Action Required" as const;

// ---------------------------------------------------------------------------
// The Work as this seam sees it (a read-only port: the Work owner keeps life).
// ---------------------------------------------------------------------------

export const GITHUB_WORK_STATUSES = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Closed",
] as const;

export interface GitHubWorkRef {
  closureResult: "Abandoned" | "Completed" | null;
  id: string;
  key: string;
  /** Keys this Work held before a merge or recreation: they still match. */
  previousKeys: string[];
  /** Ids that merged into this Work: a link stored under one still reaches it. */
  retiredIds: string[];
  status: (typeof GITHUB_WORK_STATUSES)[number];
  title: string;
  trashed: boolean;
}

export interface GitHubWorkKeyScope {
  /** Short codes of the other Projects of the same Workspace. */
  otherShortCodes: string[];
  /** Short codes this Project owns or reserved before. */
  ownShortCodes: string[];
  works: GitHubWorkRef[];
}

/** `Completed` is a Closed Work whose closure result is Completed. */
export function isCompletedWork(
  work: Pick<GitHubWorkRef, "closureResult" | "status">,
) {
  return work.status === "Closed" && work.closureResult === "Completed";
}

// ---------------------------------------------------------------------------
// Key matching (pure and deterministic).
// ---------------------------------------------------------------------------

const KEY_SHAPE =
  "(?<![A-Za-z0-9-])([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*-\\d+)(?![A-Za-z0-9])";
const TRAILING_NUMBER = /-\d+$/;

function keyPattern() {
  return new RegExp(KEY_SHAPE, "g");
}

function closingPattern() {
  return new RegExp(
    `\\b(?:${GITHUB_CLOSING_KEYWORDS.join("|")})\\b\\s*:?\\s+${KEY_SHAPE}`,
    "gi",
  );
}

export interface GitHubKeySuggestion {
  closingIntent: boolean;
  key: string;
  reason: GitHubSuggestionReason;
  workId: string | null;
}

export type GitHubKeyMatch =
  | {
      /** The key text that produced the link, shown with it. */
      matchedKey: string;
      outcome: "link";
      role: GitHubWorkLinkRole;
      suggestions: GitHubKeySuggestion[];
      workId: string;
    }
  | { outcome: "none" | "suggest"; suggestions: GitHubKeySuggestion[] };

function lookupWork(token: string, works: GitHubWorkRef[]) {
  return (
    works.find((work) => !work.trashed && work.key.toUpperCase() === token) ??
    works.find(
      (work) =>
        !work.trashed &&
        work.previousKeys.some((previous) => previous.toUpperCase() === token),
    ) ??
    null
  );
}

/**
 * Reads the supported text of one record (branch name, commit message, title,
 * description) for Work keys. Exactly one key that resolves to exactly one
 * Work of this Project links; a missing, repeated or other-Project key only
 * suggests. A Pull request key with a `Fixes`, `Closes` or `Resolves` word
 * right before it is `Required for completion`, every other exact match is
 * `Contextual`.
 */
export function matchWorkKeys(input: {
  kind: GitHubWorkLinkKind;
  scope: GitHubWorkKeyScope;
  texts: (string | null | undefined)[];
}): GitHubKeyMatch {
  const texts = input.texts.filter((text): text is string => Boolean(text));
  const tokens = new Set<string>();
  const closing = new Set<string>();
  for (const text of texts) {
    for (const found of text.matchAll(keyPattern())) {
      tokens.add((found[1] ?? "").toUpperCase());
    }
    for (const found of text.matchAll(closingPattern())) {
      closing.add((found[1] ?? "").toUpperCase());
    }
  }
  const own = new Set(input.scope.ownShortCodes.map((c) => c.toUpperCase()));
  const other = new Set(
    input.scope.otherShortCodes.map((c) => c.toUpperCase()),
  );
  const resolved: { token: string; workId: string }[] = [];
  const suggestions: GitHubKeySuggestion[] = [];
  for (const token of [...tokens].sort()) {
    const code = token.replace(TRAILING_NUMBER, "");
    const work = lookupWork(token, input.scope.works);
    const closingIntent = closing.has(token);
    if (work) {
      resolved.push({ token, workId: work.id });
      suggestions.push({
        closingIntent,
        key: token,
        reason: "Multiple Work keys",
        workId: work.id,
      });
    } else if (own.has(code)) {
      suggestions.push({
        closingIntent,
        key: token,
        reason: "No Work with this key",
        workId: null,
      });
    } else if (other.has(code)) {
      suggestions.push({
        closingIntent,
        key: token,
        reason: "Key belongs to another Project",
        workId: null,
      });
    }
  }
  if (suggestions.length === 0) {
    return { outcome: "none", suggestions: [] };
  }
  const workIds = new Set(resolved.map(({ workId }) => workId));
  const [first] = resolved;
  if (first && workIds.size === 1 && suggestions.length === resolved.length) {
    const intent = resolved.some(({ token }) => closing.has(token));
    return {
      matchedKey: first.token,
      outcome: "link",
      role:
        input.kind === "Pull request" && intent
          ? GITHUB_ROLE_REQUIRED_LABEL
          : GITHUB_ROLE_CONTEXTUAL_LABEL,
      // An exact unique match leaves nothing to suggest.
      suggestions: [],
      workId: first.workId,
    };
  }
  return { outcome: "suggest", suggestions };
}

// ---------------------------------------------------------------------------
// Attention signals (pure derivation from current state).
// ---------------------------------------------------------------------------

export interface GitHubSignalRecord {
  htmlUrl: string;
  id: string;
  kind: "Issue" | "Pull request";
  lifecycle: "Active" | "Archived" | "Trash";
  linkId: string;
  number: number;
  sourceState: "closed" | "merged" | "open";
  title: string;
}

export interface GitHubSignalWorkLink {
  recordId: string | null;
  workId: string;
}

export interface GitHubDesiredSignal {
  recordId: string;
  signalId: string;
  signalType: GitHubAttentionSignalType;
  workId: string | null;
}

/**
 * `unlinked-open-pr`: an open Pull request of a connected Repository that no
 * Work links, raised on the existing GitHub dış kaydı (never a new identity or
 * Work type). A commit or branch never raises it. `work-pr-status-conflict`:
 * a `Completed` Work with a linked open Pull request, neutral and source-linked.
 */
export function deriveAttentionSignals(input: {
  disconnectedLinkIds: ReadonlySet<string>;
  links: GitHubSignalWorkLink[];
  records: GitHubSignalRecord[];
  works: GitHubWorkRef[];
}): GitHubDesiredSignal[] {
  const desired: GitHubDesiredSignal[] = [];
  const completed = completedWorkIndex(input.works);
  for (const record of input.records) {
    if (
      record.kind !== "Pull request" ||
      record.sourceState !== "open" ||
      record.lifecycle !== "Active"
    ) {
      continue;
    }
    const linked = input.links.filter((link) => link.recordId === record.id);
    if (linked.length === 0) {
      if (!input.disconnectedLinkIds.has(record.linkId)) {
        desired.push({
          recordId: record.id,
          signalId: `unlinked-open-pr:${record.id}`,
          signalType: "unlinked-open-pr",
          workId: null,
        });
      }
      continue;
    }
    for (const link of linked) {
      const work = completed.get(link.workId);
      if (work) {
        desired.push({
          recordId: record.id,
          signalId: `work-pr-status-conflict:${work.id}:${record.id}`,
          signalType: "work-pr-status-conflict",
          workId: work.id,
        });
      }
    }
  }
  return desired;
}

/** Every `Completed`, live Work by its id and by each id merged into it. */
function completedWorkIndex(works: GitHubWorkRef[]) {
  const completed = new Map<string, GitHubWorkRef>();
  for (const work of works) {
    if (!work.trashed && isCompletedWork(work)) {
      completed.set(work.id, work);
      for (const retired of work.retiredIds) {
        completed.set(retired, work);
      }
    }
  }
  return completed;
}

// ---------------------------------------------------------------------------
// Stored rows and views.
// ---------------------------------------------------------------------------

export interface GitHubStoredWorkLink {
  createdAt: string;
  createdByAccountId: string | null;
  id: string;
  kind: GitHubWorkLinkKind;
  /** Key that produced a `Key match`. */
  matchedKey: string | null;
  origin: GitHubWorkLinkOrigin;
  projectId: string;
  recordId: string | null;
  /** An automatic link the founder removed: kept as a mark so it is not made again. */
  removedAt: string | null;
  repositoryLinkId: string;
  role: GitHubWorkLinkRole;
  /** The record id, or `<repository link>:<kind>:<value>` for a commit or branch. */
  targetKey: string;
  /** Commit sha or branch name; `null` for Issue and Pull request. */
  value: string | null;
  workId: string;
}

export interface GitHubStoredSuggestion {
  closingIntent: boolean;
  id: string;
  key: string;
  projectId: string;
  reason: GitHubSuggestionReason;
  recordId: string;
  workId: string | null;
}

export interface GitHubStoredSignal {
  closedAt: string | null;
  dismissedAt: string | null;
  occurredAt: string;
  ownerAccountId: string;
  projectId: string;
  recordId: string;
  signalId: string;
  signalType: GitHubAttentionSignalType;
  workId: string | null;
}

export const gitHubWorkLinkSchema = z
  .object({
    createdAt: timestampSchema,
    htmlUrl: z.string().nullable(),
    id: z.string(),
    kind: z.enum(GITHUB_WORK_LINK_KINDS),
    label: z.string(),
    matchedKey: z.string().nullable(),
    number: z.number().int().nullable(),
    origin: z.enum(GITHUB_WORK_LINK_ORIGINS),
    projectId: z.string(),
    recordId: z.string().nullable(),
    repository: z.string(),
    repositoryLinkId: z.string(),
    role: z.enum(GITHUB_WORK_LINK_ROLES),
    sourceState: z.enum(["open", "closed", "merged"]).nullable(),
    value: z.string().nullable(),
    workId: z.string(),
    workKey: z.string(),
    workTitle: z.string(),
  })
  .strict();
export type GitHubWorkLink = z.infer<typeof gitHubWorkLinkSchema>;

export const gitHubSuggestionSchema = z
  .object({
    closingIntent: z.boolean(),
    id: z.string(),
    key: z.string(),
    reason: z.enum(GITHUB_SUGGESTION_REASONS),
    recordId: z.string(),
    workId: z.string().nullable(),
    workKey: z.string().nullable(),
    workTitle: z.string().nullable(),
  })
  .strict();
export type GitHubSuggestion = z.infer<typeof gitHubSuggestionSchema>;

export const gitHubAttentionSignalSchema = z
  .object({
    occurredAt: timestampSchema,
    presentation: z.literal(GITHUB_ATTENTION_PRESENTATION),
    record: z
      .object({
        htmlUrl: z.string(),
        id: z.string(),
        kind: z.enum(["Issue", "Pull request"]),
        number: z.number().int(),
        sourceState: z.enum(["open", "closed", "merged"]),
        title: z.string(),
      })
      .strict(),
    signalId: z.string(),
    signalType: z.enum(GITHUB_ATTENTION_SIGNAL_TYPES),
    /** Neutral text: it names the two sources and asserts no verdict. */
    summary: z.string(),
    work: z
      .object({ id: z.string(), key: z.string(), title: z.string() })
      .strict()
      .nullable(),
  })
  .strict();
export type GitHubAttentionSignal = z.infer<typeof gitHubAttentionSignalSchema>;

export const gitHubWorkOptionSchema = z
  .object({
    closureResult: z.enum(["Completed", "Abandoned"]).nullable(),
    id: z.string(),
    key: z.string(),
    status: z.enum(GITHUB_WORK_STATUSES),
    title: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Inputs and outputs.
// ---------------------------------------------------------------------------

export const gitHubWorkLinksInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

const recordTargetSchema = z
  .object({ kind: z.literal("record"), recordId: identifierSchema })
  .strict();
const commitTargetSchema = z
  .object({
    kind: z.literal("Commit"),
    linkId: identifierSchema,
    sha: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{7,40}$/),
  })
  .strict();
const branchTargetSchema = z
  .object({
    kind: z.literal("Branch"),
    linkId: identifierSchema,
    name: z.string().trim().min(1).max(255),
  })
  .strict();

export const gitHubWorkLinkTargetSchema = z.discriminatedUnion("kind", [
  recordTargetSchema,
  commitTargetSchema,
  branchTargetSchema,
]);

export const gitHubLinkWorkInputSchema = z
  .object({
    projectId: identifierSchema,
    /** Manual pick: the founder chooses the role. */
    role: z.enum(GITHUB_WORK_LINK_ROLES),
    target: gitHubWorkLinkTargetSchema,
    workId: identifierSchema,
  })
  .strict();

export const gitHubUnlinkWorkInputSchema = z
  .object({ linkId: identifierSchema, projectId: identifierSchema })
  .strict();

export const gitHubCreateWorkPreviewInputSchema = z
  .object({ projectId: identifierSchema, recordId: identifierSchema })
  .strict();

export const gitHubCreateWorkInputSchema = z
  .object({
    description: z.string().trim().max(5000).default(""),
    projectId: identifierSchema,
    recordId: identifierSchema,
    title: z.string().trim().min(1).max(255),
    type: z.enum(GITHUB_WORK_TYPES),
  })
  .strict();

export const gitHubDismissSignalInputSchema = z
  .object({ projectId: identifierSchema, signalId: identifierSchema })
  .strict();

export const gitHubWorkLinksOutputSchema = z
  .object({
    links: z.array(gitHubWorkLinkSchema),
    readOnly: z.boolean(),
    signals: z.array(gitHubAttentionSignalSchema),
    suggestions: z.array(gitHubSuggestionSchema),
    works: z.array(gitHubWorkOptionSchema),
  })
  .strict();
export type GitHubWorkLinksOverview = z.infer<
  typeof gitHubWorkLinksOutputSchema
>;

/** One-time draft: nothing is written and no field syncs afterwards. */
export const gitHubCreateWorkPreviewSchema = z
  .object({
    draft: z
      .object({
        description: z.string(),
        startingStatus: z.literal("Not Started"),
        title: z.string(),
        type: z.enum(GITHUB_WORK_TYPES),
      })
      .strict(),
    recordId: z.string(),
    /** Plain statements of what the action does and does not do. */
    effects: z.array(z.string()),
    source: z
      .object({
        htmlUrl: z.string(),
        kind: z.literal("Issue"),
        number: z.number().int(),
        title: z.string(),
      })
      .strict(),
    syncsFields: z.literal(false),
    writesGitHub: z.literal(false),
  })
  .strict();
export type GitHubCreateWorkPreview = z.infer<
  typeof gitHubCreateWorkPreviewSchema
>;

export const gitHubCreateWorkOutputSchema = z
  .object({
    link: gitHubWorkLinkSchema,
    work: gitHubWorkOptionSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Ports.
// ---------------------------------------------------------------------------

export interface GitHubStoredWorkLinkPatch {
  matchedKey?: string | null;
  origin?: GitHubWorkLinkOrigin;
  removedAt?: string | null;
  role?: GitHubWorkLinkRole;
}

/**
 * The Work-link part of the unit of work. Every method is a read of the
 * Work owner's rows or a write of this seam's own link, suggestion and signal
 * rows; nothing here can update a Work or a GitHub dış kaydı.
 */
export interface GitHubWorkLinkTransaction {
  /** Creates the one Work of `Create work and link` through the Work owner's insert. */
  createWork: (input: {
    description: string;
    originRecordId: string;
    title: string;
    type: GitHubWorkType;
  }) => Promise<GitHubWorkRef>;
  /** Deletes a link the founder made by hand; an automatic one is only marked. */
  deleteWorkLink: (id: string) => Promise<void>;
  insertSignal: (signal: GitHubStoredSignal) => Promise<void>;
  insertWorkLink: (row: GitHubStoredWorkLink) => Promise<void>;
  keyScope: () => Promise<GitHubWorkKeyScope>;
  /** The Project owner: the signal's Notification Center owner. */
  ownerAccountId: () => Promise<string>;
  replaceSuggestions: (
    recordId: string,
    suggestions: GitHubStoredSuggestion[],
  ) => Promise<void>;
  signals: () => Promise<GitHubStoredSignal[]>;
  suggestions: () => Promise<GitHubStoredSuggestion[]>;
  updateSignal: (
    signalId: string,
    patch: {
      closedAt?: string | null;
      dismissedAt?: string | null;
      occurredAt?: string;
    },
  ) => Promise<void>;
  updateWorkLink: (
    id: string,
    patch: GitHubStoredWorkLinkPatch,
  ) => Promise<void>;
  workLinks: () => Promise<GitHubStoredWorkLink[]>;
}

export interface GitHubWorkLinkAccess {
  attentionSignals: (
    accountId: string,
    input: z.input<typeof gitHubWorkLinksInputSchema>,
  ) => Promise<GitHubAttentionSignal[]>;
  createWorkAndLink: (
    accountId: string,
    input: z.input<typeof gitHubCreateWorkInputSchema>,
  ) => Promise<z.output<typeof gitHubCreateWorkOutputSchema>>;
  dismissSignal: (
    accountId: string,
    input: z.input<typeof gitHubDismissSignalInputSchema>,
  ) => Promise<void>;
  linkWork: (
    accountId: string,
    input: z.input<typeof gitHubLinkWorkInputSchema>,
  ) => Promise<GitHubWorkLink>;
  previewCreateWork: (
    accountId: string,
    input: z.input<typeof gitHubCreateWorkPreviewInputSchema>,
  ) => Promise<GitHubCreateWorkPreview>;
  unlinkWork: (
    accountId: string,
    input: z.input<typeof gitHubUnlinkWorkInputSchema>,
  ) => Promise<void>;
  workLinks: (
    accountId: string,
    input: z.input<typeof gitHubWorkLinksInputSchema>,
  ) => Promise<GitHubWorkLinksOverview>;
}
