import type { PersonalReminderSourceType } from "@cantiara/api/personal-reminders";
import type {
  ProjectSourceRecord,
  ProjectSourceType,
} from "@cantiara/api/project-source-records";
import { useQuery } from "@tanstack/react-query";
import FavoriteControl from "@/features/favorites/ui/components/favorite-control";
import PersonalReminderControl from "@/features/personal-reminders/ui/components/personal-reminder-control";
import { orpc } from "@/utils/orpc";

export default function ProjectSourceRecordView({
  projectId,
  readOnly = false,
  sourceId,
  sourceType,
}: {
  projectId: string;
  readOnly?: boolean;
  sourceId: string;
  sourceType: ProjectSourceType;
}) {
  const source = useQuery(
    orpc.projectSourceRecord.queryOptions({
      input: { sourceId, sourceType },
    }),
  );

  if (source.isPending) {
    return (
      <section aria-label={sourceType} className="space-y-4">
        <h2 className="font-semibold text-2xl tracking-tight">{sourceType}</h2>
        <p className="text-muted-foreground" role="status">
          Loading source record…
        </p>
      </section>
    );
  }

  if (source.isError || !source.data || source.data.projectId !== projectId) {
    return (
      <section aria-label={sourceType} className="space-y-4">
        <h2 className="font-semibold text-2xl tracking-tight">{sourceType}</h2>
        <p className="text-muted-foreground" role="alert">
          Source record is unavailable.
        </p>
      </section>
    );
  }

  const reminderType = reminderSourceType(source.data.sourceType);

  return (
    <section aria-label={source.data.sourceType} className="space-y-5">
      <header className="surface-header">
        <p className="text-muted-foreground text-sm">
          {source.data.sourceType}
        </p>
        <h2 className="mt-1 font-semibold text-2xl tracking-tight">
          {recordTitle(source.data)}
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          {recordStatus(source.data)}
        </p>
        {source.data.sourceType === "Decision" ? (
          <FavoriteControl
            sourceRecordId={source.data.id}
            sourceRecordType="Decision"
          />
        ) : null}
        {reminderType && !readOnly ? (
          <div className="mt-4">
            <PersonalReminderControl
              compact
              sourceRecordId={source.data.id}
              sourceRecordType={reminderType}
              sourceTitle={recordTitle(source.data)}
            />
          </div>
        ) : null}
      </header>
      <dl className="grid gap-5 rounded-lg border border-border/70 bg-card/35 p-5">
        {recordFields(source.data).map(([label, value]) => (
          <div className="space-y-1" key={label}>
            <dt className="font-medium text-sm">{label}</dt>
            <dd className="whitespace-pre-wrap text-muted-foreground text-sm">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function reminderSourceType(
  sourceType: ProjectSourceType,
): PersonalReminderSourceType | null {
  switch (sourceType) {
    case "Decision":
    case "Risk":
    case "Milestone":
    case "Project Release":
    case "Production Incident":
      return sourceType;
    default:
      return null;
  }
}

function recordTitle(record: ProjectSourceRecord) {
  return record.sourceType === "Project Release" ? record.name : record.title;
}

function recordStatus(record: ProjectSourceRecord) {
  return "life" in record ? record.life : record.status;
}

function recordFields(record: ProjectSourceRecord): [string, string][] {
  switch (record.sourceType) {
    case "Validation Record":
      return [
        ["Method", record.method],
        ["Result", record.result ?? ""],
      ];
    case "Risk":
      return [
        ["Description", record.description ?? ""],
        ["Impact", record.impact ?? ""],
        ["Probability", record.probability ?? ""],
        ["Response/mitigation", record.response ?? ""],
        ["Rationale", record.rationale ?? ""],
      ];
    case "Assumption":
      return [
        ["Statement", record.statement],
        ["Rationale", record.rationale ?? ""],
      ];
    case "Open Question":
      return [
        ["Question", record.question],
        ["Context", record.context ?? ""],
        ["Answer", record.answer ?? ""],
      ];
    case "Decision":
      return [
        ["Decision text", record.decision],
        ["Rationale", record.rationale ?? ""],
      ];
    case "Milestone":
      return [
        ["Description", record.description ?? ""],
        ["Target date", record.targetDate ?? ""],
      ];
    case "Project Release":
      return [
        ["Version label", record.versionLabel ?? ""],
        ["Description", record.description ?? ""],
      ];
    case "Production Incident":
      return [
        ["Occurred at", record.occurredAt],
        ["Impact", record.impact ?? ""],
        ["Detected how", record.detectedHow ?? ""],
        ["Resolution", record.resolution ?? ""],
        ["Root cause", record.rootCause ?? ""],
        ["Learning", record.learning ?? ""],
      ];
    default:
      return [];
  }
}
