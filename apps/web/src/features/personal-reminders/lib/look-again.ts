import type {
  PersonalReminderSignalHistory,
  PersonalReminderSourceType,
} from "@cantiara/api/personal-reminders";

export type LookAgainTarget =
  | { kind: "document"; documentId: string; projectId: string | null }
  | { kind: "project"; projectId: string }
  | { kind: "work"; projectId: string; workId: string }
  | {
      kind: "project-source-record";
      projectId: string;
      sourceId: string;
      sourceType:
        | "Decision"
        | "Milestone"
        | "Production Incident"
        | "Project Release"
        | "Risk";
    };

/** Due `Review Later` items only: dismissed signals and `Remind me` signals are not listed. */
export function dueLookAgainSignals(
  signals: readonly PersonalReminderSignalHistory[],
): PersonalReminderSignalHistory[] {
  return signals
    .filter(
      (signal) =>
        signal.signalType === "review-later" && signal.dismissedAt === null,
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function lookAgainTarget(
  signal: Pick<
    PersonalReminderSignalHistory,
    "sourceProjectId" | "sourceRecordId" | "sourceRecordType"
  >,
): LookAgainTarget | null {
  const type: PersonalReminderSourceType = signal.sourceRecordType;
  const projectId = signal.sourceProjectId;
  if (type === "Document") {
    return { kind: "document", documentId: signal.sourceRecordId, projectId };
  }
  if (!projectId) {
    return null;
  }
  if (type === "Project") {
    return { kind: "project", projectId };
  }
  if (type === "Work") {
    return { kind: "work", projectId, workId: signal.sourceRecordId };
  }
  return {
    kind: "project-source-record",
    projectId,
    sourceId: signal.sourceRecordId,
    sourceType: type,
  };
}
