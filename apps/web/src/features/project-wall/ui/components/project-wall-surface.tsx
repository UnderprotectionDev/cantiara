// biome-ignore-all lint/performance/noJsxPropsBind: The scene handlers close over the displayed wall and its personal view.
import type {
  ProjectWallDensity,
  ProjectWallHighlight,
  ProjectWallPosition,
  ProjectWallRelationPreview,
  ProjectWallSourceType,
} from "@cantiara/api/project-wall";
import {
  type ProjectWallViewport,
  toggleCollapsedGroup,
} from "@cantiara/api/project-wall-viewport";
import {
  skipToken,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { usePersonalProjectWallView } from "../../hooks/use-personal-project-wall-view";
import { AddCardForm } from "../forms/place-project-wall-card-form";
import {
  type ProjectWallActions,
  ProjectWallLayout,
} from "../views/project-wall-view";
import type { ProjectWallCardActions } from "./project-wall-card";
import {
  ProjectWallScene,
  type ProjectWallSceneWall,
} from "./project-wall-scene";

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

  /**
   * Runs one wall write and refreshes the wall queries. The result tells the
   * caller whether the write persisted: `ok: true` with the seam's return
   * value, or `ok: false` with the reason surfaced as the page error.
   */
  const write = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      setError(null);
      try {
        const result = await runOnlineOnlyWrite(operation);
        return { ok: true as const, result };
      } catch (cause) {
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Project Wall change failed.",
        );
        return { ok: false as const };
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
  // is this account's own, never the stored group row.
  const shownWall: ProjectWallSceneWall | null = useMemo(
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
      const attempt = await write(() =>
        client.createProjectWallFromSkeleton({ projectId, skeleton }),
      );
      if (attempt.ok) {
        setChosenId(attempt.result.id);
        return true;
      }
      return false;
    },
    onCreateGroup: (title) =>
      write(() =>
        client.createProjectWallGroup({
          projectId,
          title,
          wallId: wallId ?? "",
        }),
      ).then((attempt) => attempt.ok),
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
      ).then((attempt) => attempt.ok),
    onDeleteGroup: (groupId) =>
      write(() =>
        client.deleteProjectWallGroup({
          groupId,
          projectId,
          wallId: wallId ?? "",
        }),
      ).then((attempt) => attempt.ok),
    onDrawLink: (link) =>
      write(() =>
        client.drawProjectWallLink({
          ...link,
          projectId,
          wallId: wallId ?? "",
        }),
      ).then((attempt) => attempt.ok),
    onPreviewRelation: (request) =>
      write(() =>
        client.previewProjectWallPersistentRelation({
          ...request,
          projectId,
          wallId: wallId ?? "",
        }),
      ).then((attempt) =>
        attempt.ok ? (attempt.result as ProjectWallRelationPreview) : undefined,
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
      } catch (cause) {
        // The refusal reason (an oversized scope) is the user's action item.
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Snapshot could not be created.",
        );
      }
    },
    onPreviewSnapshot: async (scope) => {
      try {
        return await client.previewProjectWallSnapshot({
          ...scope,
          projectId,
          wallId: wallId ?? "",
        });
      } catch (cause) {
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Snapshot could not be created.",
        );
      }
    },
    onSetFocusOrder: (cardIds) =>
      write(() =>
        client.setProjectWallFocusOrder({
          cardIds,
          projectId,
          wallId: wallId ?? "",
        }),
      ).then((attempt) => attempt.ok),
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
      ).then((attempt) => attempt.ok),
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
      ).then((attempt) => attempt.ok),
    onCreate: async (title) => {
      const attempt = await write(() =>
        client.createProjectWall({ projectId, title }),
      );
      if (attempt.ok) {
        setChosenId(attempt.result.id);
        return true;
      }
      return false;
    },
    onDelete: async (id) => {
      const attempt = await write(() =>
        client.deleteProjectWall({ projectId, wallId: id }),
      );
      if (attempt.ok) {
        setChosenId(null);
      }
      return attempt.ok;
    },
    onRename: (id, title) =>
      write(() =>
        client.renameProjectWall({ projectId, title, wallId: id }),
      ).then((attempt) => attempt.ok),
    onSelect: setChosenId,
  };

  const diagramIds = useMemo(
    () => [
      ...new Set(
        (wall.data?.cards ?? [])
          .filter((card) => card.sourceType === "Technical Diagram")
          .map((card) => card.source.recordId),
      ),
    ],
    [wall.data],
  );
  const diagramVersions = useQueries({
    queries: diagramIds.map((diagramId) =>
      orpc.technicalDiagramVersions.queryOptions({ input: { diagramId } }),
    ),
    combine: (results) =>
      Object.fromEntries(
        results.map((result, index) => [
          diagramIds[index] ?? "",
          (result.data ?? []).map(({ id, name, number }) => ({
            id,
            name,
            number,
          })),
        ]),
      ),
  });

  const cardActions = useMemo<ProjectWallCardActions>(
    () => ({
      diagramVersions,
      onDiagramPin: (cardId: string, diagramVersionId: string | null) => {
        write(() =>
          client.setProjectWallCardDiagramPin({
            cardId,
            diagramVersionId,
            projectId,
            wallId: wallId ?? "",
          }),
        );
      },
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
    [diagramVersions, projectId, wallId, write],
  );

  async function onMove(
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) {
    // The canvas reverts its optimistic overlay when this resolves false.
    return (
      await write(() =>
        client.moveProjectWallCards({
          moves,
          projectId,
          wallId: wallId ?? "",
        }),
      )
    ).ok;
  }

  async function onReorder(cardIds: string[]) {
    await write(() =>
      client.reorderProjectWallCards({
        cardIds,
        projectId,
        wallId: wallId ?? "",
      }),
    ).then((attempt) => attempt.ok);
  }

  // Creates the group, then puts the selected cards into it (wall state only).
  // A card that fails to join is reported, and a retry converges.
  const groupSelection = (title: string, cardIds: string[]) =>
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Every card joins in its own call so one failure cannot cancel the rest; the summary reports how much joined.
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
      let missed = 0;
      let reason = "";
      for (const cardId of cardIds) {
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Each card joins the group in order.
          await client.setProjectWallCardGroup({
            cardId,
            groupId: group.id,
            projectId,
            wallId: wallId ?? "",
          });
        } catch (cause) {
          if (missed === 0) {
            reason =
              cause instanceof Error && cause.message
                ? cause.message
                : "Project Wall change failed.";
          }
          missed += 1;
        }
      }
      if (missed > 0) {
        setError(
          reason ||
            `${cardIds.length - missed} of ${cardIds.length} cards joined the group; retrying adds the rest.`,
        );
      }
    }).then((attempt) => attempt.ok);

  if (walls.isPending) {
    return <p role="status">Loading Project Walls…</p>;
  }
  if (!walls.data) {
    return <p role="alert">Project Walls are unavailable.</p>;
  }
  const placedIds = new Set(
    (shownWall?.cards ?? []).map(
      (card) => `${card.sourceType}:${card.source.recordId}`,
    ),
  );
  return (
    <div className="space-y-2">
      <ProjectWallLayout
        actions={actions}
        canvas={(focusedWall) =>
          personal.isReady ? (
            <ProjectWallScene
              // The Outline carries the same `Place live card` picker, so a
              // keyboard-only founder creates cards without a pointer.
              addControls={
                <AddCardForm
                  onAddCard={actions.onAddCard}
                  options={sourceOptions.data ?? []}
                  placed={placedIds}
                />
              }
              cardActions={cardActions}
              key={focusedWall.id}
              onExpandAll={() => setCollapsed([])}
              onMove={onMove}
              onReorder={onReorder}
              onToggleGroup={(groupId) =>
                setCollapsed(
                  toggleCollapsedGroup(collapsedRef.current, groupId),
                )
              }
              onViewportChange={(view) => {
                lastView.current = { ...view, wallId: focusedWall.id };
                saveView(collapsedRef.current);
              }}
              onViewportReady={(view) => {
                lastView.current = { ...view, wallId: focusedWall.id };
              }}
              outlineActions={{
                onDrawLink: actions.onDrawLink,
                onGroupSelection: groupSelection,
                onUnbindLink: actions.onUnbindLink,
              }}
              saved={personal.saved}
              wall={focusedWall}
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
      {personal.saveError ? <p role="status">{personal.saveError}</p> : null}
    </div>
  );
}
