// biome-ignore-all lint/performance/noJsxPropsBind: Capture cards own handlers that close over their current layout and item state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  CaptureAttachPreview,
  CaptureAttachPreviewInput,
  CaptureConversionPreview,
  CaptureConvertInput,
  CaptureConvertPreviewInput,
  CaptureInboxItem,
  CaptureSuggestion,
  CaptureSuggestions,
  CaptureUndoMergePreview,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import {
  captureInboxQueryOptions,
  client,
  invalidateSmartCollectionMembership,
  orpc,
  projectsQueryOptions,
} from "@/utils/orpc";
import { itemOriginLabel, triageErrorMessage } from "../../lib/capture-inbox";
import {
  CaptureAttachmentSetupForm,
  type CaptureAttachmentSetupValues,
} from "../forms/capture-attachment-setup-form";
import {
  CaptureConversionSetupForm,
  type CaptureConversionSetupValues,
} from "../forms/capture-conversion-setup-form";

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
      <h4 className="text-sm font-medium">{heading}</h4>
      {item.content ? (
        <p className="text-sm/6 whitespace-pre-wrap">{item.content}</p>
      ) : null}
      {item.link ? (
        <p className="text-sm break-all">
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
      <p className="text-xs text-muted-foreground">
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
          <p className="text-sm font-medium">{suggestion.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {suggestion.recordType}
            {suggestion.projectName ? ` · ${suggestion.projectName}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
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
        <h3 className="text-sm font-semibold">Suggestions</h3>
        <Button onClick={onClose} type="button" variant="ghost">
          Close suggestions
        </Button>
      </div>
      <div className="space-y-2">
        <h4 className="text-xs font-medium">{suggestions.sameProject.label}</h4>
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
          <p className="text-xs text-muted-foreground">No suggestions.</p>
        )}
      </div>
      {suggestions.otherProjects.map((group) => {
        const groupKey = group.items.map((item) => item.id).join("-");
        return (
          <div className="space-y-2" key={groupKey || group.label}>
            <h4 className="text-xs font-medium">{group.label}</h4>
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
        <h3 className="text-sm font-semibold">Conversion Preview</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          One new {preview.proposedRecord.recordType} will be created in the
          selected scope.
        </p>
      </div>
      <CaptureSourceSummary
        formattingPreferences={formattingPreferences}
        item={preview.source}
      />
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h4 className="text-sm font-medium">Proposed record</h4>
        <p className="text-sm">
          {preview.proposedRecord.recordType}: {preview.proposedRecord.title}
        </p>
        <p className="text-xs text-muted-foreground">
          Target scope: {preview.targetScope.label}
          {preview.targetScope.projectId
            ? ` · ${preview.targetScope.projectId}`
            : ""}
        </p>
      </div>
      {preview.fieldMappings.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Field mappings</h4>
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
        <h4 className="text-sm font-medium">Relation preview</h4>
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
        <h3 className="text-sm font-semibold">Attach Preview</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Review the relation and target before this Capture Inbox item is
          consumed.
        </p>
      </div>
      <CaptureSourceSummary
        formattingPreferences={formattingPreferences}
        item={preview.source}
      />
      <div className="space-y-2 border border-border/70 bg-background px-4 py-3">
        <h4 className="text-sm font-medium">Relation preview</h4>
        <p className="text-sm">
          {preview.relationPreview.relation} → {preview.target.title}
        </p>
        <p className="text-xs text-muted-foreground">
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
        <h2 className="text-base font-semibold">Undo Preview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
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
        <h3 className="text-sm font-medium">Only this merge</h3>
        <p className="text-xs text-muted-foreground">
          Relations:{" "}
          {preview.removeFromTarget.attributedRelationIds.join(", ") || "None"}
        </p>
        <p className="text-xs text-muted-foreground">
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

function captureConversionProjectId(projectId: string | null) {
  return projectId ?? "";
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
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
}) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const projects = useQuery(projectsQueryOptions());
  const [mode, setMode] = useState<ActionMode>(null);
  const [conversionValues, setConversionValues] =
    useState<CaptureConversionSetupValues>({
      projectId: captureConversionProjectId(item.projectId),
      recordType: "",
    });
  const [attachmentValues, setAttachmentValues] =
    useState<CaptureAttachmentSetupValues>({
      relation: "Origin",
      targetId: "",
    });
  const refreshInbox = useCallback(
    async (advanceAfterExit = false) => {
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
      setMode(null);
      if (advanceAfterExit) {
        onTriageExit?.();
      }
    },
    [accountId, onTriageExit, queryClient],
  );

  const previewConversion = useMutation({
    mutationKey: orpc.previewCaptureConversion.mutationKey(),
    mutationFn: (input: CaptureConvertPreviewInput) =>
      shell.runOnlineOnly(() => client.previewCaptureConversion(input)),
  });
  const convert = useMutation(
    orpc.convertCapture.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.convertCapture(input),
      onSuccess: async () => {
        await Promise.all([
          ...invalidateSmartCollectionMembership(queryClient),
          refreshInbox(true),
        ]);
      },
    }),
  );
  const previewAttachment = useMutation({
    mutationKey: orpc.previewCaptureAttachment.mutationKey(),
    mutationFn: (input: CaptureAttachPreviewInput) =>
      shell.runOnlineOnly(() => client.previewCaptureAttachment(input)),
  });
  const attach = useMutation(
    orpc.attachCapture.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.attachCapture(input),
      onSuccess: async (receipt) => {
        onUndoPreview(receipt.mergeId);
        toast.success("Capture attached.");
        await refreshInbox(true);
      },
    }),
  );
  const deleteCapture = useMutation(
    orpc.deleteCapture.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.deleteCapture(input),
      onSuccess: () => refreshInbox(true),
    }),
  );
  const suggestions = useMutation({
    mutationKey: orpc.captureSuggestions.mutationKey(),
    mutationFn: (input: { itemId: string }) =>
      shell.runOnlineOnly(() => client.captureSuggestions(input)),
  });

  const isPending = [
    previewConversion,
    convert,
    previewAttachment,
    attach,
    deleteCapture,
    suggestions,
  ].some((mutation) => mutation.isPending);
  const isOnline = connection !== "offline";
  const suggestionPreview =
    mode === "suggestions" && suggestions.variables?.itemId === item.id
      ? suggestions.data
      : null;
  const conversionPreview =
    mode === "convert" && previewConversion.variables?.itemId === item.id
      ? previewConversion.data
      : null;
  const attachPreview =
    mode === "attach" && previewAttachment.variables?.itemId === item.id
      ? previewAttachment.data
      : null;
  const activeMutations = {
    attach: [previewAttachment, attach],
    convert: [previewConversion, convert],
    suggestions: [suggestions],
  };
  const activeError = mode
    ? activeMutations[mode].some((mutation) => mutation.isError)
    : deleteCapture.isError;
  const actionMessage = activeError ? triageErrorMessage() : null;
  const { reset: resetAttach } = attach;
  const { reset: resetConvert } = convert;
  const { reset: resetDelete } = deleteCapture;
  const { reset: resetAttachmentPreview } = previewAttachment;
  const { reset: resetConversionPreview } = previewConversion;
  const { reset: resetSuggestions } = suggestions;

  const setActionMode = useCallback(
    (nextMode: ActionMode) => {
      resetAttach();
      resetConvert();
      resetAttachmentPreview();
      resetConversionPreview();
      resetSuggestions();
      setMode(nextMode);
    },
    [
      resetAttach,
      resetConvert,
      resetAttachmentPreview,
      resetConversionPreview,
      resetSuggestions,
    ],
  );

  const startMode = useCallback(
    (nextMode: Exclude<ActionMode, null>) => {
      resetDelete();
      setActionMode(nextMode);
    },
    [resetDelete, setActionMode],
  );

  const closeMode = useCallback(() => setActionMode(null), [setActionMode]);

  const useSuggestion = useCallback(
    (suggestion: CaptureSuggestion) => {
      setAttachmentValues((current) => ({
        ...current,
        targetId: suggestion.id,
      }));
      startMode("attach");
    },
    [startMode],
  );

  const openConvert = useCallback(() => {
    setConversionValues((current) => ({
      ...current,
      projectId: captureConversionProjectId(item.projectId),
    }));
    startMode("convert");
  }, [item.projectId, startMode]);
  const openAttach = useCallback(() => startMode("attach"), [startMode]);
  const handleDelete = useCallback(() => {
    closeMode();
    deleteCapture.mutate(
      commandVariables(
        { itemId: item.id },
        deleteCapture.isError ? deleteCapture.variables : undefined,
      ),
    );
  }, [closeMode, deleteCapture, item.id]);
  const showSuggestions = useCallback(() => {
    startMode("suggestions");
    suggestions.mutate({ itemId: item.id });
  }, [item.id, startMode, suggestions]);
  const handlePreviewConversion = useCallback(
    (input: CaptureConvertPreviewInput) => {
      setConversionValues({
        projectId: input.projectId ?? "",
        recordType: input.recordType,
      });
      previewConversion.mutate(input);
    },
    [previewConversion],
  );
  const handlePreviewAttachment = useCallback(
    (input: CaptureAttachPreviewInput) => {
      setAttachmentValues({
        relation: input.relation,
        targetId: input.targetId,
      });
      previewAttachment.mutate(input);
    },
    [previewAttachment],
  );
  const confirmConversion = useCallback(() => {
    if (conversionPreview) {
      convert.mutate(
        commandVariables<Omit<CaptureConvertInput, "clientIdempotencyKey">>(
          { itemId: item.id, previewId: conversionPreview.previewId },
          convert.isError ? convert.variables : undefined,
        ),
      );
    }
  }, [conversionPreview, convert, item.id]);
  const confirmAttachment = useCallback(() => {
    if (attachPreview) {
      attach.mutate(
        commandVariables<
          Omit<
            Parameters<typeof client.attachCapture>[0],
            "clientIdempotencyKey"
          >
        >(
          {
            itemId: item.id,
            previewId: attachPreview.previewId,
            relation: attachmentValues.relation,
            targetId: attachmentValues.targetId.trim(),
          },
          attach.isError ? attach.variables : undefined,
        ),
      );
    }
  }, [
    attach,
    attachPreview,
    attachmentValues.relation,
    attachmentValues.targetId,
    item.id,
  ]);

  return (
    <div className="space-y-3 border-t pt-3">
      <CaptureTriageActions
        handleDelete={handleDelete}
        isOnline={isOnline}
        isPending={isPending}
        openAttach={openAttach}
        openConvert={openConvert}
        showSuggestions={showSuggestions}
        triageAvailable={triageAvailable}
      />
      {actionMessage ? (
        <p
          className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {actionMessage}
        </p>
      ) : null}
      {mode === "convert" && !conversionPreview ? (
        <CaptureConversionSetupForm
          initialValues={conversionValues}
          isOnline={isOnline}
          itemId={item.id}
          key={`${item.id}:${conversionValues.projectId}:${conversionValues.recordType}`}
          onCancel={closeMode}
          onPreview={handlePreviewConversion}
          previewPending={previewConversion.isPending}
          projects={projects.data}
          sourceProjectId={item.projectId}
        />
      ) : null}
      {mode === "attach" && !attachPreview ? (
        <CaptureAttachmentSetupForm
          initialValues={attachmentValues}
          isOnline={isOnline}
          itemId={item.id}
          key={`${item.id}:${attachmentValues.relation}:${attachmentValues.targetId}`}
          onCancel={closeMode}
          onPreview={handlePreviewAttachment}
          previewPending={previewAttachment.isPending}
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

function CaptureTriageActions({
  triageAvailable,
  isOnline,
  isPending,
  openConvert,
  openAttach,
  handleDelete,
  showSuggestions,
}: {
  triageAvailable: boolean;
  isOnline: boolean;
  isPending: boolean;
  openConvert: () => void;
  openAttach: () => void;
  handleDelete: () => void;
  showSuggestions: () => void;
}) {
  return (
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
  );
}
