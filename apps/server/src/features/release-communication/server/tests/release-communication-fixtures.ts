// biome-ignore-all lint/suspicious/useAwait: in-memory doubles implement the async ports.

import {
  type ChangelogEntry,
  type Observation,
  ReleaseCommunicationError,
  type ReleaseNote,
} from "@cantiara/api/release-communication";

import {
  type ApprovedSnapshot,
  createReleaseCommunication,
  type NoteWrite,
  type ObservationWrite,
  type ReleaseCommunicationFacts,
  type ReleaseCommunicationStore,
  type ReleaseFactsRelease,
  type ReleaseScopeWork,
  type StoredRound,
} from "../release-communication";

export const ACCOUNT_ID = "account-1";
export const PROJECT_ID = "project-1";
export const RELEASE_ID = "release-1";

export function createScopeWork(
  overrides: Partial<ReleaseScopeWork> = {},
): ReleaseScopeWork {
  return {
    currentPublicLabel: null,
    expectedOutcome: "Founders reach the editor in one click",
    id: "work-1",
    internalStatus: "Closed",
    key: "CNT-1",
    observedOutcome: null,
    proposedPublicLabel: "Released",
    sourcePath: "/projects/project-1/work/work-1",
    title: "Faster editor start",
    ...overrides,
  };
}

/** The 63 Release fixture: status is only ever read here. */
export function createFixtures(
  input: {
    release?: Partial<ReleaseFactsRelease>;
    scope?: ReleaseScopeWork[];
  } = {},
) {
  const release: ReleaseFactsRelease = {
    goal: { id: "goal-1", sourcePath: "/goals/goal-1", title: "Faster start" },
    hypothesis: "Founders open the editor sooner",
    id: RELEASE_ID,
    projectId: PROJECT_ID,
    status: "Preparing",
    ...input.release,
  };
  const scope = input.scope ?? [
    createScopeWork(),
    createScopeWork({
      id: "work-2",
      internalStatus: "In Progress",
      key: "CNT-2",
      proposedPublicLabel: null,
      title: "Editor shortcuts",
    }),
  ];
  const extraWorkKeys = ["CNT-9"];
  const evidence = new Set(["Source:source-1", "Feedback:feedback-1"]);
  const whyRecords = new Map([
    [
      "Decision:decision-1",
      {
        fields: [
          { name: "Summary", value: "Starting in one click matters most." },
          { name: "Context", value: "Private founder context" },
        ],
        title: "Start-up decision",
      },
    ],
  ]);
  const reminders: { fireAt: string; releaseId: string }[] = [];
  const events = [{ id: "event-1", title: "Faster editor start shipped" }];

  const facts: ReleaseCommunicationFacts = {
    buildInPublicEvents: async () => events,
    changelogLinks: async () => [
      { href: "https://example.test/changelog/1", label: "Changelog" },
    ],
    evidenceExists: async (_projectId, ref) =>
      evidence.has(`${ref.sourceType}:${ref.sourceId}`),
    projectOwned: async (accountId, projectId) =>
      accountId === ACCOUNT_ID && projectId === PROJECT_ID,
    projectWorkKeys: async () => [...scope.map((w) => w.key), ...extraWorkKeys],
    release: async (accountId, releaseId) =>
      accountId === ACCOUNT_ID && releaseId === release.id ? release : null,
    scopeWorks: async () => scope,
    tagsExist: async (_projectId, tagIds) =>
      tagIds.every((id) => id.startsWith("tag-")),
    whyTrailRecord: async (_projectId, ref) =>
      whyRecords.get(`${ref.sourceType}:${ref.sourceId}`) ?? null,
  };

  const store = createMemoryStore();
  const clock = { current: new Date("2026-10-23T09:00:00.000Z") };
  const access = createReleaseCommunication({
    facts,
    now: () => clock.current,
    reminders: {
      schedule: async (_accountId, releaseId, fireAt) => {
        reminders.push({ fireAt, releaseId });
        return true;
      },
    },
    store,
  });
  return {
    access,
    clock,
    release,
    reminders,
    scope,
    store,
    tick(days: number) {
      clock.current = new Date(clock.current.getTime() + days * 86_400_000);
    },
  };
}

export function createMemoryStore(): ReleaseCommunicationStore {
  const notes = new Map<string, ReleaseNote>();
  const entries: ChangelogEntry[] = [];
  const rounds = new Map<string, StoredRound>();
  let counter = 0;
  const id = (prefix: string) => {
    counter += 1;
    return `${prefix}-${counter}`;
  };

  return {
    changelog: async (projectId) =>
      entries.filter(
        (entry) => notes.get(entry.noteId)?.projectId === projectId,
      ),
    closeRound: async (roundId, closedAt) => {
      const round = rounds.get(roundId) as StoredRound;
      const closed: StoredRound = {
        ...round,
        closeReason: "Close assessment",
        closedAt,
      };
      rounds.set(roundId, closed);
      return closed;
    },
    createRound: async ({ releaseId, startedAt }) => {
      const sequence =
        [...rounds.values()].filter((r) => r.releaseId === releaseId).length +
        1;
      const round: StoredRound = {
        access: null,
        closeReason: null,
        closedAt: null,
        id: id("round"),
        outcome: null,
        releaseId,
        sequence,
        startedAt,
      };
      rounds.set(round.id, round);
      return round;
    },
    findNote: async (noteId) => notes.get(noteId) ?? null,
    findRound: async (roundId) => rounds.get(roundId) ?? null,
    listNotes: async (releaseId) =>
      [...notes.values()].filter((note) => note.releaseId === releaseId),
    listRounds: async (releaseId) =>
      [...rounds.values()].filter((round) => round.releaseId === releaseId),
    openRounds: async () =>
      [...rounds.values()].filter((round) => round.closedAt === null),
    publish: async (snapshot: ApprovedSnapshot) => {
      const note = notes.get(snapshot.noteId) as ReleaseNote;
      notes.set(note.id, {
        ...note,
        publishedAt: snapshot.approvedAt,
        status: "Published",
      });
      const entry: ChangelogEntry = { ...snapshot, revision: 1 };
      entries.push(entry);
      return entry;
    },
    saveNote: async (write: NoteWrite) => {
      const existing = write.noteId ? notes.get(write.noteId) : undefined;
      const current = existing?.revision ?? 0;
      if (write.baseRevision !== current) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_STALE_REVISION",
          "stale",
        );
      }
      const note: ReleaseNote = {
        body: write.body,
        createdAt: existing?.createdAt ?? write.savedAt,
        id: existing?.id ?? id("note"),
        projectId: write.projectId,
        publishedAt: null,
        releaseId: write.releaseId,
        revision: current + 1,
        scopeWorkIds: write.scopeWorkIds,
        status: "Draft",
        tagIds: write.tagIds,
        updatedAt: write.savedAt,
        whyTrail: write.whyTrail,
      };
      notes.set(note.id, note);
      return note;
    },
    saveObservation: async (write: ObservationWrite) => {
      const round = rounds.get(write.roundId) as StoredRound;
      const existing = round[write.kind];
      const current = existing?.revision ?? 0;
      if (write.baseRevision !== current) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_STALE_REVISION",
          "stale",
        );
      }
      const observation: Observation = {
        assessment: write.assessment,
        authorId: write.authorId,
        evidence: write.evidence,
        id: existing?.id ?? id("observation"),
        kind: write.kind,
        observedAt: write.observedAt,
        previous: existing
          ? [
              ...existing.previous,
              {
                assessment: existing.assessment,
                authorId: existing.authorId,
                evidence: existing.evidence,
                observedAt: existing.observedAt,
                revision: existing.revision,
                savedAt: existing.savedAt,
                text: existing.text,
              },
            ]
          : [],
        revision: current + 1,
        roundId: write.roundId,
        savedAt: write.savedAt,
        text: write.text,
      };
      const next = { ...round, [write.kind]: observation };
      rounds.set(round.id, next);
      return next;
    },
  };
}
