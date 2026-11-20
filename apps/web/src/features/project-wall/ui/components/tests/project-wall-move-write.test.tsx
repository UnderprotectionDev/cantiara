// @vitest-environment happy-dom

import type { ProjectWallView } from "@cantiara/api/project-wall";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import type { ProjectWallSceneProps } from "../project-wall-scene";
import ProjectWallSurface from "../project-wall-surface";

const { move } = vi.hoisted(() => ({ move: vi.fn() }));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils/orpc")>();
  return {
    ...original,
    client: { ...original.client, moveProjectWallCards: move },
  };
});
vi.mock("../project-wall-scene", () => ({
  ProjectWallScene: ({ onMove }: Pick<ProjectWallSceneProps, "onMove">) => {
    function nudge() {
      Promise.resolve(
        onMove([{ cardId: "card-1", position: { x: 8, y: 0 } }]),
      ).catch(() => undefined);
    }
    return (
      <button onClick={nudge} type="button">
        Nudge
      </button>
    );
  },
}));

const date = "2026-11-20T09:00:00.000Z";
const input = { projectId: "project-1", wallId: "wall-1" };
const wall: ProjectWallView = {
  cards: [
    {
      density: "Preview",
      fields: [],
      groupId: null,
      highlight: null,
      id: "card-1",
      locked: false,
      placedAt: date,
      position: { x: 0, y: 0 },
      preview: null,
      sharedSource: false,
      source: {
        broken: null,
        kind: "Work",
        openPath: "/projects/project-1#work-w1",
        recordId: "w1",
        status: "In Progress",
        title: "Ship onboarding",
      },
      sourceType: "Work",
    },
  ],
  createdAt: date,
  focusOrder: [],
  groups: [],
  id: input.wallId,
  links: [],
  projectId: input.projectId,
  title: "Launch",
  updatedAt: date,
};

test("a failed card move rolls back only the owning Project Wall", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const wallKey = orpc.projectWall.queryKey({ input });
  const otherWallKey = orpc.projectWall.queryKey({
    input: { ...input, wallId: "wall-2" },
  });
  const scope = { input: { projectId: input.projectId } };
  cache.setQueryData(wallKey, wall);
  cache.setQueryData(otherWallKey, { ...wall, id: "wall-2" });
  cache.setQueryData(orpc.projectWalls.queryKey(scope), [
    {
      cardCount: wall.cards.length,
      createdAt: date,
      id: wall.id,
      projectId: wall.projectId,
      title: wall.title,
      updatedAt: date,
    },
  ]);
  cache.setQueryData(orpc.projectWallSkeletons.queryKey(scope), []);
  cache.setQueryData(orpc.projectWallSourceOptions.queryKey(scope), []);
  cache.setQueryData(orpc.projectWallViewport.queryKey({ input }), null);
  const result = Promise.withResolvers<never>();
  move.mockReturnValueOnce(result.promise);
  const refresh = vi.spyOn(cache, "invalidateQueries").mockResolvedValue();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  try {
    await act(() => {
      root.render(
        <QueryClientProvider client={cache}>
          <ProjectWallSurface projectId={input.projectId} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Nudge")
        ?.click();
      await Promise.resolve();
    });
    expect(move).toHaveBeenCalledWith({
      ...input,
      moves: [{ cardId: "card-1", position: { x: 8, y: 0 } }],
    });
    expect(
      cache.getQueryData<ProjectWallView>(wallKey)?.cards[0]?.position.x,
    ).toBe(8);
    expect(
      cache.getQueryData<ProjectWallView>(otherWallKey)?.cards[0]?.position.x,
    ).toBe(0);

    await act(async () => {
      result.reject(new Error("Connection lost"));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      cache.getQueryData<ProjectWallView>(wallKey)?.cards[0]?.position.x,
    ).toBe(0);
    expect(refresh).toHaveBeenCalledExactlyOnceWith({
      queryKey: orpc.projectWall.key({ input }),
    });
    expect(host.textContent).toContain("Connection lost");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
