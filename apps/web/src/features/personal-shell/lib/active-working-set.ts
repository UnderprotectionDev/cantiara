export type ActiveWorkingSetKind = "Work" | "Document";

/** What the session holds about one İş or Belge: a pointer, never a copy of the record. */
export interface ActiveWorkingSetMember {
  id: string;
  kind: ActiveWorkingSetKind;
  label: string;
  projectId: string | null;
}

export function memberKey(
  member: Pick<ActiveWorkingSetMember, "id" | "kind">,
): string {
  return `${member.kind}:${member.id}`;
}

export function hasMember(
  members: readonly ActiveWorkingSetMember[],
  member: Pick<ActiveWorkingSetMember, "id" | "kind">,
): boolean {
  return members.some((item) => memberKey(item) === memberKey(member));
}

/** Insertion order is the only order; re-adding keeps the first position. */
export function addMember(
  members: readonly ActiveWorkingSetMember[],
  member: ActiveWorkingSetMember,
): ActiveWorkingSetMember[] {
  return hasMember(members, member) ? [...members] : [...members, member];
}

export function removeMember(
  members: readonly ActiveWorkingSetMember[],
  member: Pick<ActiveWorkingSetMember, "id" | "kind">,
): ActiveWorkingSetMember[] {
  return members.filter((item) => memberKey(item) !== memberKey(member));
}

/** Work needs its Project to open in context; a Document may be a Personal Wiki one. */
export function memberPreviewTarget(member: ActiveWorkingSetMember) {
  if (member.kind === "Document") {
    return {
      documentId: member.id,
      kind: "document" as const,
      label: member.label,
      projectId: member.projectId,
    };
  }
  return member.projectId
    ? {
        kind: "work" as const,
        label: member.label,
        projectId: member.projectId,
        workId: member.id,
      }
    : null;
}
