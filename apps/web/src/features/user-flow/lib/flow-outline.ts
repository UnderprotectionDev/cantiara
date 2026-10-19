import type { EditorDocument, EditorNode } from "./flow-editor";

/**
 * Structured outline of the versioned document: the pointer-free equivalent of
 * the canvas. Sections list their members nested beneath them; a Section the
 * founder collapsed in their own view hides its members from the outline and
 * the canvas alike. Collapse is view-local and never enters the document.
 */
export interface OutlineRow {
  /** Members hidden by this Section's collapse; 0 for a non-Section node. */
  collapsedMembers: number;
  /** 1 for a member shown under its Section, 0 otherwise. */
  depth: 0 | 1;
  isCollapsed: boolean;
  memberCount: number;
  node: EditorNode;
}

function sectionIdsOf(document: EditorDocument) {
  return new Set(
    document.nodes.filter(({ kind }) => kind === "Section").map(({ id }) => id),
  );
}

/** Node ids a collapsed Section hides from this account's view. */
export function hiddenNodeIds(
  document: EditorDocument,
  collapsed: readonly string[],
): Set<string> {
  const sections = sectionIdsOf(document);
  const closed = new Set(collapsed.filter((id) => sections.has(id)));
  return new Set(
    document.nodes
      .filter(({ sectionId }) => sectionId && closed.has(sectionId))
      .map(({ id }) => id),
  );
}

export function toggleCollapsed(
  collapsed: readonly string[],
  sectionId: string,
): string[] {
  return collapsed.includes(sectionId)
    ? collapsed.filter((id) => id !== sectionId)
    : [...collapsed, sectionId];
}

export function buildOutline(
  document: EditorDocument,
  collapsed: readonly string[],
): OutlineRow[] {
  const sections = sectionIdsOf(document);
  const closed = new Set(collapsed.filter((id) => sections.has(id)));
  const membersOf = new Map<string, EditorNode[]>();
  for (const node of document.nodes) {
    if (node.sectionId && sections.has(node.sectionId)) {
      membersOf.set(node.sectionId, [
        ...(membersOf.get(node.sectionId) ?? []),
        node,
      ]);
    }
  }
  const rows: OutlineRow[] = [];
  for (const node of document.nodes) {
    if (node.sectionId && sections.has(node.sectionId)) {
      continue;
    }
    const members = membersOf.get(node.id) ?? [];
    const isCollapsed = closed.has(node.id);
    rows.push({
      collapsedMembers: isCollapsed ? members.length : 0,
      depth: 0,
      isCollapsed,
      memberCount: members.length,
      node,
    });
    if (!isCollapsed) {
      for (const member of members) {
        rows.push({
          collapsedMembers: 0,
          depth: 1,
          isCollapsed: false,
          memberCount: 0,
          node: member,
        });
      }
    }
  }
  return rows;
}
