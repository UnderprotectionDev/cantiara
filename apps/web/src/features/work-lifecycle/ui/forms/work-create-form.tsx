import WorkDraftForm from "@/features/work-drafts/ui/forms/work-draft-form";

export default function WorkCreateForm({ projectId }: { projectId: string }) {
  return <WorkDraftForm projectId={projectId} />;
}
