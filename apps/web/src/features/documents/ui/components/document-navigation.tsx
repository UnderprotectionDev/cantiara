// biome-ignore-all lint/performance/noJsxPropsBind: Record windows bind identity to the row model for this surface.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { type MouseEvent, useCallback, useMemo } from "react";

import {
  type DocumentScopeFilter,
  documentScopeLabel,
  documentsInScope,
} from "@/features/personal-wiki/lib/document-scope";
import DocumentScopeBadge from "@/features/personal-wiki/ui/components/document-scope-badge";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

interface DocumentNavigationProps {
  documents: Document[];
  onSelect: (id: string) => void;
  scope?: DocumentScopeFilter;
  selectedId: string | null;
}

export default function DocumentNavigation(props: DocumentNavigationProps) {
  const { documents: allDocuments, scope } = props;
  const homes = useMemo(() => {
    const grouped = new Map<string | null, Document[]>();
    for (const record of documentsInScope(
      allDocuments,
      scope ?? { kind: "all" },
    )) {
      const records = grouped.get(record.projectId) ?? [];
      records.push(record);
      grouped.set(record.projectId, records);
    }
    return grouped;
  }, [allDocuments, scope]);
  return (
    <nav aria-label="Documents" className="space-y-3">
      {[...homes].map(([projectId, documents]) => (
        <section
          aria-label={documentScopeLabel(projectId)}
          className="space-y-3"
          key={projectId === null ? "wiki" : `project:${projectId}`}
        >
          <DocumentHomeNavigation
            documents={documents}
            onSelect={props.onSelect}
            selectedId={props.selectedId}
          />
        </section>
      ))}
    </nav>
  );
}

type NavigationRow =
  | { id: string; folder: string }
  | { id: string; record: Document; depth: number; parentTitle?: string };

function documentDepth(record: Document, byId: ReadonlyMap<string, Document>) {
  let level = 1;
  let parentId = record.parentDocumentId;
  const visited = new Set([record.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    level += 1;
    parentId = parent.parentDocumentId;
  }
  return level;
}

function folderOrder(records: Document[]): Document[] {
  const ids = new Set(records.map((record) => record.id));
  const children = new Map<string | null, Document[]>();
  for (const record of records) {
    const parentId =
      record.parentDocumentId && ids.has(record.parentDocumentId)
        ? record.parentDocumentId
        : null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(record);
    children.set(parentId, siblings);
  }
  const ordered: Document[] = [];
  const stack = [...(children.get(null) ?? [])].reverse();
  while (stack.length > 0) {
    const record = stack.pop();
    if (record) {
      ordered.push(record);
      stack.push(...[...(children.get(record.id) ?? [])].reverse());
    }
  }
  return ordered;
}

function navigationRows(documents: Document[]): NavigationRow[] {
  const byId = new Map(documents.map((record) => [record.id, record]));
  const folders = new Map<string, Document[]>();
  for (const record of documents) {
    const folder = record.folder ?? "";
    const records = folders.get(folder) ?? [];
    records.push(record);
    folders.set(folder, records);
  }

  const rows: NavigationRow[] = [];
  for (const [folder, records] of folders) {
    if (folder) {
      rows.push({ folder, id: `folder:${folder}` });
    }
    for (const record of folderOrder(records)) {
      const parent = record.parentDocumentId
        ? byId.get(record.parentDocumentId)
        : undefined;
      rows.push({
        depth: documentDepth(record, byId),
        id: record.id,
        parentTitle: parent?.title,
        record,
      });
    }
  }
  return rows;
}

function DocumentHomeNavigation({
  documents,
  selectedId,
  onSelect,
}: DocumentNavigationProps) {
  const rows = useMemo(() => navigationRows(documents), [documents]);
  const selectDocument = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.documentId;
      if (id) {
        onSelect(id);
      }
    },
    [onSelect],
  );
  return (
    <VirtualList
      className="space-y-1"
      estimateSize={36}
      gap={4}
      getKey={virtualRowId}
      isFocusable={(row) => "record" in row}
      rows={rows}
      scrollToKey={selectedId}
    >
      {(row, rowProps) => {
        if ("folder" in row) {
          return (
            <li {...rowProps}>
              <h3 className="text-sm font-medium text-muted-foreground">
                {row.folder}
              </h3>
            </li>
          );
        }
        const { record } = row;
        return (
          <li
            {...rowProps}
            className="flex flex-wrap items-center gap-2"
            data-depth={row.depth}
            style={{
              ...rowProps.style,
              paddingLeft: `${(row.depth - 1) * 16}px`,
            }}
          >
            <Button
              aria-current={record.id === selectedId ? "page" : undefined}
              aria-describedby={
                row.parentTitle
                  ? `document-scope-${record.id} document-parent-${record.id}`
                  : `document-scope-${record.id}`
              }
              className="max-w-full justify-start"
              data-document-id={record.id}
              id={documentRecordHash(record.id)}
              onClick={selectDocument}
              type="button"
              variant={record.id === selectedId ? "secondary" : "ghost"}
            >
              {record.title}
            </Button>
            <DocumentScopeBadge document={record} />
            {row.parentTitle ? (
              <span className="sr-only" id={`document-parent-${record.id}`}>
                Child of {row.parentTitle}
              </span>
            ) : null}
          </li>
        );
      }}
    </VirtualList>
  );
}
