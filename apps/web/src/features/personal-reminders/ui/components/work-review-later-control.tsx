import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import PersonalReminderControl from "@/components/personal-reminder-control";

export default function WorkReviewLaterControl({
  compact = false,
  work,
}: {
  compact?: boolean;
  work: WorkProfile;
}) {
  return (
    <PersonalReminderControl
      compact={compact}
      sourceRecordId={work.id}
      sourceRecordType="Work"
      sourceTitle={`${work.key} · ${work.title}`}
    />
  );
}
