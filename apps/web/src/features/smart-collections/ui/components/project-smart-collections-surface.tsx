// biome-ignore-all lint/performance/noJsxPropsBind: This small form binds its local fields and submit action.

import { documentTypeSchema } from "@cantiara/api/documents";
import {
  type CreateSmartCollectionInput,
  type SetSmartCollectionSubscriptionInput,
  SMART_COLLECTION_SOURCE_TYPES,
  SMART_COLLECTION_STATUS_OPTIONS,
  type SmartCollectionSourceType,
  type SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";
import { WORK_TYPE_OPTIONS } from "@cantiara/api/work-lifecycle";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
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
import FavoriteControl from "@/features/favorites/ui/components/favorite-control";
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

function buildCollectionConditions({
  documentType,
  sourceType,
  status,
  tag,
  workType,
}: {
  documentType: string;
  sourceType: SmartCollectionSourceType;
  status: string;
  tag: string;
  workType: string;
}): CreateSmartCollectionInput["conditions"] {
  const conditions: CreateSmartCollectionInput["conditions"] = {};
  if (sourceType === "Work") {
    if (status) {
      conditions.status = status as NonNullable<
        CreateSmartCollectionInput["conditions"]["status"]
      >;
    }
    if (workType) {
      conditions.type = workType as NonNullable<
        CreateSmartCollectionInput["conditions"]["type"]
      >;
    }
    return conditions;
  }

  if (sourceType === "Document" || sourceType === "Wiki Document") {
    if (documentType) {
      conditions.documentType = documentType as NonNullable<
        CreateSmartCollectionInput["conditions"]["documentType"]
      >;
    }
    if (tag.trim()) {
      conditions.tag = tag.trim();
    }
    return conditions;
  }

  if (status) {
    conditions.status = status as NonNullable<
      CreateSmartCollectionInput["conditions"]["status"]
    >;
  }
  return conditions;
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
        <input
          checked={view.isSubscribed}
          disabled={subscription.isPending}
          onChange={(event) =>
            subscription.mutate(
              smartCollectionSubscriptionMutationInput(view, {
                checked: event.currentTarget.checked,
                kind: "subscribe",
              }),
            )
          }
          type="checkbox"
        />
        Subscribe
      </Label>
      <Label
        className={`flex items-center gap-2 font-normal ${view.isSubscribed ? "" : "text-muted-foreground"}`}
        htmlFor={notifyOnLeaveId}
      >
        <input
          aria-describedby={
            view.isSubscribed ? undefined : `${notifyOnLeaveId}-description`
          }
          checked={view.notifyOnLeave}
          disabled={!view.isSubscribed || subscription.isPending}
          id={notifyOnLeaveId}
          onChange={(event) =>
            subscription.mutate(
              smartCollectionSubscriptionMutationInput(view, {
                checked: event.currentTarget.checked,
                kind: "notifyOnLeave",
              }),
            )
          }
          type="checkbox"
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
      <FavoriteControl
        sourceRecordId={view.collectionId}
        sourceRecordType="Smart Collection"
      />
      <CollectionSubscriptionControls view={view} />
      {isWorkCollection ? (
        <a
          {...newWorkLinkProps}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          New work
        </a>
      ) : null}
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
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [viewName, setViewName] = useState("Default");
  const [sourceType, setSourceType] =
    useState<SmartCollectionSourceType>("Work");
  const [projectIds, setProjectIds] = useState<string[]>([projectId]);
  const [status, setStatus] = useState("");
  const [workType, setWorkType] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [membershipPreview, setMembershipPreview] =
    useState<SmartCollectionMembershipPreview | null>(null);
  const pendingKey = useRef<string | null>(null);
  const previousSelectedViewId = useRef(selectedViewId);
  const options = orpc.smartCollectionViews.queryOptions({
    input: { projectId },
  });
  const views = useQuery(options);
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projects = projectsQuery.data ?? [];
  const statusOptions = SMART_COLLECTION_STATUS_OPTIONS[sourceType] ?? [];
  const isDocumentSource =
    sourceType === "Document" || sourceType === "Wiki Document";

  useEffect(() => {
    setProjectIds([projectId]);
    setMembershipPreview(null);
  }, [projectId]);

  useEffect(() => {
    if (previousSelectedViewId.current === selectedViewId) {
      return;
    }
    previousSelectedViewId.current = selectedViewId;
    setMembershipPreview(null);
  }, [selectedViewId]);

  const create = useMutation({
    mutationFn: () => {
      pendingKey.current ??= crypto.randomUUID();
      const conditions = buildCollectionConditions({
        documentType,
        sourceType,
        status,
        tag,
        workType,
      });
      return runOnlineOnlyWrite(() =>
        client.createSmartCollection({
          clientIdempotencyKey: pendingKey.current as string,
          projectId,
          sourceType,
          ...(sourceType === "Wiki Document" ? {} : { scope: { projectIds } }),
          name,
          viewName,
          presentation: "List",
          conditions,
        }),
      );
    },
    onSuccess: async () => {
      pendingKey.current = null;
      setName("");
      setError(null);
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Smart Collection could not be saved.",
      ),
  });
  const visible = selectedViewId
    ? views.data?.filter(({ id }) => id === selectedViewId)
    : views.data;
  const viewsByDropId = new Map<string, SmartCollectionViewSource>(
    (visible ?? []).map((view) => [collectionViewDropId(view.id), view]),
  );
  let sourceSpecificFilters: ReactNode = null;
  if (sourceType === "Work") {
    sourceSpecificFilters = (
      <div className="space-y-1">
        <Label htmlFor="collection-work-type">Work type</Label>
        <NativeSelect
          id="collection-work-type"
          onChange={(event) => {
            pendingKey.current = null;
            setWorkType(event.target.value);
          }}
          value={workType}
        >
          <NativeSelectOption value="">None</NativeSelectOption>
          {WORK_TYPE_OPTIONS.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {type}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  } else if (isDocumentSource) {
    sourceSpecificFilters = (
      <>
        <div className="space-y-1">
          <Label htmlFor="collection-document-type">Document type</Label>
          <NativeSelect
            id="collection-document-type"
            onChange={(event) => {
              pendingKey.current = null;
              setDocumentType(event.target.value);
            }}
            value={documentType}
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            {documentTypeSchema.options.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-tag">Tag</Label>
          <Input
            id="collection-tag"
            onChange={(event) => {
              pendingKey.current = null;
              setTag(event.target.value);
            }}
            value={tag}
          />
        </div>
      </>
    );
  }
  const scopeField =
    sourceType === "Wiki Document" ? (
      <p className="self-end text-muted-foreground text-sm">Workspace scope</p>
    ) : (
      <fieldset className="space-y-2 md:col-span-4">
        <legend className="font-medium text-sm">Scope</legend>
        {projectsQuery.isError ? (
          <p className="text-muted-foreground text-sm">
            Project scope is unavailable.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {projects.map((project) => {
              const checked = projectIds.includes(project.id);
              return (
                <Label
                  className="flex items-center gap-2 font-normal"
                  key={project.id}
                >
                  <input
                    checked={checked}
                    disabled={
                      project.id === projectId ||
                      (checked && projectIds.length === 1)
                    }
                    onChange={(event) => {
                      pendingKey.current = null;
                      const nextChecked = event.currentTarget.checked;
                      setProjectIds((current) =>
                        nextChecked
                          ? [...new Set([...current, project.id])]
                          : current.filter((id) => id !== project.id),
                      );
                    }}
                    type="checkbox"
                    value={project.id}
                  />
                  {project.name}
                </Label>
              );
            })}
          </div>
        )}
      </fieldset>
    );

  return (
    <section aria-label="Smart Collection" className="space-y-5">
      <h2 className="font-semibold text-2xl">Smart Collection</h2>
      <form
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            onChange={(event) => {
              pendingKey.current = null;
              setName(event.target.value);
            }}
            required
            value={name}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-view-name">Named view</Label>
          <Input
            id="collection-view-name"
            onChange={(event) => {
              pendingKey.current = null;
              setViewName(event.target.value);
            }}
            required
            value={viewName}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-source-type">Source type</Label>
          <NativeSelect
            id="collection-source-type"
            onChange={(event) => {
              pendingKey.current = null;
              setSourceType(event.target.value as SmartCollectionSourceType);
              setStatus("");
              setWorkType("");
              setDocumentType("");
              setTag("");
            }}
            value={sourceType}
          >
            {SMART_COLLECTION_SOURCE_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {statusOptions.length > 0 ? (
          <div className="space-y-1">
            <Label htmlFor="collection-status">Status</Label>
            <NativeSelect
              id="collection-status"
              onChange={(event) => {
                pendingKey.current = null;
                setStatus(event.target.value);
              }}
              value={status}
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {statusOptions.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        {sourceSpecificFilters}
        {scopeField}
        <Button className="self-end" disabled={create.isPending} type="submit">
          Save
        </Button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
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
