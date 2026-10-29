import { Button } from "@cantiara/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { useStore } from "@tanstack/react-store";
import { useCallback } from "react";
import {
  type ActiveWorkingSetMember,
  hasMember,
} from "@/features/personal-shell/lib/active-working-set";
import {
  activeWorkingSetStore,
  addToActiveWorkingSet,
  removeFromActiveWorkingSet,
} from "@/features/personal-shell/store/active-working-set";

/**
 * Record-header `More` menu entry for İş and Belge. It only changes the
 * session-only set; the source record and planning surfaces are not touched.
 * Archived records do not offer it.
 */
export default function ActiveWorkingSetControl({
  archived = false,
  member,
}: {
  archived?: boolean;
  member: ActiveWorkingSetMember;
}) {
  const members = useStore(activeWorkingSetStore, (state) => state.members);
  const held = hasMember(members, member);
  const toggle = useCallback(() => {
    if (held) {
      removeFromActiveWorkingSet(member);
    } else {
      addToActiveWorkingSet(member);
    }
  }, [held, member]);
  if (archived) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" type="button" variant="outline" />}
      >
        More
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={toggle}>
          {held
            ? "Remove from Active Working Set"
            : "Add to Active Working Set"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
