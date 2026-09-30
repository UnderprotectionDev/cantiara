import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import type { MouseEvent } from "react";

import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export default function DocumentNavigation({
  documents,
  selectedId,
  onSelect,
}: {
  documents: Document[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(documents.map((record) => [record.id, record]));
  const folders = [...new Set(documents.map((record) => record.folder ?? ""))];
  function selectDocument(event: MouseEvent<HTMLButtonElement>) {
    const id = event.currentTarget.dataset.documentId;
    if (id) {
      onSelect(id);
    }
  }
  function depth(record: Document) {
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
  function ordered(folder: string) {
    const records = documents.filter(
      (record) => (record.folder ?? "") === folder,
    );
    const ids = new Set(records.map(({ id }) => id));
    const result: Document[] = [];
    function append(record: Document) {
      result.push(record);
      for (const child of records.filter(
        (item) => item.parentDocumentId === record.id,
      )) {
        append(child);
      }
    }
    for (const record of records.filter(
      (item) => !(item.parentDocumentId && ids.has(item.parentDocumentId)),
    )) {
      append(record);
    }
    return result;
  }
  return (
    <nav aria-label="Documents" className="space-y-3">
      {folders.map((folder) => (
        <div className="space-y-1" key={folder}>
          {folder ? (
            <h3 className="font-medium text-muted-foreground text-sm">
              {folder}
            </h3>
          ) : null}
          <ul className="space-y-1">
            {ordered(folder).map((record) => (
              <li
                data-depth={depth(record)}
                key={record.id}
                style={{ paddingLeft: `${(depth(record) - 1) * 16}px` }}
              >
                <Button
                  aria-current={record.id === selectedId ? "page" : undefined}
                  className="max-w-full justify-start"
                  data-document-id={record.id}
                  id={documentRecordHash(record.id)}
                  onClick={selectDocument}
                  type="button"
                  variant={record.id === selectedId ? "secondary" : "ghost"}
                >
                  {record.title}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
