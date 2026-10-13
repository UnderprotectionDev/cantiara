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

const SourceRecordPreviewContent = lazy(
  () => import("./context-record-preview-content"),
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
  | { kind: "work"; label: string; projectId: string; workId: string }
  | { kind: "project"; label: string; projectId: string }
  | {
      kind: "smart-collection";
      label: string;
      projectId: string;
      collectionId: string;
      viewId: string;
    };

interface SourceRecordPreviewContextValue {
  openSourceRecord: (target: SourceRecordPreviewTarget) => void;
}

const SourceRecordPreviewContext =
  createContext<SourceRecordPreviewContextValue | null>(null);

export function sourceRecordPreviewHref(target: SourceRecordPreviewTarget) {
  if (target.kind === "project") {
    return `/projects/${encodeURIComponent(target.projectId)}`;
  }
  if (target.kind === "smart-collection") {
    return `/projects/${encodeURIComponent(target.projectId)}#smart-collection-view-${encodeURIComponent(target.viewId)}`;
  }
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

export function useOpenSourceRecord() {
  const preview = useContext(SourceRecordPreviewContext);
  if (!preview) {
    throw new Error(
      "Source record actions require ContextRecordPreviewProvider.",
    );
  }
  return preview.openSourceRecord;
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
          <Suspense
            fallback={
              <p className="text-muted-foreground" role="status">
                Loading source record…
              </p>
            }
          >
            <SourceRecordPreviewContent
              onOpenSourceRecord={onOpenSourceRecord}
              record={record}
            />
          </Suspense>
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
