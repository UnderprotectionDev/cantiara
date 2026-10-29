import { createStore } from "@tanstack/react-store";
import {
  type ActiveWorkingSetMember,
  addMember,
  removeMember,
} from "../lib/active-working-set";

export interface ActiveWorkingSetState {
  collapsed: boolean;
  members: ActiveWorkingSetMember[];
}

const initialState = (): ActiveWorkingSetState => ({
  collapsed: false,
  members: [],
});

/**
 * Memory only: no storage, no server write. The set lives as long as the open
 * app session and is empty again in the next one.
 */
export const activeWorkingSetStore = createStore<ActiveWorkingSetState>(
  initialState(),
);

export function addToActiveWorkingSet(member: ActiveWorkingSetMember) {
  activeWorkingSetStore.setState((state) => ({
    collapsed: false,
    members: addMember(state.members, member),
  }));
}

export function removeFromActiveWorkingSet(
  member: Pick<ActiveWorkingSetMember, "id" | "kind">,
) {
  activeWorkingSetStore.setState((state) => ({
    ...state,
    members: removeMember(state.members, member),
  }));
}

export function setActiveWorkingSetCollapsed(collapsed: boolean) {
  activeWorkingSetStore.setState((state) => ({ ...state, collapsed }));
}

/** The session ended: the set is dropped, never persisted. */
export function endActiveWorkingSetSession() {
  activeWorkingSetStore.setState(() => initialState());
}
