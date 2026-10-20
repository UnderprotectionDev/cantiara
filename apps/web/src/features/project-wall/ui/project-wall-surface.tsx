// biome-ignore-all lint/performance/noJsxPropsBind: The scene handlers close over the displayed wall and its personal view.
import type {
  ProjectWallDensity,
  ProjectWallHighlight,
  ProjectWallPosition,
  ProjectWallSourceType,
} from "@cantiara/api/project-wall";
import {
  type ProjectWallViewport,
  toggleCollapsedGroup,
} from "@cantiara/api/project-wall-viewport";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { usePersonalProjectWallView } from "../hooks/use-personal-project-wall-view";
import type { ProjectWallCardActions } from "./project-wall-card";
import { ProjectWallScene } from "./project-wall-scene";
import {
  type ProjectWallActions,
  ProjectWallLayout,
} from "./project-wall-view";

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
  const skeletons = useQuery(
    orpc.projectWallSkeletons.queryOptions({ input: { projectId } }),
  );
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

  // Personal viewport and view-local group collapse: this account, this wall.
  const personal = usePersonalProjectWallView(projectId, wallId ?? null);
  const { schedule } = personal;
  const [chosenCollapse, setChosenCollapse] = useState<{
    collapsed: string[];
    wallId: string;
  } | null>(null);
  const collapsedIds =
    chosenCollapse && chosenCollapse.wallId === wallId
      ? chosenCollapse.collapsed
      : (personal.saved?.collapsed ?? []);
  const collapsedRef = useRef(collapsedIds);
  collapsedRef.current = collapsedIds;
  const lastView = useRef<{
    center: ProjectWallViewport["center"];
    wallId: string;
    zoom: number;
  } | null>(null);
  const saveView = useCallback(
    (collapsed: string[]) => {
      const last = lastView.current;
      if (wallId && last && last.wallId === wallId) {
        schedule({ center: last.center, collapsed, zoom: last.zoom });
      }
    },
    [schedule, wallId],
  );
  const setCollapsed = useCallback(
    (collapsed: string[]) => {
      if (wallId) {
        setChosenCollapse({ collapsed, wallId });
        saveView(collapsed);
      }
    },
    [saveView, wallId],
  );
  // The wall the canvas, Outline and narrative panel show: the group collapse
  // is this account's own, never the shared group row.
  const shownWall = useMemo(
    () =>
      wall.data
        ? {
            ...wall.data,
            groups: wall.data.groups.map((group) => ({
              ...group,
              collapsed: collapsedIds.includes(group.id),
            })),
          }
        : null,
    [collapsedIds, wall.data],
  );

  const actions: ProjectWallActions = {
    onCreateFromSkeleton: async (skeleton) => {
      const created = await write(() =>
        client.createProjectWallFromSkeleton({ projectId, skeleton }),
      );
      if (created) {
        setChosenId(created.id);
      }
    },
    onCreateGroup: (title) =>
      write(() =>
        client.createProjectWallGroup({
          projectId,
          title,
          wallId: wallId ?? "",
        }),
      ),
    onCreateRelation: ({ baseRevision, kind, linkId, previewId }) =>
      write(() =>
        client.createProjectWallPersistentRelation({
          baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          kind,
          linkId,
          previewId,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onDeleteGroup: (groupId) =>
      write(() =>
        client.deleteProjectWallGroup({
          groupId,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onDrawLink: (link) =>
      write(() =>
        client.drawProjectWallLink({
          ...link,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onPreviewRelation: (request) =>
      write(() =>
        client.previewProjectWallPersistentRelation({
          ...request,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onExportSnapshot: async (scope, format) => {
      // A snapshot reads the wall; it is not a write, so nothing refetches.
      try {
        const output = await client.exportProjectWallSnapshot({
          ...scope,
          format,
          projectId,
          wallId: wallId ?? "",
        });
        return output.files;
      } catch {
        setError("Snapshot could not be created.");
      }
    },
    onPreviewSnapshot: async (scope) => {
      try {
        return await client.previewProjectWallSnapshot({
          ...scope,
          projectId,
          wallId: wallId ?? "",
        });
      } catch {
        setError("Snapshot could not be created.");
      }
    },
    onSetFocusOrder: (cardIds) =>
      write(() =>
        client.setProjectWallFocusOrder({
          cardIds,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onToggleGroup: (groupId, collapsed) => {
      // Collapse is this account's own view, not the shared group row.
      if (collapsed !== collapsedRef.current.includes(groupId)) {
        setCollapsed(toggleCollapsedGroup(collapsedRef.current, groupId));
      }
      return Promise.resolve();
    },
    onUnbindLink: (linkId) =>
      write(() =>
        client.unbindProjectWallLink({
          linkId,
          projectId,
          wallId: wallId ?? "",
        }),
      ),
    onAddCard: (source: {
      diagramViewId?: string;
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
      onGroup: (cardId: string, groupId: string | null) => {
        write(() =>
          client.setProjectWallCardGroup({
            cardId,
            groupId,
            projectId,
            wallId: wallId ?? "",
          }),
        );
      },
      onLock: (cardId: string, locked: boolean) => {
        write(() =>
          client.setProjectWallCardLock({
            cardId,
            locked,
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

  function onReorder(cardIds: string[]) {
    write(() =>
      client.reorderProjectWallCards({
        cardIds,
        projectId,
        wallId: wallId ?? "",
      }),
    );
  }

  // Creates the group, then puts the selected cards into it (wall state only).
  const groupSelection = (title: string, cardIds: string[]) =>
    write(async () => {
      const before = new Set(wall.data?.groups.map(({ id }) => id));
      const created = await client.createProjectWallGroup({
        projectId,
        title,
        wallId: wallId ?? "",
      });
      const group = created.groups.find(({ id }) => !before.has(id));
      if (!group) {
        return;
      }
      for (const cardId of cardIds) {
        // biome-ignore lint/performance/noAwaitInLoops: Each card joins the group in order.
        await client.setProjectWallCardGroup({
          cardId,
          groupId: group.id,
          projectId,
          wallId: wallId ?? "",
        });
      }
    });

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
          shownWall && personal.isReady ? (
            <ProjectWallScene
              cardActions={cardActions}
              key={shownWall.id}
              onExpandAll={() => setCollapsed([])}
              onMove={onMove}
              onReorder={onReorder}
              onToggleGroup={(groupId) =>
                setCollapsed(
                  toggleCollapsedGroup(collapsedRef.current, groupId),
                )
              }
              onViewportChange={(view) => {
                lastView.current = { ...view, wallId: shownWall.id };
                saveView(collapsedRef.current);
              }}
              onViewportReady={(view) => {
                lastView.current = { ...view, wallId: shownWall.id };
              }}
              outlineActions={{
                onDrawLink: actions.onDrawLink,
                onGroupSelection: groupSelection,
                onUnbindLink: actions.onUnbindLink,
              }}
              saved={personal.saved}
              wall={shownWall}
            />
          ) : (
            <p role="status">Loading Project Wall…</p>
          )
        }
        options={sourceOptions.data ?? []}
        selected={shownWall}
        skeletons={skeletons.data ?? []}
        walls={walls.data}
      />
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
