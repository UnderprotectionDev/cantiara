import type {
  ProjectWallDensity,
  ProjectWallHighlight,
  ProjectWallPosition,
  ProjectWallSourceType,
} from "@cantiara/api/project-wall";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import type { ProjectWallCardActions } from "./project-wall-card";
import {
  type ProjectWallActions,
  ProjectWallLayout,
} from "./project-wall-view";

const ProjectWallCanvas = lazy(() => import("./project-wall-canvas"));

export default function ProjectWallSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listOptions = orpc.projectWalls.queryOptions({ input: { projectId } });
  const walls = useQuery(listOptions);
  const selectedId = chosenId ?? walls.data?.[0]?.id ?? null;
  const wallOptions = orpc.projectWall.queryOptions({
    input: selectedId ? { projectId, wallId: selectedId } : skipToken,
  });
  const wall = useQuery(wallOptions);
  const sourceOptions = useQuery(
    orpc.projectWallSourceOptions.queryOptions({ input: { projectId } }),
  );

  const write = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      setError(null);
      try {
        return await runOnlineOnlyWrite(operation);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Project Wall change failed.",
        );
      } finally {
        await queryClient.invalidateQueries({
          queryKey: orpc.projectWalls.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.projectWall.key(),
        });
      }
    },
    [queryClient],
  );

  const wallId = wall.data?.id;
  const actions: ProjectWallActions = {
    onAddCard: (source: {
      sourceId: string;
      sourceType: ProjectWallSourceType;
    }) =>
      write(() =>
        client.addProjectWallCard({
          projectId,
          wallId: wallId ?? "",
          ...source,
        }),
      ),
    onCreate: async (title) => {
      const created = await write(() =>
        client.createProjectWall({ projectId, title }),
      );
      if (created) {
        setChosenId(created.id);
      }
    },
    onDelete: async (id) => {
      await write(() => client.deleteProjectWall({ projectId, wallId: id }));
      setChosenId(null);
    },
    onRename: (id, title) =>
      write(() => client.renameProjectWall({ projectId, title, wallId: id })),
    onSelect: setChosenId,
  };

  const cardActions = useMemo<ProjectWallCardActions>(
    () => ({
      onDensity: (cardId: string, density: ProjectWallDensity) => {
        write(() =>
          client.setProjectWallCardDensity({
            cardId,
            density,
            projectId,
            wallId: wallId ?? "",
          }),
        );
      },
      onHighlight: (cardId: string, highlight: ProjectWallHighlight | null) => {
        write(() =>
          client.setProjectWallCardHighlight({
            cardId,
            highlight,
            projectId,
            wallId: wallId ?? "",
          }),
        );
      },
      onRemove: (cardId: string) => {
        write(() =>
          client.removeProjectWallCard({
            cardId,
            projectId,
            wallId: wallId ?? "",
          }),
        );
      },
    }),
    [projectId, wallId, write],
  );

  function onMove(
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) {
    write(() =>
      client.moveProjectWallCards({
        moves,
        projectId,
        wallId: wallId ?? "",
      }),
    );
  }

  if (walls.isPending) {
    return <p role="status">Loading Project Walls…</p>;
  }
  if (!walls.data) {
    return <p role="alert">Project Walls are unavailable.</p>;
  }
  return (
    <div className="space-y-2">
      <ProjectWallLayout
        actions={actions}
        canvas={
          wall.data ? (
            <Suspense fallback={<p role="status">Loading Project Wall…</p>}>
              <ProjectWallCanvas
                actions={cardActions}
                cards={wall.data.cards}
                key={wall.data.id}
                onMove={onMove}
              />
            </Suspense>
          ) : (
            <p role="status">Loading Project Wall…</p>
          )
        }
        options={sourceOptions.data ?? []}
        selected={wall.data ?? null}
        walls={walls.data}
      />
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
