import { Button } from "@cantiara/ui/components/button";
import { useStore } from "@tanstack/react-store";
import { useCallback } from "react";
import {
  type ActiveWorkingSetMember,
  memberKey,
  memberPreviewTarget,
} from "../../lib/active-working-set";
import {
  activeWorkingSetStore,
  setActiveWorkingSetCollapsed,
} from "../../store/active-working-set";

export type OpenActiveWorkingSetMember = (
  target: NonNullable<ReturnType<typeof memberPreviewTarget>>,
) => void;

function MemberButton({
  member,
  open,
}: {
  member: ActiveWorkingSetMember;
  open: OpenActiveWorkingSetMember;
}) {
  const target = memberPreviewTarget(member);
  const reopen = useCallback(() => {
    if (target) {
      open(target);
    }
  }, [open, target]);
  return (
    <li className="shrink-0">
      <Button
        aria-label={`Open source record: ${member.label}`}
        className="min-h-11"
        disabled={!target}
        onClick={reopen}
        type="button"
        variant="outline"
      >
        <span className="text-muted-foreground text-xs">{member.kind}</span>{" "}
        {member.label}
      </Button>
    </li>
  );
}

/**
 * Session-only tray of held İş and Belge. A member opens its source record in
 * the shared temporary preview, so source-view position stays where it is.
 */
export default function ActiveWorkingSetTray({
  open,
}: {
  open: OpenActiveWorkingSetMember;
}) {
  const { collapsed, members } = useStore(activeWorkingSetStore);
  const collapse = useCallback(() => setActiveWorkingSetCollapsed(true), []);
  const show = useCallback(() => setActiveWorkingSetCollapsed(false), []);
  if (members.length === 0) {
    return null;
  }
  if (collapsed) {
    return (
      <div className="fixed right-4 bottom-4 z-40">
        <Button className="min-h-11" onClick={show} type="button">
          Show tray
        </Button>
      </div>
    );
  }
  return (
    <section
      aria-label="Active Working Set"
      className="fixed inset-x-4 bottom-4 z-40 grid gap-2 rounded-lg border border-border bg-background p-3 shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-sm">
            Active Working Set ({members.length})
          </h2>
          <p className="text-muted-foreground text-xs">
            Held for this session only.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={collapse}
          type="button"
          variant="ghost"
        >
          Collapse
        </Button>
      </div>
      <ul className="flex gap-2 overflow-x-auto">
        {members.map((member) => (
          <MemberButton key={memberKey(member)} member={member} open={open} />
        ))}
      </ul>
    </section>
  );
}
