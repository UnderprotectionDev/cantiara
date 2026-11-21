// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { StarterSkeletonSelection } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  createDialogHandle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
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
  const archived = useSearch({
    strict: false,
    select: (search) => search.documentsArchived === true,
  });
  const baseHash = projectId === null ? "" : "documents";
  const selectDocument = (id: string | null, showArchived = archived) =>
    navigate({
      hash: id ? documentRecordHash(id) : baseHash,
      search: (search) => ({
        ...search,
        documentsArchived: showArchived || undefined,
      }),
      to: ".",
    }).catch(() => undefined);
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
  const selectedId = selectedDocumentId ?? null;
  const [createHandle] = useState(createDialogHandle);
  const selected = allDocuments.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selectedDocumentId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(documentRecordHash(selectedDocumentId))
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDocumentId]);

  return (
    <section aria-label="Documents" className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Documents</h2>
        <Label className="flex items-center gap-2" htmlFor="documents-archived">
          <Checkbox
            checked={archived}
            id="documents-archived"
            onCheckedChange={(checked) => {
              selectDocument(null, checked);
            }}
          />
          Archived
        </Label>
        <DialogTrigger handle={createHandle} render={<Button />}>
          Create Document
        </DialogTrigger>
      </header>
      <DocumentTemplatesSurface
        onCreated={async (created) => {
          await selectDocument(created.id, false);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
            ...invalidateSmartCollectionMembership(queryClient),
          ]);
        }}
        projectId={projectId}
        source={selected}
      />
      <DocumentCreateForm
        documentStarterSkeletons={documentStarterSkeletons}
        handle={createHandle}
        onCreated={async (created) => {
          await selectDocument(created.id, false);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
            ...invalidateSmartCollectionMembership(queryClient),
          ]);
        }}
        projectId={projectId}
      />
      {documents.isError ? (
        <p role="alert">Documents could not be loaded.</p>
      ) : null}
      <div className="space-y-5">
        <DocumentNavigation
          documents={documents.data ?? []}
          onSelect={selectDocument}
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
