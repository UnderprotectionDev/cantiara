import { useLocation } from "@tanstack/react-router";
import DocumentsSurface from "@/features/documents/ui/components/project-documents-surface";
import { documentRecordFromHash } from "@/features/project-shell/lib/project-shell-navigation";

export default function PersonalWikiSurface() {
  const hash = useLocation({ select: (location) => location.hash });
  const selected = documentRecordFromHash(hash);
  return (
    <section
      aria-label="Personal Wiki"
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <h1 className="font-semibold text-3xl">Personal Wiki</h1>
      <DocumentsSurface
        projectId={null}
        selectedDocumentId={selected?.documentId}
        starterSkeletons={[]}
      />
    </section>
  );
}
