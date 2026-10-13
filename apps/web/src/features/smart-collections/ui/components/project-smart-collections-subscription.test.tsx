import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ContextRecordPreviewProvider } from "@/features/record-discovery/ui/components/context-record-preview";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";
import ProjectSmartCollectionsSurface, {
  smartCollectionSubscriptionMutationInput,
} from "./project-smart-collections-surface";

// Favorites has its own membership seam; this suite exercises subscriptions.
vi.mock("@/features/favorites/ui/components/favorite-control", () => ({
  default: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  useLinkProps: () => ({ href: "/projects/project-1#create" }),
}));

const mocks = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: ReactNode }) => children,
  useDraggable: () => ({ isDragging: false, ref: vi.fn() }),
  useDroppable: () => ({ isDropTarget: false, ref: vi.fn() }),
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: vi.fn((write: () => Promise<unknown> | unknown) =>
    write(),
  ),
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
    <ContextRecordPreviewProvider>
      <ProjectSmartCollectionsSurface projectId="project-1" />
    </ContextRecordPreviewProvider>,
  );
}

function inputWithId(markup: string, id: string) {
  return markup.match(new RegExp(`<input\\b(?=[^>]*\\bid="${id}")[^>]*>`))?.[0];
}

function subscriptionMutationConfig():
  | {
      mutationFn: (input: {
        notifyOnLeave: boolean;
        subscribe: boolean;
      }) => Promise<unknown>;
    }
  | undefined {
  const configs = mocks.useMutation.mock.calls.map(
    (call) =>
      call[0] as {
        mutationFn: (input: {
          notifyOnLeave: boolean;
          subscribe: boolean;
        }) => Promise<unknown>;
      },
  );
  // The create-form mutation ignores its input; the subscription mutation takes one.
  return configs.find((config) => config.mutationFn.length === 1);
}

describe("Smart Collection subscription controls", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockReturnValue({
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
  });

  test("shows the neutral prepared long-status collection without subscription or creation controls", () => {
    const markup = renderSurface({
      ...baseView,
      collectionName: "Long in the same status",
      preparedReason: "Long in the same status",
    });
    expect(markup).toContain("Long in the same status");
    expect(markup).not.toContain("Subscribe");
    expect(markup).not.toContain("Notify on leave");
    expect(markup).not.toContain("New work");
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

  test("computes the subscribe input from the current leave preference", () => {
    expect(
      smartCollectionSubscriptionMutationInput(baseView, {
        checked: true,
        kind: "subscribe",
      }),
    ).toEqual({ notifyOnLeave: false, subscribe: true });
    expect(
      smartCollectionSubscriptionMutationInput(
        { ...baseView, notifyOnLeave: true },
        { checked: true, kind: "subscribe" },
      ),
    ).toEqual({ notifyOnLeave: true, subscribe: true });
  });

  test("drops the leave preference when subscribing off", () => {
    expect(
      smartCollectionSubscriptionMutationInput(
        { notifyOnLeave: true },
        { checked: false, kind: "subscribe" },
      ),
    ).toEqual({ notifyOnLeave: false, subscribe: false });
  });

  test("keeps Subscribe on while toggling the leave preference", () => {
    expect(
      smartCollectionSubscriptionMutationInput(baseView, {
        checked: true,
        kind: "notifyOnLeave",
      }),
    ).toEqual({ notifyOnLeave: true, subscribe: true });
    expect(
      smartCollectionSubscriptionMutationInput(baseView, {
        checked: false,
        kind: "notifyOnLeave",
      }),
    ).toEqual({ notifyOnLeave: false, subscribe: true });
  });

  test("routes subscription updates through the online-only write with the view id", async () => {
    renderSurface(baseView);
    const config = subscriptionMutationConfig();
    if (!config) {
      throw new Error("Expected the subscription mutation to be configured.");
    }

    await config.mutationFn({ notifyOnLeave: true, subscribe: true });

    expect(runOnlineOnlyWrite).toHaveBeenCalledWith(expect.any(Function));
    expect(client.setSmartCollectionSubscription).toHaveBeenCalledWith({
      notifyOnLeave: true,
      subscribe: true,
      viewId: "view-1",
    });
  });

  test("explains a failed subscription update with the registered message", () => {
    mocks.useMutation.mockReturnValue({
      isError: true,
      isPending: false,
      mutate: vi.fn(),
    });
    const markup = renderSurface(baseView);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(
      "Smart Collection subscription could not be updated.",
    );
  });
});
