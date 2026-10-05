import type { ProjectSourceType } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@cantiara/ui/components/sheet";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";
import ProjectSourceRecordView from "@/features/project-source-records/ui/components/project-source-record-view";
import { orpc } from "@/utils/orpc";

const DocumentPreview = lazy(
  () => import("@/features/documents/ui/components/document-preview"),
);

export type SourceRecordPreviewTarget =
  | {
      documentId: string;
      kind: "document";
      label: string;
      projectId: string | null;
    }
  | {
      kind: "project-source-record";
      label: string;
      projectId: string;
      sourceId: string;
      sourceType: ProjectSourceType;
    }
  | { kind: "work"; label: string; projectId: string; workId: string };

interface SourceRecordPreviewContextValue {
  openSourceRecord: (target: SourceRecordPreviewTarget) => void;
}

const SourceRecordPreviewContext =
  createContext<SourceRecordPreviewContextValue | null>(null);

export function sourceRecordPreviewHref(target: SourceRecordPreviewTarget) {
  if (target.kind === "work") {
    return workRecordHref(target.projectId, target.workId);
  }

  if (target.kind === "document") {
    const path = target.projectId
      ? `/projects/${encodeURIComponent(target.projectId)}`
      : "/personal-wiki";
    return `${path}#${documentRecordHash(target.documentId)}`;
  }

  return `/projects/${encodeURIComponent(target.projectId)}#${projectSourceRecordHash(
    target.sourceType,
    target.sourceId,
  )}`;
}

export function closeContextRecordPreviewOnNavigation(
  event: Pick<MouseEvent<HTMLElement>, "target">,
  onClose: () => void,
) {
  if ((event.target as Element).closest("a[href]")) {
    onClose();
  }
}

export function OpenSourceRecordButton({
  className,
  target,
}: {
  className?: string;
  target: SourceRecordPreviewTarget;
}) {
  const preview = useContext(SourceRecordPreviewContext);
  if (!preview) {
    throw new Error(
      "OpenSourceRecordButton must be rendered inside ContextRecordPreviewProvider.",
    );
  }
  const handleClick = useCallback(
    () => preview.openSourceRecord(target),
    [preview.openSourceRecord, target],
  );

  return (
    <Button
      aria-label={`Open source record: ${target.label}`}
      className={className}
      onClick={handleClick}
      type="button"
      variant="link"
    >
      Open source record
    </Button>
  );
}

export function ContextRecordPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [record, setRecord] = useState<SourceRecordPreviewTarget | null>(null);
  const openSourceRecord = useCallback(
    (target: SourceRecordPreviewTarget) => setRecord(target),
    [],
  );
  const closePreview = useCallback(() => setRecord(null), []);

  return (
    <SourceRecordPreviewContext.Provider value={{ openSourceRecord }}>
      {children}
      <ContextRecordPreviewPanel
        onClose={closePreview}
        onOpenSourceRecord={openSourceRecord}
        record={record}
      />
    </SourceRecordPreviewContext.Provider>
  );
}

export function ContextRecordPreviewPanel({
  onClose,
  onOpenSourceRecord,
  record,
}: {
  onClose: () => void;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  record: SourceRecordPreviewTarget | null;
}) {
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );
  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      closeContextRecordPreviewOnNavigation(event, onClose),
    [onClose],
  );

  if (!record) {
    return null;
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open>
      <SheetContent
        className="w-full sm:max-w-2xl"
        onClickCapture={handleClickCapture}
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{record.label}</SheetTitle>
          <SheetDescription>
            Temporary preview that keeps the current source view in place.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SourceRecordPreviewContent
            onOpenSourceRecord={onOpenSourceRecord}
            record={record}
          />
        </div>
        <SheetFooter className="border-t">
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
            href={sourceRecordPreviewHref(record)}
          >
            Open full page
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SourceRecordPreviewContent({
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

  return (
    <ProjectSourceRecordView
      projectId={record.projectId}
      readOnly
      sourceId={record.sourceId}
      sourceType={record.sourceType}
    />
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
