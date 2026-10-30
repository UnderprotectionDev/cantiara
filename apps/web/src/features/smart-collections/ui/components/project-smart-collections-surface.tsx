// biome-ignore-all lint/performance/noJsxPropsBind: This small form binds its local fields and submit action.

import type {
  SetSmartCollectionSubscriptionInput,
  SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Label } from "@cantiara/ui/components/label";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLinkProps } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { ExportListAction } from "@/components/export-list-action";
import FavoriteControl from "@/components/favorite-control";
import {
  type ExportHandoff,
  groupRecordIdsByType,
  scopeForProjects,
  WORK_LIST_EXPORT_FIELDS,
} from "@/features/data-export/lib/export-handoff";
import {
  OpenSourceRecordButton,
  type SourceRecordPreviewTarget,
} from "@/features/record-discovery/ui/components/context-record-preview";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import {
  filterSmartCollectionWorks,
  type SmartCollectionInsightSelection,
  toggleSmartCollectionInsightSelection,
} from "../../lib/smart-collection-insights";
import {
  previewSmartCollectionMembership,
  type SmartCollectionMembershipFieldChange,
  type SmartCollectionMembershipPreviewRecord,
} from "../../lib/smart-collection-membership-preview";
import { newWorkLinkTarget } from "../../lib/smart-collection-work-prefill";
import SmartCollectionCreateForm from "../forms/smart-collection-create-form";
import { SmartCollectionInsights } from "./smart-collection-insights";

const SMART_COLLECTION_DRAG_TYPE = "smart-collection-record";

type DragEndEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0];
type DragOverEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragOver"]>
>[0];

type SmartCollectionDragRecord = SmartCollectionMembershipPreviewRecord & {
  id: string;
  recordName: string;
  sourceViewId: string;
};

interface SmartCollectionMembershipPreview {
  changes: SmartCollectionMembershipFieldChange[];
  recordName: string;
  viewId: string;
}

function collectionViewDropId(viewId: string) {
  return `smart-collection-view:${viewId}`;
}

function previewForDragEvent(
  event: DragOverEvent | DragEndEvent,
  viewsByDropId: ReadonlyMap<string, SmartCollectionViewSource>,
): SmartCollectionMembershipPreview | null {
  const dragData = event.operation.source?.data as
    | { smartCollectionRecord?: SmartCollectionDragRecord }
    | undefined;
  const record = dragData?.smartCollectionRecord;
  const view = viewsByDropId.get(String(event.operation.target?.id ?? ""));
  if (!(record && view) || record.sourceViewId === view.id) {
    return null;
  }

  const changes = previewSmartCollectionMembership(record, view);
  return changes
    ? { changes, recordName: record.recordName, viewId: view.id }
    : null;
}

function MembershipReasons({ reasons }: { reasons: string[] }) {
  return (
    <p className="ml-5 text-muted-foreground text-xs">
      <span className="font-medium">Membership reason: </span>
      {reasons.join(" · ")}
    </p>
  );
}

function CollectionMember({
  children,
  reasons,
  record,
  target,
}: {
  children: ReactNode;
  reasons: string[];
  record: SmartCollectionDragRecord;
  target: SourceRecordPreviewTarget;
}) {
  const draggable = useDraggable({
    data: { smartCollectionRecord: record },
    id: `smart-collection-record:${record.sourceViewId}:${record.sourceType}:${record.id}`,
    type: SMART_COLLECTION_DRAG_TYPE,
  });

  return (
    <li
      className={`space-y-1 ${draggable.isDragging ? "opacity-50" : ""}`}
      ref={draggable.ref}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={`Drag ${record.recordName}`}
          className="min-h-8 min-w-8 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          ref={draggable.handleRef}
          size="icon"
          type="button"
          variant="ghost"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </Button>
        <span>{children}</span>
        <OpenSourceRecordButton className="h-8 px-0" target={target} />
      </div>
      <MembershipReasons reasons={reasons} />
    </li>
  );
}

function CollectionMembers({
  view,
  works = view.works,
}: {
  view: SmartCollectionViewSource;
  works?: SmartCollectionViewSource["works"];
}) {
  if (view.sourceType === "Work") {
    if (works.length === 0) {
      return <p>No Work matches this view.</p>;
    }
    return (
      <ul className="list-inside list-disc space-y-2">
        {works.map((record) => (
          <CollectionMember
            key={record.id}
            reasons={record.membershipReasons}
            record={{
              id: record.id,
              projectId: record.projectId,
              recordName: `${record.key} · ${record.title}`,
              sourceType: "Work",
              sourceViewId: view.id,
              status: record.status,
              workType: record.type,
              workspaceId: view.workspaceId,
            }}
            target={{
              kind: "work",
              label: `${record.key} · ${record.title}`,
              projectId: record.projectId,
              workId: record.id,
            }}
          >
            {record.key} · {record.title}
          </CollectionMember>
        ))}
      </ul>
    );
  }

  if (view.sourceType === "Document" || view.sourceType === "Wiki Document") {
    if (view.documents.length === 0) {
      return <p>No {view.sourceType} matches this view.</p>;
    }
    return (
      <ul className="list-inside list-disc space-y-2">
        {view.documents.map((record) => (
          <CollectionMember
            key={record.id}
            reasons={record.membershipReasons}
            record={{
              documentType: record.type,
              id: record.id,
              projectId: record.projectId,
              recordName: record.title,
              sourceType: view.sourceType,
              sourceViewId: view.id,
              workspaceId: record.workspaceId,
            }}
            target={{
              kind: "document",
              documentId: record.id,
              label: record.title,
              projectId: record.projectId,
            }}
          >
            {record.title}
          </CollectionMember>
        ))}
      </ul>
    );
  }

  if (view.sourceType === "Test Gap") {
    if (view.gaps.length === 0) {
      return <p>No Test Gap matches this view.</p>;
    }
    return (
      <ul className="list-inside list-disc space-y-2">
        {view.gaps.map((record) => (
          <CollectionMember
            key={record.id}
            reasons={record.membershipReasons}
            record={{
              id: record.id,
              projectId: record.projectId,
              recordName: record.title,
              sourceType: view.sourceType,
              sourceViewId: view.id,
              status: record.state,
              workspaceId: view.workspaceId,
            }}
            target={{
              kind: "test-gap",
              gapId: record.id,
              label: record.title,
              projectId: record.projectId,
            }}
          >
            {record.title}
          </CollectionMember>
        ))}
      </ul>
    );
  }

  if (view.projectSourceRecords.length === 0) {
    return <p>No {view.sourceType} matches this view.</p>;
  }
  return (
    <ul className="list-inside list-disc space-y-2">
      {view.projectSourceRecords.map((record) => (
        <CollectionMember
          key={record.id}
          reasons={record.membershipReasons}
          record={{
            id: record.id,
            projectId: record.projectId,
            recordName: record.title,
            sourceType: record.sourceType,
            sourceViewId: view.id,
            status: record.status,
            workspaceId: view.workspaceId,
          }}
          target={{
            kind: "project-source-record",
            label: record.title,
            projectId: record.projectId,
            sourceId: record.id,
            sourceType: record.sourceType,
          }}
        >
          {record.title}
        </CollectionMember>
      ))}
    </ul>
  );
}

function MembershipFieldChangePreview({
  preview,
}: {
  preview: SmartCollectionMembershipPreview;
}) {
  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-md bg-muted/40 p-3"
      role="status"
    >
      <p className="font-medium text-sm">Field change preview</p>
      <p className="text-sm">{preview.recordName}</p>
      <ul className="list-inside list-disc text-sm">
        {preview.changes.map((change) => (
          <li key={change.field}>
            {change.field}: {change.from} → {change.to}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        No membership is written by this preview.
      </p>
    </div>
  );
}

export function smartCollectionSubscriptionMutationInput(
  view: Pick<SmartCollectionViewSource, "notifyOnLeave">,
  toggle: { checked: boolean; kind: "notifyOnLeave" | "subscribe" },
): Omit<SetSmartCollectionSubscriptionInput, "viewId"> {
  if (toggle.kind === "notifyOnLeave") {
    return { notifyOnLeave: toggle.checked, subscribe: true };
  }
  return {
    notifyOnLeave: toggle.checked ? view.notifyOnLeave : false,
    subscribe: toggle.checked,
  };
}

function CollectionSubscriptionControls({
  view,
}: {
  view: SmartCollectionViewSource;
}) {
  const queryClient = useQueryClient();
  const subscription = useMutation({
    mutationFn: (input: Omit<SetSmartCollectionSubscriptionInput, "viewId">) =>
      runOnlineOnlyWrite(() =>
        client.setSmartCollectionSubscription({ viewId: view.id, ...input }),
      ),
    onSuccess: async () => {
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
    },
  });
  const notifyOnLeaveId = `smart-collection-notify-on-leave-${view.id}`;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox
          checked={view.isSubscribed}
          disabled={subscription.isPending}
          onCheckedChange={(checked) =>
            subscription.mutate(
              smartCollectionSubscriptionMutationInput(view, {
                checked,
                kind: "subscribe",
              }),
            )
          }
        />
        Subscribe
      </Label>
      <Label
        className={`flex items-center gap-2 font-normal ${view.isSubscribed ? "" : "text-muted-foreground"}`}
        htmlFor={notifyOnLeaveId}
      >
        <Checkbox
          aria-describedby={
            view.isSubscribed ? undefined : `${notifyOnLeaveId}-description`
          }
          checked={view.notifyOnLeave}
          disabled={!view.isSubscribed || subscription.isPending}
          id={notifyOnLeaveId}
          onCheckedChange={(checked) =>
            subscription.mutate(
              smartCollectionSubscriptionMutationInput(view, {
                checked,
                kind: "notifyOnLeave",
              }),
            )
          }
        />
        Notify on leave
      </Label>
      {view.isSubscribed ? null : (
        <p
          className="ml-6 text-muted-foreground text-xs"
          id={`${notifyOnLeaveId}-description`}
        >
          Turn on Subscribe first.
        </p>
      )}
      {subscription.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Smart Collection subscription could not be updated.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A Smart Collection snapshot is only offered when the stored conditions can
 * be verified against a reader: Work reads its `status` and carries `type` in
 * the subject, while every other in-catalog type has no filter column, so a
 * collection with a condition would never pass the preview.
 */
function collectionOffersExport(view: SmartCollectionViewSource): boolean {
  if (view.sourceType === "Work") {
    return true;
  }
  return !Object.values(view.conditions).some(
    (value) => typeof value === "string" && value.length > 0,
  );
}

/**
 * The exact on-screen scope of a Smart Collection view: its stored Projects and
 * conditions, and the records shown (the Insights slices narrow them). The
 * server resolves the collection again and rejects a mismatch.
 */
function collectionExportHandoff(
  view: SmartCollectionViewSource,
  shownWorks: SmartCollectionViewSource["works"] | undefined,
): ExportHandoff {
  const isWork = view.sourceType === "Work";
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(view.conditions)) {
    if (typeof value === "string" && value.length > 0) {
      filters[key] = value;
    }
  }
  const records = isWork
    ? (shownWorks ?? view.works).map(({ id, type }) => ({ id, type }))
    : view.projectSourceRecords.map(({ id, sourceType }) => ({
        id,
        type: sourceType,
      }));
  return {
    filters,
    recordIdsByType: groupRecordIdsByType(records),
    scope: scopeForProjects(view.scope.projectIds),
    view: { id: view.id, kind: "Smart Collection", name: view.collectionName },
    ...(isWork ? { visibleFields: WORK_LIST_EXPORT_FIELDS } : {}),
  };
}

function CollectionViewCard({
  preview,
  view,
}: {
  preview: SmartCollectionMembershipPreview | null;
  view: SmartCollectionViewSource;
}) {
  const [activePanel, setActivePanel] = useState<"records" | "insights">(
    "records",
  );
  const [selectedSlices, setSelectedSlices] = useState<
    SmartCollectionInsightSelection[]
  >([]);
  const droppable = useDroppable({
    accept: SMART_COLLECTION_DRAG_TYPE,
    id: collectionViewDropId(view.id),
  });
  const showDropTarget = droppable.isDropTarget && preview?.viewId === view.id;
  const isWorkCollection = view.sourceType === "Work";
  const newWorkLinkProps = useLinkProps(newWorkLinkTarget(view));
  const now = new Date();
  const selectedWorks = isWorkCollection
    ? selectedSlices.reduce(
        (current, selection) =>
          filterSmartCollectionWorks(current, selection, now),
        view.works,
      )
    : undefined;
  const selectSlice = (selection: SmartCollectionInsightSelection) => {
    setSelectedSlices((current) =>
      toggleSmartCollectionInsightSelection(current, selection),
    );
  };
  const showAllRecords = () => {
    setSelectedSlices([]);
    setActivePanel("records");
  };

  return (
    <section
      className={`space-y-2 rounded-lg border p-4 transition-colors motion-reduce:transition-none ${showDropTarget ? "border-primary/70 bg-primary/5 ring-2 ring-primary/30" : ""}`}
      ref={droppable.ref}
    >
      <h3 className="font-medium">
        {view.collectionName} · {view.name}
      </h3>
      <p className="text-muted-foreground text-sm">
        {view.sourceType} · {view.presentation}
      </p>
      {view.preparedReason ? null : (
        <FavoriteControl
          sourceRecordId={view.collectionId}
          sourceRecordType="Smart Collection"
        />
      )}
      {view.preparedReason ? null : (
        <CollectionSubscriptionControls view={view} />
      )}
      {isWorkCollection && !view.preparedReason ? (
        <a
          {...newWorkLinkProps}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          New work
        </a>
      ) : null}
      {view.preparedReason || !collectionOffersExport(view) ? null : (
        <ExportListAction
          describe={() => collectionExportHandoff(view, selectedWorks)}
          label={view.collectionName}
        />
      )}
      {isWorkCollection ? (
        <fieldset className="flex gap-2">
          <legend className="sr-only">Collection view</legend>
          <Button
            aria-pressed={activePanel === "records"}
            onClick={() => setActivePanel("records")}
            type="button"
            variant={activePanel === "records" ? "secondary" : "outline"}
          >
            Records
          </Button>
          <Button
            aria-pressed={activePanel === "insights"}
            onClick={() => setActivePanel("insights")}
            type="button"
            variant={activePanel === "insights" ? "secondary" : "outline"}
          >
            Insights
          </Button>
        </fieldset>
      ) : null}
      {preview?.viewId === view.id ? (
        <MembershipFieldChangePreview preview={preview} />
      ) : null}
      <CollectionViewContent
        activePanel={activePanel}
        isWorkCollection={isWorkCollection}
        now={now}
        selectedSlices={selectedSlices}
        selectedWorks={selectedWorks}
        selectSlice={selectSlice}
        showAllRecords={showAllRecords}
        view={view}
      />{" "}
    </section>
  );
}

export default function ProjectSmartCollectionsSurface({
  projectId,
  selectedViewId,
}: {
  projectId: string;
  selectedViewId?: string;
}) {
  const [membershipPreview, setMembershipPreview] =
    useState<SmartCollectionMembershipPreview | null>(null);
  const previousProjectId = useRef(projectId);
  const previousSelectedViewId = useRef(selectedViewId);
  const options = orpc.smartCollectionViews.queryOptions({
    input: { projectId },
  });
  const views = useQuery(options);

  useEffect(() => {
    if (previousProjectId.current === projectId) {
      return;
    }
    previousProjectId.current = projectId;
    setMembershipPreview(null);
  }, [projectId]);

  useEffect(() => {
    if (previousSelectedViewId.current === selectedViewId) {
      return;
    }
    previousSelectedViewId.current = selectedViewId;
    setMembershipPreview(null);
  }, [selectedViewId]);

  const visible = selectedViewId
    ? views.data?.filter(({ id }) => id === selectedViewId)
    : views.data;
  const viewsByDropId = new Map<string, SmartCollectionViewSource>(
    (visible ?? []).map((view) => [collectionViewDropId(view.id), view]),
  );
  return (
    <section aria-label="Smart Collection" className="space-y-5">
      <h2 className="font-semibold text-2xl">Smart Collection</h2>
      <SmartCollectionCreateForm projectId={projectId} />
      {views.isError ? (
        <p role="alert">Smart Collection is unavailable.</p>
      ) : null}
      <DragDropProvider
        onDragEnd={(event) => {
          setMembershipPreview(
            event.canceled ? null : previewForDragEvent(event, viewsByDropId),
          );
        }}
        onDragOver={(event) => {
          setMembershipPreview(previewForDragEvent(event, viewsByDropId));
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {visible?.map((view) => (
            <CollectionViewCard
              key={view.id}
              preview={membershipPreview}
              view={view}
            />
          ))}
        </div>
      </DragDropProvider>
    </section>
  );
}

function CollectionViewContent({
  isWorkCollection,
  activePanel,
  now,
  selectSlice,
  showAllRecords,
  selectedSlices,
  selectedWorks,
  view,
}: {
  isWorkCollection: boolean;
  activePanel: "records" | "insights";
  now: Date;
  selectSlice: (selection: SmartCollectionInsightSelection) => void;
  showAllRecords: () => void;
  selectedSlices: SmartCollectionInsightSelection[];
  selectedWorks:
    | {
        createdAt: string;
        effort: string | null;
        id: string;
        key: string;
        title: string;
        status: string;
        statusChangedAt: string;
        type: string;
        projectId: string;
        membershipReasons: string[];
      }[]
    | undefined;
  view: SmartCollectionViewSource;
}) {
  return (
    <>
      {" "}
      {isWorkCollection && activePanel === "insights" ? (
        <SmartCollectionInsights
          now={now}
          onSelectSlice={selectSlice}
          onShowAllRecords={showAllRecords}
          selectedSlices={selectedSlices}
          works={selectedWorks ?? []}
        />
      ) : null}
      {isWorkCollection &&
      selectedSlices.length > 0 &&
      activePanel === "records" ? (
        <Button onClick={showAllRecords} type="button" variant="ghost">
          Show all records
        </Button>
      ) : null}
      {!isWorkCollection ||
      activePanel === "records" ||
      selectedSlices.length > 0 ? (
        <CollectionMembers view={view} works={selectedWorks} />
      ) : null}
    </>
  );
}
