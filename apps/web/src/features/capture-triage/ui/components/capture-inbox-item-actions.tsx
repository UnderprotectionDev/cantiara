// biome-ignore-all lint/performance/noJsxPropsBind: Capture cards own handlers that close over their current layout and item state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  CAPTURE_BIND_RELATIONS,
  CAPTURE_CONVERSION_TARGETS,
  type CaptureAttachPreview,
  type CaptureBindRelation,
  type CaptureConversionPreview,
  type CaptureConversionTarget,
  type CaptureInboxItem,
  type CaptureSuggestion,
  type CaptureSuggestions,
  type CaptureUndoMergePreview,
} from "@cantiara/api/capture-triage";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import {
  captureInboxQueryOptions,
  client,
  projectsQueryOptions,
} from "@/utils/orpc";

import {
  itemOriginLabel,
  triageErrorMessage,
  type UndoPreviewState,
} from "../../lib/capture-inbox";

type Preview = CaptureAttachPreview | CaptureConversionPreview;
type ActionMode = "attach" | "convert" | "suggestions" | null;

export function CaptureSourceSummary({
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
  onClose,
  suggestions,
  onUse,
}: {
  onClose: () => void;
  onUse: (suggestion: CaptureSuggestion) => void;
  suggestions: CaptureSuggestions;
}) {
  return (
    <section
      aria-label="Suggestions"
      className="space-y-4 border border-border/70 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-sm">Suggestions</h3>
        <Button onClick={onClose} type="button" variant="ghost">
          Close suggestions
        </Button>
      </div>
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
      className="space-y-4 rounded-lg border border-primary/35 bg-primary/5 p-4 shadow-sm"
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
      className="space-y-4 rounded-lg border border-primary/35 bg-primary/5 p-4 shadow-sm"
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

export function CaptureUndoPreviewPanel({
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
      className="space-y-4 rounded-lg border border-primary/35 bg-primary/5 p-4 shadow-sm"
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
  onProjectChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onRecordTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  previewPending: boolean;
  projectId: string;
  projects:
    | readonly Pick<ProjectProfile, "id" | "name" | "shortCode">[]
    | undefined;
  recordType: CaptureConversionTarget | "";
  sourceProjectId: string | null;
}

function captureConversionProjectId(projectId: string | null) {
  return projectId ?? "";
}

function optionalProjectId(projectId: string) {
  return projectId.trim() || undefined;
}

function captureConversionClientIdempotencyKey(current: string | null) {
  return current ?? crypto.randomUUID();
}

function CaptureConversionSetup({
  isOnline,
  onCancel,
  onPreview,
  onProjectChange,
  onRecordTypeChange,
  projectId,
  projects,
  previewPending,
  recordType,
  sourceProjectId,
}: CaptureConversionSetupProps) {
  const availableProjects = projects ?? [];
  const requiresProject =
    recordType === "Work" && !sourceProjectId && !projectId.trim();

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
      {sourceProjectId ? null : (
        <NativeSelect
          aria-label="Project"
          disabled={availableProjects.length === 0}
          onChange={onProjectChange}
          value={projectId}
        >
          <NativeSelectOption value="">
            Workspace Capture Inbox
          </NativeSelectOption>
          {availableProjects.map((project) => (
            <NativeSelectOption key={project.id} value={project.id}>
              {project.name} ({project.shortCode})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      {requiresProject ? (
        <p className="text-destructive text-xs">
          Work conversion requires a Project.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !(isOnline && recordType) || requiresProject || previewPending
          }
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

export function CaptureInboxItemActions({
  accountId,
  formattingPreferences,
  item,
  onUndoPreview,
  onTriageExit,
  triageAvailable,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  item: CaptureInboxItem;
  onTriageExit?: () => void;
  onUndoPreview: (state: UndoPreviewState) => void;
  triageAvailable: boolean;
}) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const projects = useQuery(projectsQueryOptions());
  const [mode, setMode] = useState<ActionMode>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [suggestionData, setSuggestionData] =
    useState<CaptureSuggestions | null>(null);
  const [recordType, setRecordType] = useState<CaptureConversionTarget | "">(
    "",
  );
  const [relation, setRelation] = useState<CaptureBindRelation>("Origin");
  const [targetId, setTargetId] = useState("");
  const [conversionProjectId, setConversionProjectId] = useState(
    captureConversionProjectId(item.projectId),
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const conversionClientIdempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    setConversionProjectId(captureConversionProjectId(item.projectId));
    conversionClientIdempotencyKey.current = null;
  }, [item]);

  const refreshInbox = useCallback(
    async (advanceAfterExit = false) => {
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
      setMode(null);
      setPreview(null);
      setSuggestionData(null);
      conversionClientIdempotencyKey.current = null;
      if (advanceAfterExit) {
        onTriageExit?.();
      }
    },
    [accountId, onTriageExit, queryClient],
  );

  const previewConversion = useMutation({
    mutationFn: () => {
      if (!recordType) {
        throw new Error("Choose a conversion target.");
      }
      return shell.runOnlineOnly(() =>
        client.previewCaptureConversion({
          itemId: item.id,
          projectId: optionalProjectId(conversionProjectId),
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
    mutationFn: (previewId: string) => {
      const clientIdempotencyKey = captureConversionClientIdempotencyKey(
        conversionClientIdempotencyKey.current,
      );
      conversionClientIdempotencyKey.current = clientIdempotencyKey;
      return shell.runWrite(() =>
        client.convertCapture({
          clientIdempotencyKey,
          itemId: item.id,
          previewId,
        }),
      );
    },
    onError: () => setActionMessage(triageErrorMessage()),
    onSuccess: () => {
      conversionClientIdempotencyKey.current = null;
      return refreshInbox(true);
    },
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
      await refreshInbox(true);
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
    onSuccess: () => refreshInbox(true),
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
    conversionClientIdempotencyKey.current = null;
  }, []);

  const useSuggestion = useCallback((suggestion: CaptureSuggestion) => {
    conversionClientIdempotencyKey.current = null;
    setTargetId(suggestion.id);
    setMode("attach");
    setPreview(null);
  }, []);

  const openConvert = useCallback(() => {
    conversionClientIdempotencyKey.current = null;
    setConversionProjectId(captureConversionProjectId(item.projectId));
    startMode("convert");
  }, [item.projectId, startMode]);
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
    (event: ChangeEvent<HTMLSelectElement>) => {
      conversionClientIdempotencyKey.current = null;
      setRecordType(event.target.value as CaptureConversionTarget);
    },
    [],
  );
  const handleProjectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      conversionClientIdempotencyKey.current = null;
      setConversionProjectId(event.target.value);
    },
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
          onProjectChange={handleProjectChange}
          onRecordTypeChange={handleRecordTypeChange}
          previewPending={previewConversion.isPending}
          projectId={conversionProjectId}
          projects={projects.data}
          recordType={recordType}
          sourceProjectId={item.projectId}
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
          onClose={closeMode}
          onUse={useSuggestion}
          suggestions={suggestionPreview}
        />
      ) : null}
    </div>
  );
}
