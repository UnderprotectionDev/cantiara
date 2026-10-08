import { useQuery } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense } from "react";
import { orpc } from "@/utils/orpc";
import type { SourceRecordPreviewTarget } from "./context-record-preview";

const DocumentPreview = lazy(
  () => import("@/features/documents/ui/components/document-preview"),
);
const ProjectSourceRecordView = lazy(
  () =>
    import(
      "@/features/project-source-records/ui/components/project-source-record-view"
    ),
);

export default function ContextRecordPreviewContent({
  onOpenSourceRecord,
  record,
}: {
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  record: SourceRecordPreviewTarget;
}) {
  if (record.kind === "work") {
    return (
      <WorkRecordPreview projectId={record.projectId} workId={record.workId} />
    );
  }

  if (record.kind === "document") {
    return (
      <DocumentRecordPreview
        documentId={record.documentId}
        onOpenSourceRecord={onOpenSourceRecord}
        projectId={record.projectId}
      />
    );
  }

  if (record.kind === "project") {
    return <ProjectRecordPreview projectId={record.projectId} />;
  }
  if (record.kind === "smart-collection") {
    return <SmartCollectionRecordPreview record={record} />;
  }

  return (
    <Suspense fallback={<PreviewStatus>Loading source record…</PreviewStatus>}>
      <ProjectSourceRecordView
        projectId={record.projectId}
        readOnly
        sourceId={record.sourceId}
        sourceType={record.sourceType}
      />
    </Suspense>
  );
}

function ProjectRecordPreview({ projectId }: { projectId: string }) {
  const project = useQuery(orpc.project.queryOptions({ input: { projectId } }));
  if (project.isPending) {
    return <PreviewStatus>Loading source record…</PreviewStatus>;
  }
  if (project.isError || !project.data) {
    return (
      <PreviewStatus role="alert">Source record is unavailable.</PreviewStatus>
    );
  }
  return (
    <section aria-label="Project record" className="space-y-4">
      <h2 className="font-semibold text-2xl tracking-tight">
        {project.data.name}
      </h2>
      <p className="text-muted-foreground text-sm">{project.data.status}</p>
      <p className="whitespace-pre-wrap text-sm">{project.data.purpose}</p>
    </section>
  );
}

function SmartCollectionRecordPreview({
  record,
}: {
  record: Extract<SourceRecordPreviewTarget, { kind: "smart-collection" }>;
}) {
  const view = useQuery(
    orpc.smartCollectionView.queryOptions({
      input: { viewId: record.viewId, readOnly: true },
    }),
  );
  if (view.isPending) {
    return <PreviewStatus>Loading source record…</PreviewStatus>;
  }
  if (
    view.isError ||
    !view.data ||
    view.data.collectionId !== record.collectionId ||
    view.data.projectId !== record.projectId
  ) {
    return (
      <PreviewStatus role="alert">Source record is unavailable.</PreviewStatus>
    );
  }
  return (
    <section aria-label="Smart Collection record" className="space-y-4">
      <h2 className="font-semibold text-2xl tracking-tight">
        {view.data.collectionName}
      </h2>
      <p className="text-muted-foreground text-sm">
        {view.data.name} · {view.data.sourceType} · {view.data.presentation}
      </p>
      <ul className="space-y-2">
        {view.data.works.map((work) => (
          <li key={work.id}>
            {work.key} · {work.title}
          </li>
        ))}
        {view.data.documents.map((document) => (
          <li key={document.id}>{document.title}</li>
        ))}
        {view.data.projectSourceRecords.map((source) => (
          <li key={source.id}>{source.title}</li>
        ))}
      </ul>
    </section>
  );
}

function WorkRecordPreview({
  projectId,
  workId,
}: {
  projectId: string;
  workId: string;
}) {
  const work = useQuery(orpc.work.queryOptions({ input: { workId } }));

  if (work.isPending) {
    return <PreviewStatus>Loading source record…</PreviewStatus>;
  }

  if (work.isError || !work.data || work.data.projectId !== projectId) {
    return (
      <PreviewStatus role="alert">Source record is unavailable.</PreviewStatus>
    );
  }

  return (
    <section aria-label="Work record" className="space-y-4">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">{work.data.key}</p>
        <h2 className="font-semibold text-2xl tracking-tight">
          {work.data.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {work.data.type} · {work.data.status}
          {work.data.archivedAt ? " · Archived" : ""}
        </p>
      </header>
      <dl className="grid gap-3 rounded-lg border border-border/70 bg-card/35 p-4 sm:grid-cols-3">
        <div>
          <dt className="font-medium text-sm">Horizon</dt>
          <dd className="text-muted-foreground text-sm">
            {work.data.roadmapHorizon ?? "No horizon"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-sm">Planned start</dt>
          <dd className="text-muted-foreground text-sm">
            {work.data.plannedStartDate ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-sm">Target date</dt>
          <dd className="text-muted-foreground text-sm">
            {work.data.targetDate ?? "—"}
          </dd>
        </div>
      </dl>
      <p className="whitespace-pre-wrap text-sm">
        {work.data.description || "No description."}
      </p>
    </section>
  );
}

function DocumentRecordPreview({
  documentId,
  onOpenSourceRecord,
  projectId,
}: {
  documentId: string;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  projectId: string | null;
}) {
  const document = useQuery(
    orpc.document.queryOptions({ input: { documentId } }),
  );
  const body = document.data?.body ?? "";
  const liveWorkBlocks = useQuery({
    ...orpc.documentLiveWorkBlocks.queryOptions({
      input: { body, documentId },
    }),
    enabled: document.isSuccess,
  });
  const liveOtherBlocks = useQuery({
    ...orpc.documentLiveOtherBlocks.queryOptions({
      input: { body, documentId },
    }),
    enabled: document.isSuccess,
  });
  const documentReferences = useQuery({
    ...orpc.documentRecordReferences.queryOptions({
      input: { body, documentId },
    }),
    enabled: document.isSuccess,
  });

  if (document.isPending) {
    return <PreviewStatus>Loading source record…</PreviewStatus>;
  }

  if (
    document.isError ||
    !document.data ||
    document.data.projectId !== projectId
  ) {
    return (
      <PreviewStatus role="alert">Source record is unavailable.</PreviewStatus>
    );
  }

  return (
    <section aria-label="Document record" className="space-y-4">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Document · {document.data.type}
        </p>
        <h2 className="font-semibold text-2xl tracking-tight">
          {document.data.title}
        </h2>
      </header>
      <Suspense
        fallback={<PreviewStatus>Loading document preview…</PreviewStatus>}
      >
        <DocumentPreview
          documentReferences={
            documentReferences.isPending
              ? undefined
              : (documentReferences.data ?? [])
          }
          liveOtherBlocks={
            liveOtherBlocks.isPending ? undefined : (liveOtherBlocks.data ?? [])
          }
          liveWorkBlocks={
            liveWorkBlocks.isPending ? undefined : (liveWorkBlocks.data ?? [])
          }
          onOpenSourceRecord={onOpenSourceRecord}
          source={document.data.body}
        />
      </Suspense>
    </section>
  );
}

function PreviewStatus({
  children,
  role = "status",
}: {
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <p className="text-muted-foreground" role={role}>
      {children}
    </p>
  );
}
