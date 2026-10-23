import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  type ChangelogEntry,
  type Observation,
  type ObservationEvidenceRef,
  type ObservationKind,
  type PublishPreview,
  type PublishPreviewEvent,
  type PublishPreviewScopeItem,
  type PublishPreviewWhyTrail,
  type ReassessmentRound,
  type ReassessmentView,
  type ReleaseCommunicationAccess,
  ReleaseCommunicationError,
  type ReleaseNote,
  saveReleaseNoteDraftInputSchema,
} from "@cantiara/api/release-communication";

import { scanPublishSafety } from "./release-publish-safety";

export interface ReleaseFactsRelease {
  /** Goal bound to the Release, read from the Goal membership (spec 37). */
  goal: { id: string; sourcePath: string; title: string } | null;
  /** Release hypothesis text, owned by 63. */
  hypothesis: string | null;
  id: string;
  projectId: string;
  /** Internal Release status (63 owns it). Only read here. */
  status: string;
}

export interface ReleaseScopeWork {
  currentPublicLabel: string | null;
  expectedOutcome: string | null;
  id: string;
  internalStatus: string;
  key: string;
  observedOutcome: string | null;
  proposedPublicLabel: string | null;
  sourcePath: string;
  title: string;
}

export interface WhyTrailRecordFacts {
  /** Every field the owner could show; none is public until approved. */
  fields: { name: string; value: string }[];
  title: string;
}

/**
 * Read-only facts owned by other specs (63 Release and scope, 37 Goal,
 * 45 evidence, 75 Build in Public). This seam never writes through them: a
 * publish cannot complete Work or write a Release status.
 */
export interface ReleaseCommunicationFacts {
  buildInPublicEvents: (releaseId: string) => Promise<PublishPreviewEvent[]>;
  changelogLinks: (
    releaseId: string,
  ) => Promise<{ href: string; label: string }[]>;
  evidenceExists: (
    projectId: string,
    evidence: ObservationEvidenceRef,
  ) => Promise<boolean>;
  /** Whether the Project exists in the caller's Workspace. */
  projectOwned: (accountId: string, projectId: string) => Promise<boolean>;
  projectWorkKeys: (projectId: string) => Promise<string[]>;
  release: (
    accountId: string,
    releaseId: string,
  ) => Promise<ReleaseFactsRelease | null>;
  scopeWorks: (releaseId: string) => Promise<ReleaseScopeWork[]>;
  tagsExist: (projectId: string, tagIds: string[]) => Promise<boolean>;
  whyTrailRecord: (
    projectId: string,
    ref: { sourceId: string; sourceType: string },
  ) => Promise<WhyTrailRecordFacts | null>;
}

export interface NoteWrite {
  authorId: string;
  baseRevision: number;
  body: string;
  noteId: string | null;
  projectId: string;
  releaseId: string;
  savedAt: string;
  scopeWorkIds: string[];
  tagIds: string[];
  whyTrail: ReleaseNote["whyTrail"];
}

export interface ApprovedSnapshot {
  approvedAt: string;
  body: string;
  buildInPublicEventIds: string[];
  changelogLinks: { href: string; label: string }[];
  noteId: string;
  publicLabels: { label: string; workId: string }[];
  releaseId: string;
  /** Existing project tags only. */
  tagIds: string[];
  whyTrail: PublishPreviewWhyTrail[];
}

export type StoredRound = Omit<ReassessmentRound, "actionNeeded">;

export interface ObservationWrite {
  assessment: Observation["assessment"];
  authorId: string;
  baseRevision: number;
  evidence: ObservationEvidenceRef[];
  kind: ObservationKind;
  observedAt: string;
  roundId: string;
  savedAt: string;
  text: string;
}

export interface ReleaseCommunicationStore {
  changelog: (projectId: string) => Promise<ChangelogEntry[]>;
  closeRound: (roundId: string, closedAt: string) => Promise<StoredRound>;
  createRound: (input: {
    projectId: string;
    releaseId: string;
    startedAt: string;
  }) => Promise<StoredRound>;
  findNote: (noteId: string) => Promise<ReleaseNote | null>;
  findRound: (roundId: string) => Promise<StoredRound | null>;
  listNotes: (releaseId: string) => Promise<ReleaseNote[]>;
  listRounds: (releaseId: string) => Promise<StoredRound[]>;
  openRounds: (projectId: string) => Promise<StoredRound[]>;
  /** Atomic: freeze the snapshot revision and mark the note Published. */
  publish: (snapshot: ApprovedSnapshot) => Promise<ChangelogEntry>;
  saveNote: (write: NoteWrite) => Promise<ReleaseNote>;
  saveObservation: (write: ObservationWrite) => Promise<StoredRound>;
}

/** The existing personal `Review Later` reminder (spec 35), set on the Release. */
export interface LookAgainReminders {
  schedule: (
    accountId: string,
    releaseId: string,
    fireAt: string,
  ) => Promise<boolean>;
}

export interface ReleaseCommunicationOptions {
  facts: ReleaseCommunicationFacts;
  now?: () => Date;
  reminders: LookAgainReminders;
  store: ReleaseCommunicationStore;
}

const RELEASE_PUBLISHED = "Published";

function withState(round: StoredRound): ReassessmentRound {
  return {
    ...round,
    actionNeeded: round.closedAt === null && !(round.access && round.outcome),
  };
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function createReleaseCommunication(
  options: ReleaseCommunicationOptions,
): ReleaseCommunicationAccess {
  const { facts, reminders, store } = options;
  const now = options.now ?? (() => new Date());

  async function scopeFor(release: ReleaseFactsRelease, workIds: string[]) {
    const scope = await facts.scopeWorks(release.id);
    const inScope = new Set(scope.map((entry) => entry.id));
    if (workIds.some((id) => !inScope.has(id))) {
      throw new ReleaseCommunicationError(
        "RELEASE_COMMUNICATION_SCOPE_INVALID",
        "Release notes can bind only to Work in this Release's scope.",
      );
    }
    return scope;
  }

  async function noteWithRelease(accountId: string, noteId: string) {
    const note = await store.findNote(noteId);
    if (!note) {
      return null;
    }
    const release = await facts.release(accountId, note.releaseId);
    return release ? { note, release } : null;
  }

  async function buildPreview(
    note: ReleaseNote,
    release: ReleaseFactsRelease,
  ): Promise<PublishPreview> {
    const scope = await scopeFor(release, note.scopeWorkIds);
    const bound = scope.filter((entry) => note.scopeWorkIds.includes(entry.id));
    const scopeItems: PublishPreviewScopeItem[] = bound.map((entry) => ({
      currentPublicLabel: entry.currentPublicLabel,
      internalStatus: entry.internalStatus,
      proposedPublicLabel: entry.proposedPublicLabel,
      title: entry.title,
      workId: entry.id,
    }));

    const whyTrail: PublishPreviewWhyTrail[] = [];
    const privateTerms: string[] = [];
    for (const item of note.whyTrail) {
      // biome-ignore lint/performance/noAwaitInLoops: trail lookups stay in the user's order.
      const record = await facts.whyTrailRecord(release.projectId, item);
      if (!record) {
        continue;
      }
      const proposed = record.fields.filter((field) =>
        item.approvedFields.includes(field.name),
      );
      if (proposed.length === 0) {
        // Selecting a record never publishes its fields; it stays out entirely.
        privateTerms.push(record.title);
        continue;
      }
      whyTrail.push({
        proposedFields: proposed,
        sourceId: item.sourceId,
        sourceType: item.sourceType,
      });
    }

    const [events, links, projectKeys] = await Promise.all([
      facts.buildInPublicEvents(release.id),
      facts.changelogLinks(release.id),
      facts.projectWorkKeys(release.projectId),
    ]);
    const boundKeys = new Set(bound.map((entry) => entry.key));
    const findings = scanPublishSafety({
      outOfScopeWorkKeys: projectKeys.filter((key) => !boundKeys.has(key)),
      privateTerms,
      texts: [
        { target: "body", text: note.body },
        ...whyTrail.flatMap((item) =>
          item.proposedFields.map((field) => ({
            target: `${item.sourceType} ${item.sourceId}: ${field.name}`,
            text: field.value,
          })),
        ),
      ],
    });

    const content = {
      body: note.body,
      events,
      findings,
      links,
      noteRevision: note.revision,
      scope: scopeItems,
      tagIds: note.tagIds,
      whyTrail,
    };
    return {
      buildInPublicEvents: events,
      changelogLinks: links,
      fingerprint: await fingerprintMutationPayload(
        content as unknown as MutationPayload,
      ),
      findings,
      noteId: note.id,
      releaseId: release.id,
      scope: scopeItems,
      whyTrail,
      written: false,
    };
  }

  async function roundWithRelease(accountId: string, roundId: string) {
    const round = await store.findRound(roundId);
    if (!round) {
      return null;
    }
    const release = await facts.release(accountId, round.releaseId);
    return release ? { release, round } : null;
  }

  return {
    actionNeeded: async (accountId, projectId) => {
      if (!(await facts.projectOwned(accountId, projectId))) {
        return null;
      }
      return (await store.openRounds(projectId))
        .map(withState)
        .filter((round) => round.actionNeeded);
    },

    changelog: async (accountId, input) => {
      if (!(await facts.projectOwned(accountId, input.projectId))) {
        return null;
      }
      const entries = await store.changelog(input.projectId);
      return input.tagIds.length === 0
        ? entries
        : entries.filter((entry) =>
            input.tagIds.every((tagId) => entry.tagIds.includes(tagId)),
          );
    },

    closeAssessment: async (accountId, roundId) => {
      const found = await roundWithRelease(accountId, roundId);
      if (!found) {
        return null;
      }
      if (found.round.closedAt) {
        return withState(found.round);
      }
      return withState(await store.closeRound(roundId, now().toISOString()));
    },

    listNotes: async (accountId, releaseId) =>
      (await facts.release(accountId, releaseId))
        ? store.listNotes(releaseId)
        : null,

    previewPublish: async (accountId, noteId) => {
      const found = await noteWithRelease(accountId, noteId);
      if (!found) {
        return null;
      }
      if (found.note.status === "Published") {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
          "These Release notes are already published.",
        );
      }
      return buildPreview(found.note, found.release);
    },

    publish: async (accountId, input) => {
      const found = await noteWithRelease(accountId, input.noteId);
      if (!found) {
        return null;
      }
      if (found.note.status === "Published") {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
          "These Release notes are already published.",
        );
      }
      const preview = await buildPreview(found.note, found.release);
      if (preview.fingerprint !== input.approval.fingerprint) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_PREVIEW_STALE",
          "The preview changed. Review it again before publishing.",
        );
      }
      if (preview.findings.length > 0) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_PREVIEW_BLOCKED",
          "Resolve the preview findings before publishing.",
        );
      }

      // Only what the founder approved item by item reaches the snapshot;
      // everything else stays private and unchanged.
      const proposedLabels = new Map(
        preview.scope.map((entry) => [entry.workId, entry.proposedPublicLabel]),
      );
      const publicLabels = input.approval.publicLabels.filter(
        (entry) => proposedLabels.get(entry.workId) === entry.label,
      );
      const whyTrail = preview.whyTrail
        .map((item) => {
          const approval = input.approval.whyTrail.find(
            (candidate) =>
              candidate.sourceId === item.sourceId &&
              candidate.sourceType === item.sourceType,
          );
          return {
            ...item,
            proposedFields: item.proposedFields.filter((field) =>
              approval?.approvedFields.includes(field.name),
            ),
          };
        })
        .filter((item) => item.proposedFields.length > 0);

      return store.publish({
        approvedAt: now().toISOString(),
        body: found.note.body,
        buildInPublicEventIds: preview.buildInPublicEvents
          .filter((event) =>
            input.approval.buildInPublicEventIds.includes(event.id),
          )
          .map((event) => event.id),
        changelogLinks: preview.changelogLinks.filter((link) =>
          input.approval.changelogLinkHrefs.includes(link.href),
        ),
        noteId: found.note.id,
        publicLabels,
        releaseId: found.release.id,
        tagIds: found.note.tagIds,
        whyTrail,
      });
    },

    reassessment: async (accountId, releaseId) => {
      const release = await facts.release(accountId, releaseId);
      if (!release) {
        return null;
      }
      const [scope, rounds] = await Promise.all([
        facts.scopeWorks(releaseId),
        store.listRounds(releaseId),
      ]);
      const view: ReassessmentView = {
        blocksClose: false,
        goal: release.goal,
        hypothesis: release.hypothesis,
        releaseId,
        rounds: [...rounds]
          .sort((left, right) => left.sequence - right.sequence)
          .map(withState),
        scope: scope.map((entry) => ({
          expectedOutcome: entry.expectedOutcome,
          observedOutcome: entry.observedOutcome,
          sourcePath: entry.sourcePath,
          title: entry.title,
          workId: entry.id,
        })),
      };
      return view;
    },

    recordObservation: async (accountId, input) => {
      const found = await roundWithRelease(accountId, input.roundId);
      if (!found) {
        return null;
      }
      if (found.round.closedAt) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_ROUND_CLOSED",
          "This assessment is closed.",
        );
      }
      const evidence = [
        ...new Map(
          input.evidence.map((ref) => [
            `${ref.sourceType}\u0000${ref.sourceId}`,
            ref,
          ]),
        ).values(),
      ];
      for (const ref of evidence) {
        // biome-ignore lint/performance/noAwaitInLoops: first missing bind stops the write.
        if (!(await facts.evidenceExists(found.release.projectId, ref))) {
          throw new ReleaseCommunicationError(
            "RELEASE_COMMUNICATION_EVIDENCE_INVALID",
            "Observation evidence must be an existing record in this Project.",
          );
        }
      }
      const savedAt = now().toISOString();
      const saved = await store.saveObservation({
        assessment: input.assessment,
        authorId: accountId,
        baseRevision: input.baseRevision,
        evidence,
        kind: input.kind,
        observedAt: input.observedAt ?? savedAt,
        roundId: input.roundId,
        savedAt,
        text: input.text,
      });
      return withState(saved);
    },

    saveDraft: async (accountId, input) => {
      const parsed = saveReleaseNoteDraftInputSchema.parse(input);
      const release = await facts.release(accountId, parsed.releaseId);
      if (!release) {
        return null;
      }
      await scopeFor(release, parsed.scopeWorkIds);
      if (!(await facts.tagsExist(release.projectId, parsed.tagIds))) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_SCOPE_INVALID",
          "Changelog filters use the Project's existing tags only.",
        );
      }
      if (input.noteId) {
        const existing = await store.findNote(input.noteId);
        if (!existing || existing.releaseId !== release.id) {
          return null;
        }
        if (existing.status === "Published") {
          throw new ReleaseCommunicationError(
            "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
            "Published Release notes are frozen. Start a new draft.",
          );
        }
      }
      return store.saveNote({
        authorId: accountId,
        baseRevision: input.baseRevision,
        body: parsed.body,
        noteId: input.noteId ?? null,
        projectId: release.projectId,
        releaseId: release.id,
        savedAt: now().toISOString(),
        scopeWorkIds: unique(parsed.scopeWorkIds),
        tagIds: unique(parsed.tagIds),
        whyTrail: parsed.whyTrail,
      });
    },

    setLookAgain: async (accountId, releaseId, fireAt) => {
      const release = await facts.release(accountId, releaseId);
      if (!release) {
        return false;
      }
      // Only the normal reminder is set; no round, signal or follow-up Work.
      return reminders.schedule(accountId, releaseId, fireAt);
    },

    startReassessment: async (accountId, input) => {
      const release = await facts.release(accountId, input.releaseId);
      if (!release) {
        return null;
      }
      if (release.status !== RELEASE_PUBLISHED) {
        throw new ReleaseCommunicationError(
          "RELEASE_COMMUNICATION_NOT_PUBLISHED",
          "Reassess impact opens after the Release is published.",
        );
      }
      const round = await store.createRound({
        projectId: release.projectId,
        releaseId: release.id,
        startedAt: now().toISOString(),
      });
      if (input.lookAgainAt) {
        await reminders.schedule(accountId, release.id, input.lookAgainAt);
      }
      return withState(round);
    },
  };
}
