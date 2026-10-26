import { z } from "zod";

/**
 * Project History seam, Story Timeline (spec 68, gerçekleşen olayların zaman
 * çizelgesi).
 *
 * The timeline is a live, read-only chronological story of important realized
 * events, derived from owner records on every read. It stores nothing. A
 * field-level edit is never a story event: the closed kind set below has no
 * field-change member. The story mints no Dikkat sinyali and is not a
 * Kapanış özeti, a release note, a public feed or an automatic success
 * write-up. Every event names the owner record `Open source record` opens and
 * carries the abandonment rationale when the event is an abandonment. A source
 * the owner cannot read yet is named in `unavailable`, never invented or
 * silently omitted.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const PROJECT_HISTORY_LABEL = "Project History" as const;
export const STORY_TIMELINE_LABEL = "Story Timeline" as const;
export const PROJECT_HISTORY_OPEN_SOURCE_LABEL = "Open source record" as const;

/** The closed set of realized event kinds the story is made of. */
export const STORY_EVENT_KINDS = [
  "Decision",
  "Document",
  "Design",
  "Work",
  "Milestone",
  "Lifecycle change",
  "Code change",
  "Production Incident",
  "Validation result",
  "Project Release",
] as const;
export type StoryEventKind = (typeof STORY_EVENT_KINDS)[number];

/** Owner record kinds an event can open. */
export const STORY_SOURCE_TYPES = [
  "Decision",
  "Document",
  "Screen",
  "Work",
  "Milestone",
  "Project",
  "Pull request",
  "Production Incident",
  "Validation Record",
  "Project Release",
] as const;
export type StorySourceType = (typeof STORY_SOURCE_TYPES)[number];

export const storySourceRefSchema = z
  .object({
    label: z.string(),
    recordId: z.string(),
    recordType: z.enum(STORY_SOURCE_TYPES),
  })
  .strict();
export type StorySourceRef = z.infer<typeof storySourceRefSchema>;

export const storyEventSchema = z
  .object({
    /** Set only when the event is an abandonment (Vazgeçildi). */
    abandonmentRationale: z.string().nullable(),
    eventId: z.string(),
    kind: z.enum(STORY_EVENT_KINDS),
    occurredAt: z.string(),
    /** The owner record's own state text, e.g. `Reached`, `Abandoned`. */
    state: z.string().nullable(),
    /** The owner record `Open source record` opens. */
    source: storySourceRefSchema,
    title: z.string(),
  })
  .strict();
export type StoryEvent = z.infer<typeof storyEventSchema>;

export const storyScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Project"), projectId: z.string() }).strict(),
  z
    .object({
      key: z.string(),
      kind: z.literal("Feature"),
      projectId: z.string(),
      title: z.string(),
      workId: z.string(),
    })
    .strict(),
]);
export type StoryScope = z.infer<typeof storyScopeSchema>;

export const storyTimelineSchema = z
  .object({
    events: z.array(storyEventSchema),
    scope: storyScopeSchema,
    /** Kinds whose owner has no read yet; the other kinds still work. */
    unavailable: z.array(
      z
        .object({ kind: z.enum(STORY_EVENT_KINDS), reason: z.string() })
        .strict(),
    ),
  })
  .strict();
export type StoryTimeline = z.infer<typeof storyTimelineSchema>;

// ---------------------------------------------------------------------------
// Inputs. Strict: Project scope, or the scope of one Feature-type Work.
// ---------------------------------------------------------------------------

export const storyTimelineInputSchema = z.discriminatedUnion("scope", [
  z
    .object({ projectId: identifierSchema, scope: z.literal("Project") })
    .strict(),
  z
    .object({
      projectId: identifierSchema,
      scope: z.literal("Feature"),
      workId: identifierSchema,
    })
    .strict(),
]);
export type StoryTimelineInput = z.infer<typeof storyTimelineInputSchema>;

// ---------------------------------------------------------------------------
// Facts: what the owner records say, supplied through a read-only port.
// ---------------------------------------------------------------------------

/** A source is either read or named as unavailable; never silently empty. */
export type StorySourced<T> =
  | { available: true; value: T }
  | { available: false; reason: string };

/** A realized event as its owner reports it; never a field edit. */
export interface StoryEventFact {
  abandonmentRationale: string | null;
  occurredAt: string;
  source: StorySourceRef;
  state: string | null;
  title: string;
}

export interface StoryTimelineFacts {
  scope: StoryScope;
  sources: Record<StoryEventKind, StorySourced<StoryEventFact[]>>;
}

/** Read-only access; the contract has no write member. */
export interface ProjectHistoryAccess {
  storyTimeline: (
    accountId: string,
    input: StoryTimelineInput,
  ) => Promise<StoryTimeline>;
}

/** Chronological (oldest first), stable by event id. */
export function deriveStoryTimeline(facts: StoryTimelineFacts): StoryTimeline {
  const events: StoryEvent[] = [];
  const unavailable: StoryTimeline["unavailable"] = [];
  for (const kind of STORY_EVENT_KINDS) {
    const sourced = facts.sources[kind];
    if (!sourced.available) {
      unavailable.push({ kind, reason: sourced.reason });
      continue;
    }
    for (const fact of sourced.value) {
      events.push({
        abandonmentRationale: fact.abandonmentRationale,
        eventId: `${kind}:${fact.source.recordType}:${fact.source.recordId}:${fact.state ?? ""}`,
        kind,
        occurredAt: fact.occurredAt,
        source: fact.source,
        state: fact.state,
        title: fact.title,
      });
    }
  }
  events.sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.eventId.localeCompare(b.eventId),
  );
  return { events, scope: facts.scope, unavailable };
}
