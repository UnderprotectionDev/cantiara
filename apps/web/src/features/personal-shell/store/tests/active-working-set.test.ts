// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import type { ActiveWorkingSetMember } from "../../lib/active-working-set";
import {
  activeWorkingSetStore,
  addToActiveWorkingSet,
  endActiveWorkingSetSession,
  removeFromActiveWorkingSet,
  setActiveWorkingSetCollapsed,
} from "../active-working-set";

const work: ActiveWorkingSetMember = {
  id: "w1",
  kind: "Work",
  label: "CAN-1 Ship it",
  projectId: "p1",
};
const document: ActiveWorkingSetMember = {
  id: "d1",
  kind: "Document",
  label: "Notes",
  projectId: null,
};

afterEach(() => {
  endActiveWorkingSetSession();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Active Working Set", () => {
  test("keeps Work and Document in insertion order without duplicates", () => {
    addToActiveWorkingSet(work);
    addToActiveWorkingSet(document);
    addToActiveWorkingSet(work);
    expect(activeWorkingSetStore.state.members.map((m) => m.id)).toEqual([
      "w1",
      "d1",
    ]);
  });

  test("removing a member leaves the others", () => {
    addToActiveWorkingSet(work);
    addToActiveWorkingSet(document);
    removeFromActiveWorkingSet(work);
    expect(activeWorkingSetStore.state.members).toEqual([document]);
  });

  test("collapse keeps members and adding reopens the tray", () => {
    addToActiveWorkingSet(work);
    setActiveWorkingSetCollapsed(true);
    expect(activeWorkingSetStore.state.members).toEqual([work]);
    addToActiveWorkingSet(document);
    expect(activeWorkingSetStore.state.collapsed).toBe(false);
  });

  test("session end drops the set and nothing was written to browser storage", () => {
    addToActiveWorkingSet(work);
    expect(localStorage.length + sessionStorage.length).toBe(0);
    endActiveWorkingSetSession();
    expect(activeWorkingSetStore.state).toEqual({
      collapsed: false,
      members: [],
    });
  });
});
