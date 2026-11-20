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
import {
  skipToken,
  useMutation,
  useMutationState,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { executeWrite } from "@/utils/execute-write";
import { client, orpc } from "@/utils/orpc";
import { usePersonalProjectWallView } from "../../hooks/use-personal-project-wall-view";
import { useProjectWallRelation } from "../../hooks/use-project-wall-relation";
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

  const wallId = wall.data?.id;

  /**
   * Runs one wall write and refreshes the wall queries. The result tells the
   * caller whether the write persisted: `ok: true` with the seam's return
   * value, or `ok: false` with the reason surfaced as the page error.
   */
  const write = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      retryInSurface = false,
      targetWallId = wallId,
    ) => {
      try {
        const result = await executeWrite(
          queryClient,
          { projectId, wallId: targetWallId },
          operation,
          async () => {
            const invalidations = [
              queryClient.invalidateQueries({
                queryKey: orpc.projectWalls.key({ input: { projectId } }),
              }),
            ];
            if (targetWallId) {
              invalidations.push(
                queryClient.invalidateQueries({
                  queryKey: orpc.projectWall.key({
                    input: { projectId, wallId: targetWallId },
                  }),
                }),
              );
            }
            await Promise.all(invalidations);
          },
          { retryInSurface, mutationKey: ["project-wall-write", projectId] },
        );
        return { ok: true as const, result };
      } catch {
        return { ok: false as const };
      }
    },
    [projectId, queryClient, wallId],
  );

  // Personal viewport and view-local group collapse: this account, this wall.
  const personal = usePersonalProjectWallView(projectId, wallId ?? null);
  const { schedule } = personal;
  const collapsedIds = personal.saved?.collapsed ?? [];
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

  const createRelation = useProjectWallRelation(projectId, wallId ?? "");

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
    onCreateRelation: (input) =>
      createRelation.mutateAsync(input).then(
        () => true,
        () => false,
      ),
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
      queryClient.query({
        ...orpc.previewProjectWallPersistentRelation.queryOptions({
          input: { ...request, projectId, wallId: wallId ?? "" },
        }),
        gcTime: 0,
        staleTime: 0,
      }),
    onExportSnapshot: async (scope, format) => {
      const output = await client.exportProjectWallSnapshot({
        ...scope,
        format,
        projectId,
        wallId: wallId ?? "",
      });
      return output.files;
    },
    onPreviewSnapshot: (scope) =>
      queryClient.query({
        ...orpc.previewProjectWallSnapshot.queryOptions({
          input: { ...scope, projectId, wallId: wallId ?? "" },
        }),
        gcTime: 0,
        staleTime: 0,
      }),
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
      const attempt = await write(
        () => client.deleteProjectWall({ projectId, wallId: id }),
        false,
        id,
      );
      if (attempt.ok) {
        setChosenId(null);
      }
      return attempt.ok;
    },
    onRename: (id, title) =>
      write(
        () => client.renameProjectWall({ projectId, title, wallId: id }),
        false,
        id,
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

  const move = useMutation(
    orpc.moveProjectWallCards.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      scope: { id: `project-wall-card-moves:${projectId}:${wallId}` },
      mutationFn: (input) => client.moveProjectWallCards(input),
      onMutate: async ({ moves, ...input }) => {
        const { queryKey } = orpc.projectWall.queryOptions({ input });
        await queryClient.cancelQueries({ exact: true, queryKey });
        const previous = queryClient.getQueryData<typeof wall.data>(queryKey);
        const positions = new Map(
          moves.map(({ cardId, position }) => [cardId, position]),
        );
        queryClient.setQueryData<typeof wall.data>(
          queryKey,
          (current) =>
            current && {
              ...current,
              cards: current.cards.map((card) => {
                const position = positions.get(card.id);
                return position ? { ...card, position } : card;
              }),
            },
        );
        return previous;
      },
      onError: (_, { moves, ...input }, previous) => {
        if (!previous) {
          return;
        }
        const { queryKey } = orpc.projectWall.queryOptions({ input });
        const attempted = new Map(
          moves.map(({ cardId, position }) => [cardId, position]),
        );
        const original = new Map(
          previous.cards.map(({ id, position }) => [id, position]),
        );
        queryClient.setQueryData<typeof wall.data>(
          queryKey,
          (current) =>
            current && {
              ...current,
              cards: current.cards.map((card) => {
                const before = original.get(card.id);
                const after = attempted.get(card.id);
                if (
                  before &&
                  after?.x === card.position.x &&
                  after.y === card.position.y
                ) {
                  return { ...card, position: before };
                }
                return card;
              }),
            },
        );
      },
      onSettled: (_, _failure, { projectId: owner, wallId: target }) => {
        const mutationKey = orpc.moveProjectWallCards.mutationKey();
        if (
          queryClient.isMutating({
            mutationKey,
            predicate: (entry) => {
              const input = entry.state.variables as
                | { projectId?: string; wallId?: string }
                | undefined;
              return input?.projectId === owner && input.wallId === target;
            },
          }) <= 1
        ) {
          return queryClient.invalidateQueries({
            queryKey: orpc.projectWall.key({
              input: { projectId: owner, wallId: target },
            }),
          });
        }
      },
    }),
  );
  function onMove(
    moves: Array<{ cardId: string; position: ProjectWallPosition }>,
  ) {
    if (!wallId || moves.length === 0) {
      return Promise.resolve(false);
    }
    return move.mutateAsync({ moves, projectId, wallId }).then(
      () => true,
      () => false,
    );
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
      return missed > 0
        ? reason ||
            `${cardIds.length - missed} of ${cardIds.length} cards joined the group.`
        : undefined;
    }, true).then((attempt) => attempt.ok);
  const writeResults = useMutationState({
    filters: { mutationKey: ["project-wall-write", projectId] },
    select: (mutation) => mutation.state,
  });
  const latest = [writeResults.at(-1), move, createRelation].reduce(
    (previous, attempt) =>
      attempt && (!previous || attempt.submittedAt >= previous.submittedAt)
        ? attempt
        : previous,
  );
  const failure = latest?.error;
  const warning = typeof latest?.data === "string" ? latest.data : null;
  const error =
    failure instanceof Error ? failure.message : "Project Wall change failed.";

  if (walls.status === "pending") {
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
      {failure ? <p role="alert">{error}</p> : null}
      {warning ? <p role="alert">{warning}</p> : null}
      {personal.saveError ? <p role="status">{personal.saveError}</p> : null}
    </div>
  );
}
