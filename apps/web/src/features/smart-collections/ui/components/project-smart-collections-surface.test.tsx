import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import ProjectSmartCollectionsSurface from "./project-smart-collections-surface";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isError: false, isPending: false, mutate: vi.fn() }),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: ReactNode }) => children,
  useDraggable: () => ({ isDragging: false, ref: vi.fn() }),
  useDroppable: () => ({ isDropTarget: false, ref: vi.fn() }),
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: {
    createSmartCollection: vi.fn(),
    setSmartCollectionSubscription: vi.fn(),
  },
  invalidateSmartCollectionMembership: vi.fn(() => []),
  orpc: {
    projects: { queryOptions: () => ({}) },
    smartCollectionViews: { queryOptions: () => ({}) },
  },
}));

const baseView: SmartCollectionViewSource = {
  collectionId: "collection-1",
  collectionName: "Active Work",
  conditions: {},
  documents: [],
  id: "view-1",
  isSubscribed: false,
  name: "Default",
  notifyOnLeave: false,
  presentation: "List",
  projectId: "project-1",
  projectSourceRecords: [],
  scope: { projectIds: ["project-1"] },
  sourceType: "Work",
  workspaceId: "workspace-1",
  works: [],
};

function renderSurface(view: SmartCollectionViewSource) {
  vi.mocked(useQuery)
    .mockReturnValueOnce({ data: [view], isError: false } as never)
    .mockReturnValueOnce({ data: [], isError: false } as never);
  return renderToStaticMarkup(
    <ProjectSmartCollectionsSurface projectId="project-1" />,
  );
}

function inputWithId(markup: string, id: string) {
  return markup.match(new RegExp(`<input\\b(?=[^>]*\\bid="${id}")[^>]*>`))?.[0];
}

describe("Smart Collection subscription controls", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  test("explains why Notify on leave is disabled until Subscribe is enabled", () => {
    const markup = renderSurface(baseView);
    const notifyOnLeave = inputWithId(
      markup,
      "smart-collection-notify-on-leave-view-1",
    );

    expect(markup).toContain("Subscribe");
    expect(markup).toContain("Notify on leave");
    expect(notifyOnLeave).toContain(
      'aria-describedby="smart-collection-notify-on-leave-view-1-description"',
    );
    expect(notifyOnLeave).toContain('disabled=""');
    expect(markup).toContain("Turn on Subscribe first.");
  });

  test("keeps the leave option enabled when Subscribe is on", () => {
    const markup = renderSurface({
      ...baseView,
      isSubscribed: true,
      notifyOnLeave: true,
    });
    const notifyOnLeave = inputWithId(
      markup,
      "smart-collection-notify-on-leave-view-1",
    );

    expect(notifyOnLeave).toContain('checked=""');
    expect(notifyOnLeave).not.toContain("disabled");
    expect(markup).not.toContain("Turn on Subscribe first.");
  });
});
