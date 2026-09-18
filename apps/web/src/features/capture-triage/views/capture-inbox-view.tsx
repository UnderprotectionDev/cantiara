// biome-ignore-all lint/performance/noJsxPropsBind: Capture cards own handlers that close over their current layout and item state.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  CAPTURE_BIND_RELATIONS,
  CAPTURE_CONVERSION_TARGETS,
  type CaptureAttachPreview,
  type CaptureBindRelation,
  type CaptureBulkCluster,
  type CaptureBulkPlacement,
  type CaptureBulkSenseMaking,
  type CaptureConversionPreview,
  type CaptureConversionTarget,
  type CaptureInboxGroup,
  type CaptureInboxItem,
  type CaptureSuggestion,
  type CaptureSuggestions,
  type CaptureUndoMergePreview,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

import { formatAccountDateTime } from "@/features/account-preferences/forms/account-preferences-format";
import CaptureInboxForm from "@/features/capture-triage/forms/capture-inbox-form";
import {
  ClientShellStatus,
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import {
  accountPreferencesQueryOptions,
  captureInboxQueryOptions,
  client,
} from "@/utils/orpc";

function captureCountLabel(count: number) {
  return `${count} ${count === 1 ? "capture" : "captures"}`;
}

interface BulkSenseMakingColumn {
  clusterId: string | null;
  items: CaptureInboxItem[];
  label: string;
  position: number;
}

export function bulkSenseMakingColumns(
  items: readonly CaptureInboxItem[],
  layout: CaptureBulkSenseMaking,
): BulkSenseMakingColumn[] {
  const placements = new Map(
    layout.placements.map((placement) => [placement.itemId, placement]),
  );
  const sortedClusters = [...layout.clusters].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
  const columns = new Map<string | null, BulkSenseMakingColumn>();
  columns.set(null, {
    clusterId: null,
    items: [],
    label: "Ungrouped",
    position: -1,
  });
  for (const cluster of sortedClusters) {
    columns.set(cluster.id, {
      clusterId: cluster.id,
      items: [],
      label: cluster.name,
      position: cluster.position,
    });
  }

  for (const item of items) {
    const placement = placements.get(item.id);
    const column =
      columns.get(placement?.clusterId ?? null) ?? columns.get(null);
    column?.items.push(item);
  }

  for (const column of columns.values()) {
    column.items.sort((left, right) => {
      const leftPosition =
        placements.get(left.id)?.position ?? Number.MAX_SAFE_INTEGER;
      const rightPosition =
        placements.get(right.id)?.position ?? Number.MAX_SAFE_INTEGER;
      return (
        leftPosition - rightPosition ||
        left.createdAt.localeCompare(right.createdAt)
      );
    });
  }

  return [...columns.values()];
}

type Preview = CaptureAttachPreview | CaptureConversionPreview;
type ActionMode = "attach" | "convert" | "suggestions" | null;
interface UndoPreviewState {
  mergeId: string;
  preview: CaptureUndoMergePreview;
}

function triageErrorMessage() {
  return "This action could not be completed.";
}

function itemOriginLabel(item: CaptureInboxItem) {
  if (!item.origin) {
    return null;
  }
  return typeof item.origin === "string" ? item.origin : item.origin.kind;
}

function CaptureSourceSummary({
  formattingPreferences,
  item,
  heading = "Original capture",
}: {
  formattingPreferences: AccountPreferences;
  heading?: string;
  item: CaptureInboxItem;
}) {
  const origin = itemOriginLabel(item);
  return (
    <div className="space-y-2 border border-border/70 bg-muted/15 px-4 py-3">
      <h4 className="font-medium text-sm">{heading}</h4>
      {item.content ? (
        <p className="whitespace-pre-wrap text-sm/6">{item.content}</p>
      ) : null}
      {item.link ? (
        <p className="break-all text-sm">
          <span className="text-muted-foreground">Link: </span>
          <a
            className="underline underline-offset-2"
            href={item.link}
            rel="noreferrer"
            target="_blank"
          >
            {item.link}
          </a>
        </p>
      ) : null}
      {item.attachment ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Capture attachment: </span>
          {item.attachment.name ?? item.attachment.id}
        </p>
      ) : null}
      {origin ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Origin: </span>
          {origin}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Captured {formatAccountDateTime(item.createdAt, formattingPreferences)}
      </p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onUse,
}: {
  onUse?: (suggestion: CaptureSuggestion) => void;
  suggestion: CaptureSuggestion;
}) {
  const handleUse = useCallback(() => onUse?.(suggestion), [onUse, suggestion]);

  return (
    <li className="border border-border/70 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{suggestion.title}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {suggestion.recordType}
            {suggestion.projectName ? ` · ${suggestion.projectName}` : ""}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            Basis: {suggestion.basis.join(", ")}
          </p>
        </div>
        {onUse ? (
          <Button onClick={handleUse} type="button" variant="outline">
            Use target
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function SuggestionsPreview({
  suggestions,
  onUse,
}: {
  onUse: (suggestion: CaptureSuggestion) => void;
  suggestions: CaptureSuggestions;
}) {
  return (
    <section
      aria-label="Suggestions"
      className="space-y-4 border border-border/70 p-4"
    >
      <h3 className="font-semibold text-sm">Suggestions</h3>
      <div className="space-y-2">
        <h4 className="font-medium text-xs">{suggestions.sameProject.label}</h4>
        {suggestions.sameProject.items.length > 0 ? (
          <ul className="space-y-2">
            {suggestions.sameProject.items.map((suggestion) => (
              <SuggestionRow
                key={suggestion.id}
                onUse={onUse}
                suggestion={suggestion}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">No suggestions.</p>
        )}
      </div>
      {suggestions.otherProjects.map((group) => {
        const groupKey = group.items.map((item) => item.id).join("-");
        return (
          <div className="space-y-2" key={groupKey || group.label}>
            <h4 className="font-medium text-xs">{group.label}</h4>
            <ul className="space-y-2">
              {group.items.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.id}
                  onUse={onUse}
                  suggestion={suggestion}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function CaptureConversionPreviewPanel({
  formattingPreferences,
  preview,
  onCancel,
  onConfirm,
  pending,
}: {
  formattingPreferences: AccountPreferences;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: CaptureConversionPreview;
}) {
  return (
    <section
      aria-label="Conversion Preview"
      className="space-y-4 border border-primary/35 bg-primary/5 p-4"
      role="dialog"
    >
      <div>
        <h3 className="font-semibold text-sm">Conversion Preview</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          One new {preview.proposedRecord.recordType} will be created in the
          selected scope.
        </p>
      </div>
      <CaptureSourceSummary
        formattingPreferences={formattingPreferences}
        item={preview.source}
      />
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h4 className="font-medium text-sm">Proposed record</h4>
        <p className="text-sm">
          {preview.proposedRecord.recordType}: {preview.proposedRecord.title}
        </p>
        <p className="text-muted-foreground text-xs">
          Target scope: {preview.targetScope.label}
          {preview.targetScope.projectId
            ? ` · ${preview.targetScope.projectId}`
            : ""}
        </p>
      </div>
      {preview.fieldMappings.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Field mappings</h4>
          <dl className="space-y-2 text-xs">
            {preview.fieldMappings.map((mapping) => (
              <div
                className="grid gap-1 border border-border/70 px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                key={`${mapping.sourceField}-${mapping.targetField}`}
              >
                <dt>{mapping.sourceField}</dt>
                <span className="text-muted-foreground">→</span>
                <dd>
                  {mapping.targetField}: {mapping.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h4 className="font-medium text-sm">Relation preview</h4>
        <ul className="space-y-1 text-sm">
          {preview.proposedRelations.map((relation) => (
            <li key={`${relation.relation}-${relation.target}`}>
              {relation.relation} → {relation.target}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Converting…" : "Confirm"}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function CaptureAttachPreviewPanel({
  formattingPreferences,
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  formattingPreferences: AccountPreferences;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: CaptureAttachPreview;
}) {
  return (
    <section
      aria-label="Attach Preview"
      className="space-y-4 border border-primary/35 bg-primary/5 p-4"
      role="dialog"
    >
      <div>
        <h3 className="font-semibold text-sm">Attach Preview</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Review the relation and target before this Capture Inbox item is
          consumed.
        </p>
      </div>
      <CaptureSourceSummary
        formattingPreferences={formattingPreferences}
        item={preview.source}
      />
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h4 className="font-medium text-sm">Relation preview</h4>
        <p className="text-sm">
          {preview.relationPreview.relation} → {preview.target.title}
        </p>
        <p className="text-muted-foreground text-xs">
          {preview.target.recordType} · {preview.target.id}
        </p>
        {preview.crossProject ? (
          <p className="border border-amber-500/35 bg-amber-500/5 px-3 py-2 text-xs">
            Cross-Project bind: {preview.targetProject?.name ?? "Other Project"}
            .
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Attaching…" : "Confirm"}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function CaptureUndoPreviewPanel({
  formattingPreferences,
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  formattingPreferences: AccountPreferences;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: CaptureUndoMergePreview;
}) {
  return (
    <section
      aria-label="Undo Preview"
      className="space-y-4 border border-primary/35 bg-primary/5 p-4"
      role="dialog"
    >
      <div>
        <h2 className="font-semibold text-base">Undo Preview</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          Review what returns to the Capture Inbox and what this merge alone
          will remove from the target.
        </p>
      </div>
      <CaptureSourceSummary
        formattingPreferences={formattingPreferences}
        heading="Original capture"
        item={preview.restore}
      />
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h3 className="font-medium text-sm">Only this merge</h3>
        <p className="text-muted-foreground text-xs">
          Relations:{" "}
          {preview.removeFromTarget.attributedRelationIds.join(", ") || "None"}
        </p>
        <p className="text-muted-foreground text-xs">
          Fields:{" "}
          {preview.removeFromTarget.attributedValueKeys.join(", ") || "None"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Restoring…" : "Confirm"}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

interface CaptureConversionSetupProps {
  isOnline: boolean;
  onCancel: () => void;
  onPreview: () => void;
  onRecordTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  previewPending: boolean;
  recordType: CaptureConversionTarget | "";
}

function CaptureConversionSetup({
  isOnline,
  onCancel,
  onPreview,
  onRecordTypeChange,
  previewPending,
  recordType,
}: CaptureConversionSetupProps) {
  return (
    <section className="space-y-3 border border-border/70 bg-muted/15 p-4">
      <h3 className="font-semibold text-sm">Choose conversion target</h3>
      <NativeSelect
        aria-label="Conversion target"
        onChange={onRecordTypeChange}
        value={recordType}
      >
        <NativeSelectOption value="">Choose a target</NativeSelectOption>
        {CAPTURE_CONVERSION_TARGETS.map((target) => (
          <NativeSelectOption key={target} value={target}>
            {target}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!(isOnline && recordType) || previewPending}
          onClick={onPreview}
          type="button"
        >
          Preview
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

interface CaptureAttachmentSetupProps {
  isOnline: boolean;
  onCancel: () => void;
  onPreview: () => void;
  onRelationChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onTargetIdChange: (event: ChangeEvent<HTMLInputElement>) => void;
  previewPending: boolean;
  relation: CaptureBindRelation;
  targetId: string;
}

function CaptureAttachmentSetup({
  isOnline,
  onCancel,
  onPreview,
  onRelationChange,
  onTargetIdChange,
  previewPending,
  relation,
  targetId,
}: CaptureAttachmentSetupProps) {
  return (
    <section className="space-y-3 border border-border/70 bg-muted/15 p-4">
      <h3 className="font-semibold text-sm">Choose existing record</h3>
      <Input
        aria-label="Target record ID"
        onChange={onTargetIdChange}
        placeholder="Target record ID"
        value={targetId}
      />
      <NativeSelect
        aria-label="Relation"
        onChange={onRelationChange}
        value={relation}
      >
        {CAPTURE_BIND_RELATIONS.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!(isOnline && targetId.trim()) || previewPending}
          onClick={onPreview}
          type="button"
        >
          Preview
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function CaptureInboxItemActions({
  accountId,
  formattingPreferences,
  item,
  onUndoPreview,
  triageAvailable,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  item: CaptureInboxItem;
  onUndoPreview: (state: UndoPreviewState) => void;
  triageAvailable: boolean;
}) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const [mode, setMode] = useState<ActionMode>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [suggestionData, setSuggestionData] =
    useState<CaptureSuggestions | null>(null);
  const [recordType, setRecordType] = useState<CaptureConversionTarget | "">(
    "",
  );
  const [relation, setRelation] = useState<CaptureBindRelation>("Origin");
  const [targetId, setTargetId] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshInbox = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: captureInboxQueryOptions(accountId).queryKey,
    });
    setMode(null);
    setPreview(null);
    setSuggestionData(null);
  }, [accountId, queryClient]);

  const previewConversion = useMutation({
    mutationFn: () => {
      if (!recordType) {
        throw new Error("Choose a conversion target.");
      }
      return shell.runOnlineOnly(() =>
        client.previewCaptureConversion({
          itemId: item.id,
          recordType,
        }),
      );
    },
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: (nextPreview) => {
      setActionMessage(null);
      setPreview(nextPreview);
    },
  });
  const convert = useMutation({
    mutationFn: (previewId: string) =>
      shell.runWrite(() =>
        client.convertCapture({
          clientIdempotencyKey: crypto.randomUUID(),
          itemId: item.id,
          previewId,
        }),
      ),
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: refreshInbox,
  });
  const previewAttachment = useMutation({
    mutationFn: () =>
      shell.runOnlineOnly(() =>
        client.previewCaptureAttachment({
          itemId: item.id,
          relation,
          targetId: targetId.trim(),
        }),
      ),
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: (nextPreview) => {
      setActionMessage(null);
      setPreview(nextPreview);
    },
  });
  const attach = useMutation({
    mutationFn: (previewId: string) =>
      shell.runWrite(() =>
        client.attachCapture({
          clientIdempotencyKey: crypto.randomUUID(),
          itemId: item.id,
          previewId,
          relation,
          targetId: targetId.trim(),
        }),
      ),
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: async (receipt) => {
      try {
        const undoPreview = await shell.runOnlineOnly(() =>
          client.previewCaptureMergeUndo({ mergeId: receipt.mergeId }),
        );
        onUndoPreview({ mergeId: receipt.mergeId, preview: undoPreview });
        toast.success("Capture attached.");
      } catch {
        toast.error(triageErrorMessage());
      }
      await refreshInbox();
    },
  });
  const deleteCapture = useMutation({
    mutationFn: () =>
      shell.runWrite(() =>
        client.deleteCapture({
          clientIdempotencyKey: crypto.randomUUID(),
          itemId: item.id,
        }),
      ),
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: refreshInbox,
  });
  const suggestions = useMutation({
    mutationFn: () =>
      shell.runOnlineOnly(() => client.captureSuggestions({ itemId: item.id })),
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: (nextSuggestions) => {
      setActionMessage(null);
      setMode("suggestions");
      setSuggestionData(nextSuggestions);
    },
  });

  const isPending =
    previewConversion.isPending ||
    convert.isPending ||
    previewAttachment.isPending ||
    attach.isPending ||
    deleteCapture.isPending ||
    suggestions.isPending;
  const isOnline = connection !== "offline";
  const suggestionPreview = mode === "suggestions" ? suggestionData : null;
  const conversionPreview =
    mode === "convert" && preview && "proposedRecord" in preview
      ? preview
      : null;
  const attachPreview =
    mode === "attach" && preview && "relationPreview" in preview
      ? preview
      : null;

  const startMode = useCallback((nextMode: Exclude<ActionMode, null>) => {
    setMode(nextMode);
    setPreview(null);
    setSuggestionData(null);
    setActionMessage(null);
  }, []);

  const closeMode = useCallback(() => {
    setMode(null);
    setPreview(null);
    setSuggestionData(null);
    setActionMessage(null);
  }, []);

  const useSuggestion = useCallback((suggestion: CaptureSuggestion) => {
    setTargetId(suggestion.id);
    setMode("attach");
    setPreview(null);
  }, []);

  const openConvert = useCallback(() => startMode("convert"), [startMode]);
  const openAttach = useCallback(() => startMode("attach"), [startMode]);
  const handleDelete = useCallback(
    () => deleteCapture.mutate(),
    [deleteCapture],
  );
  const showSuggestions = useCallback(
    () => suggestions.mutate(),
    [suggestions],
  );
  const handleRecordTypeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setRecordType(event.target.value as CaptureConversionTarget),
    [],
  );
  const handlePreviewConversion = useCallback(
    () => previewConversion.mutate(),
    [previewConversion],
  );
  const handleTargetIdChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTargetId(event.target.value),
    [],
  );
  const handleRelationChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setRelation(event.target.value as CaptureBindRelation),
    [],
  );
  const handlePreviewAttachment = useCallback(
    () => previewAttachment.mutate(),
    [previewAttachment],
  );
  const confirmConversion = useCallback(() => {
    if (conversionPreview) {
      convert.mutate(conversionPreview.previewId);
    }
  }, [conversionPreview, convert]);
  const confirmAttachment = useCallback(() => {
    if (attachPreview) {
      attach.mutate(attachPreview.previewId);
    }
  }, [attach, attachPreview]);

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        {triageAvailable ? (
          <>
            <Button
              disabled={!isOnline || isPending}
              onClick={openConvert}
              type="button"
              variant="outline"
            >
              Convert
            </Button>
            <Button
              disabled={!isOnline || isPending}
              onClick={openAttach}
              type="button"
              variant="outline"
            >
              Attach to existing
            </Button>
          </>
        ) : null}
        <Button
          disabled={!isOnline || isPending}
          onClick={handleDelete}
          type="button"
          variant="destructive"
        >
          Delete
        </Button>
        {triageAvailable ? (
          <Button
            disabled={!isOnline || isPending}
            onClick={showSuggestions}
            type="button"
            variant="ghost"
          >
            Show suggestions
          </Button>
        ) : null}
      </div>
      {actionMessage ? (
        <p
          className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-xs"
          role="alert"
        >
          {actionMessage}
        </p>
      ) : null}
      {mode === "convert" && !conversionPreview ? (
        <CaptureConversionSetup
          isOnline={isOnline}
          onCancel={closeMode}
          onPreview={handlePreviewConversion}
          onRecordTypeChange={handleRecordTypeChange}
          previewPending={previewConversion.isPending}
          recordType={recordType}
        />
      ) : null}
      {mode === "attach" && !attachPreview ? (
        <CaptureAttachmentSetup
          isOnline={isOnline}
          onCancel={closeMode}
          onPreview={handlePreviewAttachment}
          onRelationChange={handleRelationChange}
          onTargetIdChange={handleTargetIdChange}
          previewPending={previewAttachment.isPending}
          relation={relation}
          targetId={targetId}
        />
      ) : null}
      {conversionPreview ? (
        <CaptureConversionPreviewPanel
          formattingPreferences={formattingPreferences}
          onCancel={closeMode}
          onConfirm={confirmConversion}
          pending={convert.isPending}
          preview={conversionPreview}
        />
      ) : null}
      {attachPreview ? (
        <CaptureAttachPreviewPanel
          formattingPreferences={formattingPreferences}
          onCancel={closeMode}
          onConfirm={confirmAttachment}
          pending={attach.isPending}
          preview={attachPreview}
        />
      ) : null}
      {suggestionPreview ? (
        <SuggestionsPreview
          onUse={useSuggestion}
          suggestions={suggestionPreview}
        />
      ) : null}
    </div>
  );
}

function BulkSenseMakingView({
  accountId,
  formattingPreferences,
  items,
  onUndoPreview,
  triageAvailable,
  view,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  items: CaptureInboxItem[];
  onUndoPreview: (state: UndoPreviewState) => void;
  triageAvailable: boolean;
  view: CaptureBulkSenseMaking;
}) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const [layout, setLayout] = useState(view);
  const [newClusterName, setNewClusterName] = useState("");

  useEffect(() => setLayout(view), [view]);

  const saveLayout = useMutation({
    mutationFn: (next: {
      clusters: CaptureBulkCluster[];
      placements: CaptureBulkPlacement[];
    }) =>
      shell.runWrite(() =>
        client.updateCaptureBulkSenseMaking({
          baseRevision: layout.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          clusters: next.clusters,
          placements: next.placements,
        }),
      ),
    onError: () => toast.error("Bulk sense-making could not be saved."),
    onSuccess: async (next) => {
      setLayout(next);
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const isOnline = connection !== "offline";
  const columns = bulkSenseMakingColumns(items, layout);

  function persist(next: {
    clusters: CaptureBulkCluster[];
    placements: CaptureBulkPlacement[];
  }) {
    if (!isOnline || saveLayout.isPending) {
      return;
    }
    setLayout((current) => ({ ...next, revision: current.revision }));
    saveLayout.mutate(next);
  }

  function addCluster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newClusterName.trim();
    if (!name) {
      return;
    }
    const position =
      Math.max(-1, ...layout.clusters.map((cluster) => cluster.position)) + 1;
    persist({
      clusters: [
        ...layout.clusters,
        { id: crypto.randomUUID(), name, position },
      ],
      placements: layout.placements,
    });
    setNewClusterName("");
  }

  function placeItem(itemId: string, clusterId: string | null) {
    const placements = layout.placements.filter(
      (placement) => placement.itemId !== itemId,
    );
    const nextPosition =
      Math.max(
        -1,
        ...placements
          .filter((placement) => placement.clusterId === clusterId)
          .map((placement) => placement.position),
      ) + 1;
    persist({
      clusters: layout.clusters,
      placements: [
        ...placements,
        { clusterId, itemId, position: nextPosition },
      ],
    });
  }

  function moveCluster(clusterId: string, direction: -1 | 1) {
    const clusters = [...layout.clusters].sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id),
    );
    const index = clusters.findIndex((cluster) => cluster.id === clusterId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= clusters.length) {
      return;
    }
    [clusters[index], clusters[nextIndex]] = [
      clusters[nextIndex] as CaptureBulkCluster,
      clusters[index] as CaptureBulkCluster,
    ];
    persist({
      clusters: clusters.map((cluster, position) => ({ ...cluster, position })),
      placements: layout.placements,
    });
  }

  return (
    <section
      aria-label="Bulk sense-making"
      className="space-y-5 border border-primary/35 bg-primary/5 p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            Bulk sense-making
          </h2>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm/6">
            Arrange captures side by side before you choose one of the three
            exits. These names and positions are view metadata only.
          </p>
        </div>
        {saveLayout.isPending ? (
          <span className="text-muted-foreground text-xs">Saving layout…</span>
        ) : null}
      </header>

      <form className="flex flex-wrap items-end gap-2" onSubmit={addCluster}>
        <label className="grid gap-1 text-sm" htmlFor="bulk-cluster-name">
          New cluster name
          <Input
            id="bulk-cluster-name"
            onChange={(event) => setNewClusterName(event.target.value)}
            placeholder="Name a cluster"
            value={newClusterName}
          />
        </label>
        <Button
          disabled={!isOnline || saveLayout.isPending || !newClusterName.trim()}
          type="submit"
          variant="outline"
        >
          Add cluster
        </Button>
      </form>

      <div className="grid items-start gap-4 overflow-x-auto pb-2 md:auto-cols-[minmax(18rem,1fr)] md:grid-flow-col">
        {columns.map((column) => (
          <section
            aria-label={column.label}
            className="min-w-72 border border-border/70 bg-background"
            key={column.clusterId ?? "ungrouped"}
          >
            <header className="flex items-start justify-between gap-3 border-b bg-muted/25 px-3 py-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-sm">
                  {column.label}
                </h3>
                <p className="mt-1 text-muted-foreground text-xs">
                  {captureCountLabel(column.items.length)}
                </p>
              </div>
              {column.clusterId ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    aria-label={`Move ${column.label} left`}
                    disabled={!isOnline || saveLayout.isPending}
                    onClick={() => moveCluster(column.clusterId as string, -1)}
                    type="button"
                    variant="ghost"
                  >
                    Move left
                  </Button>
                  <Button
                    aria-label={`Move ${column.label} right`}
                    disabled={!isOnline || saveLayout.isPending}
                    onClick={() => moveCluster(column.clusterId as string, 1)}
                    type="button"
                    variant="ghost"
                  >
                    Move right
                  </Button>
                </div>
              ) : null}
            </header>
            <ul className="divide-y">
              {column.items.map((item) => {
                const itemPlacement = layout.placements.find(
                  (placement) => placement.itemId === item.id,
                );
                return (
                  <li className="space-y-3 p-3" key={item.id}>
                    <div className="flex items-center justify-between gap-2">
                      {item.template ? (
                        <span className="font-medium text-xs">
                          {item.template}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Capture
                        </span>
                      )}
                      <NativeSelect
                        aria-label={`Place ${item.id}`}
                        disabled={!isOnline || saveLayout.isPending}
                        onChange={(event) =>
                          placeItem(item.id, event.target.value || null)
                        }
                        value={itemPlacement?.clusterId ?? ""}
                      >
                        <NativeSelectOption value="">
                          Ungrouped
                        </NativeSelectOption>
                        {layout.clusters
                          .slice()
                          .sort(
                            (left, right) =>
                              left.position - right.position ||
                              left.id.localeCompare(right.id),
                          )
                          .map((cluster) => (
                            <NativeSelectOption
                              key={cluster.id}
                              value={cluster.id}
                            >
                              {cluster.name}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </div>
                    {item.content ? (
                      <p className="whitespace-pre-wrap text-sm/6">
                        {item.content}
                      </p>
                    ) : null}
                    {Object.entries(item.fields).length > 0 ? (
                      <dl className="space-y-2 text-xs">
                        {Object.entries(item.fields).map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="whitespace-pre-wrap">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <CaptureInboxItemActions
                      accountId={accountId}
                      formattingPreferences={formattingPreferences}
                      item={item}
                      onUndoPreview={onUndoPreview}
                      triageAvailable={triageAvailable}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
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
  onUndoPreview: (state: UndoPreviewState) => void;
  triageAvailable: boolean;
}) {
  const headingId = `capture-group-${group.itemIds[0]}`;
  const inboxKind = group.projectId ? "Project inbox" : "Workspace inbox";
  const surfaceClass = group.projectId
    ? "border-primary/30"
    : "border-border/70";
  const headerClass = group.projectId ? "bg-primary/5" : "bg-muted/25";
  const captureCount = group.items.length;

  return (
    <section
      aria-label={group.label}
      aria-labelledby={headingId}
      className={`overflow-hidden border ${surfaceClass}`}
    >
      <div
        className={`flex items-start justify-between gap-4 border-b px-4 py-4 ${headerClass}`}
      >
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{inboxKind}</p>
          <h2
            className="mt-1 font-semibold text-base tracking-tight"
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
          <p className="mt-1 text-muted-foreground text-xs">
            {captureCountLabel(captureCount)}
          </p>
        </div>
      </div>
      <ul className="divide-y">
        {group.items.map((item) => (
          <li className="space-y-3 px-4 py-4 sm:px-5" key={item.id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {item.template ? (
                <span className="font-medium">{item.template}</span>
              ) : null}
              <time className="text-muted-foreground" dateTime={item.createdAt}>
                {formatAccountDateTime(item.createdAt, formattingPreferences)}
              </time>
            </div>
            {item.content ? (
              <p className="whitespace-pre-wrap text-sm/6">{item.content}</p>
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

export default function CaptureInboxView({ accountId }: { accountId: string }) {
  const inbox = useQuery(captureInboxQueryOptions(accountId));
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const [undoPreview, setUndoPreview] = useState<UndoPreviewState | null>(null);
  const [viewMode, setViewMode] = useState<"inbox" | "bulk">("inbox");
  const undoMerge = useMutation({
    mutationFn: (input: { mergeId: string; previewId: string }) =>
      shell.runWrite(() =>
        client.undoCaptureMerge({
          clientIdempotencyKey: crypto.randomUUID(),
          mergeId: input.mergeId,
          previewId: input.previewId,
        }),
      ),
    onError: () => toast.error(triageErrorMessage()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
      setUndoPreview(null);
      toast.success("Capture restored.");
    },
  });
  const cancelUndo = useCallback(() => setUndoPreview(null), []);
  const confirmUndo = useCallback(() => {
    if (undoPreview) {
      undoMerge.mutate({
        mergeId: undoPreview.mergeId,
        previewId: undoPreview.preview.previewId,
      });
    }
  }, [undoMerge, undoPreview]);
  const formattingPreferences =
    accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES;
  const clientShellStatus = (
    <ClientShellStatus accountFormattingPreferences={formattingPreferences} />
  );
  if (inbox.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {clientShellStatus}
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm">Loading captures…</p>
      </main>
    );
  }

  if (inbox.isError || !inbox.data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {clientShellStatus}
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p
          className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm"
          role="alert"
        >
          Capture Inbox is unavailable. Try loading this page again.
        </p>
      </main>
    );
  }

  const { bulkSenseMaking, groups, items, triageAvailable } = inbox.data;
  let captureListContent: ReactNode;
  if (viewMode === "bulk" && groups.length > 0) {
    captureListContent = (
      <BulkSenseMakingView
        accountId={accountId}
        formattingPreferences={formattingPreferences}
        items={items}
        onUndoPreview={setUndoPreview}
        triageAvailable={triageAvailable}
        view={bulkSenseMaking}
      />
    );
  } else if (groups.length === 0) {
    captureListContent = (
      <section
        aria-labelledby="empty-workspace-inbox"
        className="overflow-hidden border border-border/70"
      >
        <div className="bg-muted/25 px-4 py-4">
          <p className="text-muted-foreground text-xs">Workspace inbox</p>
          <h3
            className="mt-1 font-semibold text-base tracking-tight"
            id="empty-workspace-inbox"
          >
            Workspace Capture Inbox
          </h3>
        </div>
        <p className="px-4 py-6 text-muted-foreground text-sm">
          No captures in this Inbox.
        </p>
      </section>
    );
  } else {
    captureListContent = groups.map((group) => (
      <CaptureInboxGroupView
        accountId={accountId}
        formattingPreferences={formattingPreferences}
        group={group}
        key={`${group.kind}-${group.projectId ?? "workspace"}`}
        onUndoPreview={setUndoPreview}
        triageAvailable={triageAvailable}
      />
    ));
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-14">
      {clientShellStatus}
      <header className="max-w-3xl border-b pb-8">
        <h1 className="font-semibold text-3xl tracking-tight">Capture Inbox</h1>
        <p className="mt-3 text-muted-foreground text-sm/6">
          Save a thought before you know which permanent record it belongs to.
          Captures stay temporary until you choose what happens next.
        </p>
      </header>

      {undoPreview ? (
        <CaptureUndoPreviewPanel
          formattingPreferences={formattingPreferences}
          onCancel={cancelUndo}
          onConfirm={confirmUndo}
          pending={undoMerge.isPending}
          preview={undoPreview.preview}
        />
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <CaptureInboxForm accountId={accountId} />
        </div>

        <section
          aria-labelledby="capture-list-title"
          className="min-w-0 space-y-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <h2
                className="font-semibold text-xl tracking-tight"
                id="capture-list-title"
              >
                Saved captures
              </h2>
              <p className="mt-2 max-w-md text-muted-foreground text-sm/6">
                Capture Inbox groups are shown here after you save.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {groups.length > 0 ? (
                <span className="shrink-0 text-muted-foreground text-xs">
                  {captureCountLabel(
                    groups.reduce(
                      (count, group) => count + group.items.length,
                      0,
                    ),
                  )}
                </span>
              ) : null}
              {groups.length > 0 ? (
                <Button
                  aria-pressed={viewMode === "bulk"}
                  onClick={() =>
                    setViewMode((current) =>
                      current === "bulk" ? "inbox" : "bulk",
                    )
                  }
                  type="button"
                  variant={viewMode === "bulk" ? "default" : "outline"}
                >
                  Bulk sense-making
                </Button>
              ) : null}
            </div>
          </div>

          {captureListContent}
        </section>
      </div>
    </main>
  );
}
