import {
  type Document,
  type DocumentConflictDraft,
  documentTypeSchema,
} from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";
import {
  type ChangeEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

interface DraftComparison {
  body: string;
  current: Document;
  draft: DocumentConflictDraft;
  title: string;
  type: Document["type"];
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
  const draftOptions = orpc.documentConflictDrafts.queryOptions({
    input: { documentId },
  });
  const currentOptions = orpc.document.queryOptions({ input: { documentId } });
  const drafts = useQuery(draftOptions);
  const current = useQuery(currentOptions);
  const [comparison, setComparison] = useState<DraftComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [independent, setIndependent] = useState<Pick<
    Document,
    "title" | "body" | "type"
  > | null>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (rejected) {
      queryClient
        .invalidateQueries({ queryKey: draftOptions.queryKey })
        .catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: currentOptions.queryKey })
        .catch(() => undefined);
    }
  }, [rejected, queryClient, draftOptions.queryKey, currentOptions.queryKey]);

  const resolve = useMutation({
    mutationFn: (action: "Apply parts" | "Create Document" | "Delete") =>
      runOnlineOnlyWrite(async () => {
        if (!comparison) {
          throw new Error("Compare a Conflict Draft first.");
        }
        const { draft } = comparison;
        const fingerprint = JSON.stringify({ action, comparison, independent });
        if (request.current?.fingerprint !== fingerprint) {
          request.current = { fingerprint, key: crypto.randomUUID() };
        }
        const clientIdempotencyKey = request.current.key;
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
      }),
    onSuccess: async (document) => {
      request.current = null;
      setComparison(null);
      setIndependent(null);
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

  const available = drafts.data ?? (rejected ? [rejected] : []);
  function compareDraft(event: MouseEvent<HTMLButtonElement>) {
    const draft = available.find(
      (item) => item.id === event.currentTarget.dataset.draftId,
    );
    if (draft && current.data) {
      setComparison({
        draft,
        current: current.data,
        title: current.data.title,
        body: current.data.body,
        type: current.data.type,
      });
      setError(null);
    }
  }
  function changeResultTitle(event: ChangeEvent<HTMLInputElement>) {
    if (comparison) {
      setComparison({ ...comparison, title: event.target.value });
    }
  }
  function changeResultType(event: ChangeEvent<HTMLSelectElement>) {
    if (comparison) {
      setComparison({
        ...comparison,
        type: documentTypeSchema.parse(event.target.value),
      });
    }
  }
  function changeResultBody(event: ChangeEvent<HTMLTextAreaElement>) {
    if (comparison) {
      setComparison({ ...comparison, body: event.target.value });
    }
  }
  function applyParts() {
    resolve.mutate("Apply parts");
  }
  function deleteDraft() {
    resolve.mutate("Delete");
  }
  function openIndependent() {
    if (comparison) {
      setIndependent({
        title: comparison.draft.title,
        body: comparison.draft.body,
        type: comparison.draft.type,
      });
    }
  }
  function closeIndependent() {
    setIndependent(null);
  }
  function changeIndependentOpen(open: boolean) {
    if (!(open || resolve.isPending)) {
      closeIndependent();
    }
  }
  function changeIndependentTitle(event: ChangeEvent<HTMLInputElement>) {
    if (independent) {
      setIndependent({ ...independent, title: event.target.value });
    }
  }
  function changeIndependentBody(event: ChangeEvent<HTMLTextAreaElement>) {
    if (independent) {
      setIndependent({ ...independent, body: event.target.value });
    }
  }
  function createIndependent() {
    resolve.mutate("Create Document");
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
            disabled={disabled || !current.data || resolve.isPending}
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
          <fieldset
            className="space-y-3"
            disabled={disabled || resolve.isPending}
          >
            <Label htmlFor="conflict-result-title">Title</Label>
            <Input
              id="conflict-result-title"
              onChange={changeResultTitle}
              value={comparison.title}
            />
            <Label htmlFor="conflict-result-type">Type</Label>
            <NativeSelect
              id="conflict-result-type"
              onChange={changeResultType}
              value={comparison.type}
            >
              {documentTypeSchema.options.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Label htmlFor="conflict-result-body">Markdown source</Label>
            <textarea
              className="min-h-40 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
              id="conflict-result-body"
              onChange={changeResultBody}
              value={comparison.body}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!comparison.title.trim()}
                onClick={applyParts}
                type="button"
              >
                Apply parts
              </Button>
              <Button onClick={openIndependent} type="button" variant="outline">
                Create Document
              </Button>
              <Button onClick={deleteDraft} type="button" variant="destructive">
                Delete
              </Button>
            </div>
          </fieldset>
        </div>
      ) : null}
      <Dialog onOpenChange={changeIndependentOpen} open={independent !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document</DialogTitle>
            <DialogDescription>
              Choose a title and keep all or selected rejected text. The new
              Document stays in the same scope with a Conflict Draft origin.
            </DialogDescription>
          </DialogHeader>
          {independent ? (
            <fieldset
              className="space-y-3"
              disabled={disabled || resolve.isPending}
            >
              <Label htmlFor="conflict-new-title">Title</Label>
              <Input
                id="conflict-new-title"
                onChange={changeIndependentTitle}
                value={independent.title}
              />
              <Label htmlFor="conflict-new-body">Markdown source</Label>
              <textarea
                className="min-h-40 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
                id="conflict-new-body"
                onChange={changeIndependentBody}
                value={independent.body}
              />
              {error ? <p role="alert">{error}</p> : null}
              <DialogFooter>
                <Button
                  onClick={closeIndependent}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!independent.title.trim()}
                  onClick={createIndependent}
                  type="button"
                >
                  Create Document
                </Button>
              </DialogFooter>
            </fieldset>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
