import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export interface SurfaceLink {
  hash?: string;
  params?: { projectId: string };
  to: "/personal-wiki" | "/projects/$projectId";
}

/** Where `Open source` goes: the owning Project, or the Personal Wiki. */
export function sourceLink(row: SurfaceRow): SurfaceLink {
  if (row.visibility === "Wiki" || !row.projectId) {
    return { to: "/personal-wiki" };
  }
  return {
    hash:
      row.source.kind === "Document"
        ? documentRecordHash(row.source.id)
        : undefined,
    params: { projectId: row.projectId },
    to: "/projects/$projectId",
  };
}

/** The Project `Share` surface owns Review diff and expiry for a Link share. */
export function shareLink(row: SurfaceRow): SurfaceLink {
  if (!row.projectId) {
    return sourceLink(row);
  }
  return {
    hash: "share",
    params: { projectId: row.projectId },
    to: "/projects/$projectId",
  };
}
