// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { StarterSkeletonSelection } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Label } from "@cantiara/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";
import DocumentCreateForm, {
  type DocumentStarterSkeletonSelection,
} from "../forms/document-create-form";
import DocumentEditor from "../forms/document-editor-form";
import DocumentTemplatesSurface from "../forms/document-templates-form";
import DocumentNavigation from "./document-navigation";

export default function DocumentsSurface({
  accountFormattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
  projectId,
  selectedDocumentId,
  selectedSectionId,
  starterSkeletons,
}: {
  accountFormattingPreferences?: AccountPreferences;
  projectId: string | null;
  selectedDocumentId?: string;
  selectedSectionId?: string;
  starterSkeletons: readonly StarterSkeletonSelection[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [archived, setArchived] = useState(false);
  const options = orpc.documents.queryOptions({
    input: { projectId, archived },
  });
  const documents = useQuery(options);
  const documentStarterSkeletons = starterSkeletons.filter(
    (selection): selection is DocumentStarterSkeletonSelection =>
      selection.surface === "Document",
  );
  const counterpart = useQuery(
    orpc.documents.queryOptions({ input: { projectId, archived: !archived } }),
  );
  const allDocuments = [...(documents.data ?? []), ...(counterpart.data ?? [])];
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedDocumentId ?? null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const selected =
    documents.data?.find((item) => item.id === selectedId) ??
    (selectedId === selectedDocumentId
      ? counterpart.data?.find((item) => item.id === selectedId)
      : undefined);

  useEffect(() => {
    if (
      selectedDocumentId &&
      documents.data?.some(({ id }) => id === selectedDocumentId)
    ) {
      setSelectedId(selectedDocumentId);
    }
  }, [documents.data, selectedDocumentId]);

  useEffect(() => {
    if (!selectedDocumentId || selectedId !== selectedDocumentId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(documentRecordHash(selectedDocumentId))
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDocumentId, selectedId]);

  return (
    <section aria-label="Documents" className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-2xl">Documents</h2>
        <Label className="flex items-center gap-2" htmlFor="documents-archived">
          <Checkbox
            checked={archived}
            id="documents-archived"
            onCheckedChange={(checked) => {
              setArchived(Boolean(checked));
              setSelectedId(null);
            }}
          />
          Archived
        </Label>
        <Button onClick={() => setCreateOpen(true)} type="button">
          Create Document
        </Button>
      </header>
      <DocumentTemplatesSurface
        onCreated={async (created) => {
          setSelectedId(created.id);
          if (projectId === null) {
            navigate({
              hash: documentRecordHash(created.id),
              search: true,
              to: ".",
            }).catch(() => undefined);
          }
          await queryClient.invalidateQueries({ queryKey: options.queryKey });
        }}
        projectId={projectId}
        source={selected}
      />
      <DocumentCreateForm
        documentStarterSkeletons={documentStarterSkeletons}
        onCreated={async (created) => {
          setCreateOpen(false);
          setArchived(false);
          setSelectedId(created.id);
          if (projectId === null) {
            navigate({
              hash: documentRecordHash(created.id),
              search: true,
              to: ".",
            }).catch(() => undefined);
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
            ...invalidateSmartCollectionMembership(queryClient),
          ]);
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        projectId={projectId}
      />
      {documents.isError ? (
        <p role="alert">Documents could not be loaded.</p>
      ) : null}
      <div className="space-y-5">
        <DocumentNavigation
          documents={documents.data ?? []}
          onSelect={setSelectedId}
          scope={
            projectId === null
              ? { kind: "wiki" }
              : { kind: "project", projectId }
          }
          selectedId={selectedId}
        />
        {selected ? (
          <DocumentEditor
            accountFormattingPreferences={accountFormattingPreferences}
            documents={allDocuments}
            key={selected.id}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
            }
            record={selected}
            targetSectionId={
              selected.id === selectedDocumentId ? selectedSectionId : undefined
            }
          />
        ) : (
          <p>Select a Document.</p>
        )}
      </div>
    </section>
  );
}
