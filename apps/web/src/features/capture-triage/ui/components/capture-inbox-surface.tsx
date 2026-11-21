// biome-ignore-all lint/performance/noJsxPropsBind: Capture cards own handlers that close over their current layout and item state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  CaptureBulkSenseMaking,
  CaptureInboxGroup,
  CaptureInboxItem,
  CaptureInboxSnapshot,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useCallback, useState } from "react";

import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { useCaptureInboxUndo } from "@/features/capture-triage/hooks/use-capture-inbox";
import BulkSenseMakingView from "@/features/capture-triage/ui/components/bulk-sense-making";
import {
  CaptureInboxItemActions,
  CaptureSourceSummary,
  CaptureUndoPreviewPanel,
} from "@/features/capture-triage/ui/components/capture-inbox-item-actions";
import CaptureInboxForm from "@/features/capture-triage/ui/forms/capture-inbox-form";

import { captureCountLabel } from "../../lib/capture-inbox";

import {
  advanceSequentialTriageAfterExit,
  beginSequentialTriage,
  leaveSequentialTriage,
  moveToNextSequentialTriageItem,
  moveToPreviousSequentialTriageItem,
  restoreSequentialTriageItem,
  type SequentialTriageState,
} from "../../lib/sequential-triage";

function CaptureInboxItemDetails({
  formattingPreferences,
  includeContent = true,
  includeTimestamp = true,
  item,
}: {
  formattingPreferences: AccountPreferences;
  includeContent?: boolean;
  includeTimestamp?: boolean;
  item: CaptureInboxItem;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {item.template ? (
          <span className="font-medium">{item.template}</span>
        ) : null}
        {includeTimestamp ? (
          <time className="text-muted-foreground" dateTime={item.createdAt}>
            {formatAccountDateTime(item.createdAt, formattingPreferences)}
          </time>
        ) : null}
      </div>
      {includeContent && item.content ? (
        <p className="text-sm/6 whitespace-pre-wrap">{item.content}</p>
      ) : null}
      {Object.entries(item.fields).length > 0 ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {Object.entries(item.fields).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

function SequentialTriageView({
  accountId,
  currentIndex,
  formattingPreferences,
  hasNextItem,
  isResolved,
  item,
  onBackToList,
  onNext,
  onPrevious,
  onTriageExit,
  onUndoPreview,
  triageAvailable,
}: {
  accountId: string;
  currentIndex: number;
  formattingPreferences: AccountPreferences;
  hasNextItem: boolean;
  isResolved: boolean;
  item: CaptureInboxItem;
  onBackToList: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onTriageExit: () => void;
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
}) {
  return (
    <section aria-labelledby="sequential-triage-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground">Capture Inbox</p>
          <h2
            className="mt-1 text-xl font-semibold tracking-tight"
            id="sequential-triage-title"
          >
            Sequential triage
          </h2>
          <p className="mt-2 max-w-xl text-sm/6 text-muted-foreground">
            Focus on one capture. Convert, attach to existing, or delete to
            continue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={currentIndex <= 0}
            onClick={onPrevious}
            type="button"
            variant="outline"
          >
            Previous item
          </Button>
          {isResolved && hasNextItem ? (
            <Button onClick={onNext} type="button" variant="outline">
              Next item
            </Button>
          ) : null}
          <Button onClick={onBackToList} type="button" variant="ghost">
            Back to list
          </Button>
        </div>
      </header>
      <article
        aria-label="Sequential triage item"
        className="space-y-4 border-y border-border/70 py-5"
      >
        <CaptureSourceSummary
          formattingPreferences={formattingPreferences}
          item={item}
        />
        <CaptureInboxItemDetails
          formattingPreferences={formattingPreferences}
          includeContent={false}
          includeTimestamp={false}
          item={item}
        />
        {isResolved ? (
          <p
            className="border border-border/70 px-3 py-2 text-sm text-muted-foreground"
            role="status"
          >
            This capture was already handled in this session.
          </p>
        ) : (
          <CaptureInboxItemActions
            accountId={accountId}
            formattingPreferences={formattingPreferences}
            item={item}
            key={item.id}
            onTriageExit={onTriageExit}
            onUndoPreview={onUndoPreview}
            triageAvailable={triageAvailable}
          />
        )}
      </article>
    </section>
  );
}

function CaptureInboxGroupView({
  accountId,
  formattingPreferences,
  group,
  onUndoPreview,
  triageAvailable,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  group: CaptureInboxGroup;
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
}) {
  const headingId = `capture-group-${group.itemIds[0]}`;
  const inboxKind = group.projectId ? "Project inbox" : "Workspace inbox";
  const captureCount = group.items.length;

  return (
    <section
      aria-label={group.label}
      aria-labelledby={headingId}
      className="border-t border-border/70"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{inboxKind}</p>
          <h2
            className="mt-1 text-base font-semibold tracking-tight"
            id={headingId}
          >
            {group.label}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          {group.projectId ? (
            <p className="max-w-40 truncate text-sm" title={group.projectId}>
              {group.projectId}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {captureCountLabel(captureCount)}
          </p>
        </div>
      </div>
      <ul className="divide-y">
        {group.items.map((item) => (
          <li className="space-y-3 py-4" key={item.id}>
            <CaptureInboxItemDetails
              formattingPreferences={formattingPreferences}
              item={item}
            />
            <CaptureInboxItemActions
              accountId={accountId}
              formattingPreferences={formattingPreferences}
              item={item}
              onUndoPreview={onUndoPreview}
              triageAvailable={triageAvailable}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SequentialTriageSurface({
  accountId,
  currentIndex,
  formattingPreferences,
  hasNextItem,
  isResolved,
  item,
  onBackToList,
  onNext,
  onPrevious,
  onTriageExit,
  onUndoPreview,
  triageAvailable,
}: {
  accountId: string;
  currentIndex: number;
  formattingPreferences: AccountPreferences;
  hasNextItem: boolean;
  isResolved: boolean;
  item: CaptureInboxItem | null;
  onBackToList: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onTriageExit: () => void;
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
}) {
  if (item) {
    return (
      <SequentialTriageView
        accountId={accountId}
        currentIndex={currentIndex}
        formattingPreferences={formattingPreferences}
        hasNextItem={hasNextItem}
        isResolved={isResolved}
        item={item}
        onBackToList={onBackToList}
        onNext={onNext}
        onPrevious={onPrevious}
        onTriageExit={onTriageExit}
        onUndoPreview={onUndoPreview}
        triageAvailable={triageAvailable}
      />
    );
  }

  return (
    <section
      aria-labelledby="sequential-triage-complete-title"
      className="space-y-5"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground">Capture Inbox</p>
          <h2
            className="mt-1 text-xl font-semibold tracking-tight"
            id="sequential-triage-complete-title"
          >
            Sequential triage
          </h2>
        </div>
        <Button onClick={onBackToList} type="button" variant="ghost">
          Back to list
        </Button>
      </header>
      <p className="border border-border/70 px-4 py-6 text-sm text-muted-foreground">
        Sequential triage is complete. No captures are waiting in this session.
      </p>
    </section>
  );
}

function CaptureInboxListView({
  accountId,
  bulkSenseMaking,
  formattingPreferences,
  groups,
  items,
  onStartSequentialTriage,
  onToggleBulkView,
  onUndoPreview,
  triageAvailable,
  viewMode,
}: {
  accountId: string;
  bulkSenseMaking: CaptureBulkSenseMaking;
  formattingPreferences: AccountPreferences;
  groups: CaptureInboxGroup[];
  items: CaptureInboxItem[];
  onStartSequentialTriage: () => void;
  onToggleBulkView: () => void;
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
  viewMode: "inbox" | "bulk";
}) {
  function renderCaptureList() {
    if (groups.length === 0) {
      return (
        <section
          aria-labelledby="empty-workspace-inbox"
          className="border-y border-border/70"
        >
          <div className="border-b border-border/70 py-3">
            <p className="text-xs text-muted-foreground">Workspace inbox</p>
            <h3
              className="mt-1 text-base font-semibold tracking-tight"
              id="empty-workspace-inbox"
            >
              Workspace Capture Inbox
            </h3>
          </div>
          <p className="py-5 text-sm text-muted-foreground">
            No captures in this Inbox.
          </p>
        </section>
      );
    }

    if (viewMode === "bulk") {
      return (
        <BulkSenseMakingView
          accountId={accountId}
          formattingPreferences={formattingPreferences}
          items={items}
          onUndoPreview={onUndoPreview}
          triageAvailable={triageAvailable}
          view={bulkSenseMaking}
        />
      );
    }

    return groups.map((group) => (
      <CaptureInboxGroupView
        accountId={accountId}
        formattingPreferences={formattingPreferences}
        group={group}
        key={`${group.kind}-${group.projectId ?? "workspace"}`}
        onUndoPreview={onUndoPreview}
        triageAvailable={triageAvailable}
      />
    ));
  }

  return (
    <section aria-labelledby="capture-list-title" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <h2
            className="text-xl font-semibold tracking-tight"
            id="capture-list-title"
          >
            Saved captures
          </h2>
          <p className="mt-2 max-w-2xl text-sm/6 text-muted-foreground">
            Review temporary captures here. Open Capture Inbox when you are
            ready to save a new thought or choose its next destination.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {groups.length > 0 ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {captureCountLabel(
                groups.reduce((count, group) => count + group.items.length, 0),
              )}
            </span>
          ) : null}
          <DialogTrigger render={<Button className="min-h-11" />}>
            New capture
          </DialogTrigger>
          {groups.length > 0 && triageAvailable ? (
            <Button
              className="min-h-11"
              onClick={onStartSequentialTriage}
              type="button"
              variant="outline"
            >
              Sequential triage
            </Button>
          ) : null}
          {groups.length > 0 ? (
            <Button
              aria-pressed={viewMode === "bulk"}
              className="min-h-11"
              onClick={onToggleBulkView}
              type="button"
              variant={viewMode === "bulk" ? "default" : "outline"}
            >
              Bulk sense-making
            </Button>
          ) : null}
        </div>
      </div>

      {renderCaptureList()}
    </section>
  );
}

export default function CaptureInboxSurface({
  accountId,
  formattingPreferences,
  inbox,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  inbox: CaptureInboxSnapshot;
}) {
  const [composerHandle] = useState(createDialogHandle);
  const [viewMode, setViewMode] = useState<"inbox" | "bulk">("inbox");
  const [sequentialTriageState, setSequentialTriageState] =
    useState<SequentialTriageState>({ mode: "list" });
  const [sequentialItems, setSequentialItems] = useState<
    readonly CaptureInboxItem[]
  >([]);
  const restoreSequentialItem = useCallback((itemId: string) => {
    setSequentialTriageState((state) =>
      restoreSequentialTriageItem(state, itemId),
    );
  }, []);
  const {
    cancelUndo,
    confirmUndo,
    isPending: undoPending,
    showUndoPreview,
    undoPreview,
  } = useCaptureInboxUndo(accountId, restoreSequentialItem);

  const { bulkSenseMaking, groups, items, triageAvailable } = inbox;
  const orderedItems = items;
  const orderedItemIds = orderedItems.map((item) => item.id);
  const sequentialItem =
    sequentialTriageState.mode === "focused"
      ? sequentialItems[sequentialTriageState.itemIndex]
      : null;
  const sequentialItemIndex =
    sequentialTriageState.mode === "focused"
      ? sequentialTriageState.itemIndex
      : -1;
  const startSequentialTriage = () => {
    setSequentialItems(orderedItems);
    setSequentialTriageState(beginSequentialTriage(orderedItemIds));
  };
  const previousSequentialTriageItem = () => {
    setSequentialTriageState((state) =>
      moveToPreviousSequentialTriageItem(state),
    );
  };
  const nextSequentialTriageItem = () => {
    setSequentialTriageState((state) => moveToNextSequentialTriageItem(state));
  };
  const advanceSequentialTriage = () => {
    setSequentialTriageState((state) =>
      advanceSequentialTriageAfterExit(state),
    );
  };
  const backToCaptureInboxList = () => {
    setSequentialItems([]);
    setSequentialTriageState(leaveSequentialTriage());
  };
  const sequentialItemResolved =
    sequentialTriageState.mode === "focused" &&
    sequentialTriageState.resolvedItemIds.includes(
      sequentialTriageState.itemId,
    );
  const sequentialHasNextItem =
    sequentialTriageState.mode === "focused" &&
    sequentialTriageState.itemIndex < sequentialTriageState.itemIds.length - 1;
  const inSequentialTriage = sequentialTriageState.mode !== "list";

  return (
    <Dialog handle={composerHandle}>
      {undoPreview ? (
        <CaptureUndoPreviewPanel
          formattingPreferences={formattingPreferences}
          onCancel={cancelUndo}
          onConfirm={confirmUndo}
          pending={undoPending}
          preview={undoPreview}
        />
      ) : null}

      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">New capture</DialogTitle>
          <DialogDescription>
            Save keeps a Capture in the Inbox; Create Bug creates a Bug Work
            directly when a Project is set.
          </DialogDescription>
        </DialogHeader>
        <CaptureInboxForm
          accountId={accountId}
          onSaved={() => composerHandle.close()}
          showHeader={false}
        />
      </DialogContent>

      {inSequentialTriage ? (
        <SequentialTriageSurface
          accountId={accountId}
          currentIndex={sequentialItemIndex}
          formattingPreferences={formattingPreferences}
          hasNextItem={sequentialHasNextItem}
          isResolved={sequentialItemResolved}
          item={sequentialItem ?? null}
          onBackToList={backToCaptureInboxList}
          onNext={nextSequentialTriageItem}
          onPrevious={previousSequentialTriageItem}
          onTriageExit={advanceSequentialTriage}
          onUndoPreview={showUndoPreview}
          triageAvailable={triageAvailable}
        />
      ) : (
        <CaptureInboxListView
          accountId={accountId}
          bulkSenseMaking={bulkSenseMaking}
          formattingPreferences={formattingPreferences}
          groups={groups}
          items={items}
          onStartSequentialTriage={startSequentialTriage}
          onToggleBulkView={() =>
            setViewMode((current) => (current === "bulk" ? "inbox" : "bulk"))
          }
          onUndoPreview={showUndoPreview}
          triageAvailable={triageAvailable}
          viewMode={viewMode}
        />
      )}
    </Dialog>
  );
}
