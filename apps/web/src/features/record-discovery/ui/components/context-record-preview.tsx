// biome-ignore-all lint/performance/noJsxPropsBind: The Base UI lifecycle callback records the opening control for nested previews.
import type { ProjectSourceType } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import {
  createSheetHandle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cantiara/ui/components/sheet";
import {
  createContext,
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AppLink } from "@/components/app-link";
import {
  documentRecordHash,
  projectSourceRecordHash,
  testGapRecordHash,
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
  | {
      kind: "test-gap";
      gapId: string;
      label: string;
      projectId: string;
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
  handle: ReturnType<typeof createSheetHandle<SourceRecordPreviewTarget>>;
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
  if (target.kind === "test-gap") {
    return `/projects/${encodeURIComponent(target.projectId)}#${testGapRecordHash(target.gapId)}`;
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
  return (
    <SheetTrigger
      aria-label={`Open source record: ${target.label}`}
      className={className}
      handle={preview.handle}
      payload={target}
      render={<Button variant="link" />}
    >
      Open source record
    </SheetTrigger>
  );
}

export function ContextRecordPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [handle] = useState(createSheetHandle<SourceRecordPreviewTarget>);
  const openingControl = useRef<HTMLElement | null>(null);
  const openSourceRecord = useCallback(
    (target: SourceRecordPreviewTarget) => handle.openWithPayload(target),
    [handle],
  );
  const closePreview = useCallback(() => handle.close(), [handle]);
  const restoreFocus = useCallback(() => {
    const element = openingControl.current;
    return element?.isConnected ? element : true;
  }, []);

  return (
    <SourceRecordPreviewContext.Provider value={{ handle, openSourceRecord }}>
      {children}
      <Sheet
        handle={handle}
        onOpenChange={(open, event) => {
          if (open && !handle.isOpen) {
            openingControl.current =
              event.trigger instanceof HTMLElement ? event.trigger : null;
          }
        }}
      >
        {({ payload }) =>
          payload ? (
            <ContextRecordPreviewPanel
              finalFocus={restoreFocus}
              onClose={closePreview}
              onOpenSourceRecord={openSourceRecord}
              record={payload}
            />
          ) : null
        }
      </Sheet>
    </SourceRecordPreviewContext.Provider>
  );
}

export function ContextRecordPreviewPanel({
  finalFocus,
  onClose,
  onOpenSourceRecord,
  record,
}: {
  finalFocus?: () => HTMLElement | boolean;
  onClose: () => void;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  record: SourceRecordPreviewTarget;
}) {
  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      closeContextRecordPreviewOnNavigation(event, onClose),
    [onClose],
  );

  return (
    <SheetContent
      className="w-full sm:max-w-2xl"
      finalFocus={finalFocus}
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
        <AppLink
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
          href={sourceRecordPreviewHref(record)}
        >
          Open full page
        </AppLink>
      </SheetFooter>
    </SheetContent>
  );
}
