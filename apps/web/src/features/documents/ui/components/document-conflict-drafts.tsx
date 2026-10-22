// biome-ignore-all lint/performance/noJsxPropsBind: Conflict Draft controls bind to the draft being resolved.
import type { Document, DocumentConflictDraft } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import DocumentConflictIndependentForm from "../forms/document-conflict-independent-form";
import DocumentConflictResultForm, {
  type ConflictResultValues,
} from "../forms/document-conflict-result-form";

interface DraftComparison {
  body: string;
  current: Document;
  draft: DocumentConflictDraft;
  title: string;
  type: Document["type"];
}

async function resolveComparedDraft(
  documentId: string,
  action: "Apply parts" | "Create Document" | "Delete",
  comparison: DraftComparison,
  independent: Pick<Document, "title" | "body" | "type"> | null,
  clientIdempotencyKey: string,
) {
  const { draft } = comparison;
  if (action === "Apply parts") {
    return client.updateDocument({
      documentId,
      conflictDraftId: draft.id,
      baseRevision: comparison.current.revision,
      clientIdempotencyKey,
      title: comparison.title,
      body: comparison.body,
      type: comparison.type,
    });
  }
  if (action === "Create Document") {
    if (!independent) {
      throw new Error("Choose the new Document title and content first.");
    }
    await client.createDocument({
      projectId: draft.projectId,
      conflictDraftId: draft.id,
      baseRevision: 0,
      clientIdempotencyKey,
      ...independent,
    });
  } else {
    await client.discardDocumentConflictDraft({
      documentId,
      conflictDraftId: draft.id,
    });
  }
  return client.document({ documentId });
}

export default function DocumentConflictDrafts({
  documentId,
  rejected,
  onResolved,
  disabled,
}: {
  documentId: string;
  rejected: DocumentConflictDraft | null;
  onResolved: (current: Document) => void;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const draftOptions = useMemo(
    () => orpc.documentConflictDrafts.queryOptions({ input: { documentId } }),
    [documentId],
  );
  const currentOptions = useMemo(
    () => orpc.document.queryOptions({ input: { documentId } }),
    [documentId],
  );
  const drafts = useQuery(draftOptions);
  const current = useQuery(currentOptions);
  const [comparison, setComparison] = useState<DraftComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [independentSeed, setIndependentSeed] = useState<{
    initial: ConflictResultValues;
    result: ConflictResultValues;
  } | null>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);

  const rejectedDraftId = rejected?.id ?? null;
  useEffect(() => {
    if (rejectedDraftId) {
      queryClient
        .invalidateQueries({ queryKey: draftOptions.queryKey })
        .catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: currentOptions.queryKey })
        .catch(() => undefined);
    }
  }, [
    rejectedDraftId,
    queryClient,
    draftOptions.queryKey,
    currentOptions.queryKey,
  ]);

  const resolve = useMutation({
    mutationFn: ({
      action,
      independent,
      result,
    }: {
      action: "Apply parts" | "Create Document" | "Delete";
      independent: ConflictResultValues | null;
      result: ConflictResultValues;
    }) =>
      runOnlineOnlyWrite(() => {
        if (!comparison) {
          throw new Error("Compare a Conflict Draft first.");
        }
        const edited = { ...comparison, ...result };
        const fingerprint = JSON.stringify({
          action,
          comparison: edited,
          independent,
        });
        if (request.current?.fingerprint !== fingerprint) {
          request.current = { fingerprint, key: crypto.randomUUID() };
        }
        return resolveComparedDraft(
          documentId,
          action,
          edited,
          independent,
          request.current.key,
        );
      }),
    onSuccess: async (document) => {
      request.current = null;
      setComparison(null);
      setIndependentSeed(null);
      setError(null);
      onResolved(document);
      await queryClient.invalidateQueries({ queryKey: draftOptions.queryKey });
      await queryClient.invalidateQueries({
        queryKey: currentOptions.queryKey,
      });
    },
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : "Conflict Draft could not be resolved.",
      );
      queryClient
        .invalidateQueries({ queryKey: currentOptions.queryKey })
        .catch(() => undefined);
    },
  });

  const available = [...(drafts.data ?? [])];
  const compare = useMutation({
    mutationFn: async (
      draft: DocumentConflictDraft,
    ): Promise<DraftComparison> => {
      const { data: document } = await current.refetch({
        cancelRefetch: false,
        throwOnError: true,
      });
      if (!document) {
        throw new Error("The current Document could not be loaded.");
      }
      return {
        draft,
        current: document,
        title: document.title,
        body: document.body,
        type: document.type,
      };
    },
    onMutate: () => {
      setComparison(null);
      setError(null);
    },
    onSuccess: setComparison,
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : "The current Document could not be loaded.",
      );
    },
  });
  if (rejected && !available.some((draft) => draft.id === rejected.id)) {
    available.push(rejected);
  }
  function compareDraft(event: MouseEvent<HTMLButtonElement>) {
    const draft = available.find(
      (item) => item.id === event.currentTarget.dataset.draftId,
    );
    if (draft) {
      compare.mutate(draft);
    }
  }
  function applyParts(result: ConflictResultValues) {
    resolve.mutate({ action: "Apply parts", independent: null, result });
  }
  function deleteDraft(result: ConflictResultValues) {
    resolve.mutate({ action: "Delete", independent: null, result });
  }
  function openIndependent(result: ConflictResultValues) {
    if (comparison) {
      setIndependentSeed({
        initial: {
          title: comparison.draft.title,
          body: comparison.draft.body,
          type: comparison.draft.type,
        },
        result,
      });
    }
  }
  function closeIndependent() {
    setIndependentSeed(null);
  }
  function changeIndependentOpen(open: boolean) {
    if (!(open || resolve.isPending)) {
      closeIndependent();
    }
  }
  function createIndependent(independent: ConflictResultValues) {
    if (independentSeed) {
      resolve.mutate({
        action: "Create Document",
        independent,
        result: independentSeed.result,
      });
    }
  }
  const changes = comparison
    ? diffLines(comparison.current.body, comparison.draft.body)
        .map((part) => {
          let prefix = "  ";
          if (part.added) {
            prefix = "+ ";
          } else if (part.removed) {
            prefix = "- ";
          }
          const value = part.value.endsWith("\n")
            ? part.value
            : `${part.value}\n`;
          return `${prefix}${value}`;
        })
        .join("")
    : "";
  if (available.length === 0 && !drafts.isError) {
    return null;
  }
  return (
    <section
      aria-label="Conflict Drafts"
      className="mb-5 space-y-4 rounded-lg border border-border p-4"
    >
      <h3 className="font-semibold">Conflict Draft</h3>
      <p>
        Rejected text is not part of Document history, search, share, publish,
        or export until resolved.
      </p>
      {drafts.isError ? (
        <p role="alert">Conflict Drafts could not be loaded.</p>
      ) : null}
      {error ? (
        <p role="alert">
          {error} Choose Compare again to review the current version.
        </p>
      ) : null}
      {available.map((draft) => (
        <div className="flex flex-wrap items-center gap-3" key={draft.id}>
          <span>
            {draft.title} · Version {draft.baseRevision}
          </span>
          <Button
            data-draft-id={draft.id}
            disabled={disabled || compare.isPending || resolve.isPending}
            onClick={compareDraft}
            type="button"
            variant="outline"
          >
            Compare
          </Button>
        </div>
      ))}
      {comparison ? (
        <div className="space-y-3">
          <p>
            Current version: {comparison.current.revision}. Review the rejected
            text and edit the result before applying parts.
          </p>
          <section
            aria-label="Compare"
            className="grid min-w-0 gap-3 md:grid-cols-2"
          >
            <div>
              <h4>Current value</h4>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm">
                {comparison.current.title}
                {"\n"}
                {comparison.current.type}
                {"\n"}
                {comparison.current.body}
              </pre>
            </div>
            <div>
              <h4>Conflict Draft</h4>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm">
                {comparison.draft.title}
                {"\n"}
                {comparison.draft.type}
                {"\n"}
                {comparison.draft.body}
              </pre>
            </div>
          </section>
          <section aria-label="Body changes">
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm">
              {changes}
            </pre>
          </section>
          <DocumentConflictResultForm
            disabled={disabled || resolve.isPending}
            initial={{
              body: comparison.body,
              title: comparison.title,
              type: comparison.type,
            }}
            key={comparison.draft.id}
            onApply={applyParts}
            onCreateDocument={openIndependent}
            onDelete={deleteDraft}
          />
        </div>
      ) : null}
      <Dialog
        onOpenChange={changeIndependentOpen}
        open={independentSeed !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document</DialogTitle>
            <DialogDescription>
              Choose a title and keep all or selected rejected text. The new
              Document stays in the same scope with a Conflict Draft origin.
            </DialogDescription>
          </DialogHeader>
          {independentSeed ? (
            <DocumentConflictIndependentForm
              disabled={disabled || resolve.isPending}
              error={error}
              initial={independentSeed.initial}
              onCancel={closeIndependent}
              onSubmit={createIndependent}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
