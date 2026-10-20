// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed wall.
import type {
  ProjectWallSkeleton,
  ProjectWallSourceOption,
  ProjectWallSourceType,
  ProjectWallSummary,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, type ReactNode, useState } from "react";

import { focusProjectWallGroup } from "../lib/project-wall-group-focus";
import {
  type ProjectWallNarrativeActions,
  ProjectWallNarrativePanel,
} from "./project-wall-narrative";
import {
  ProjectWallFocusOrderEditor,
  type ProjectWallPresentationActions,
  ProjectWallPresentationView,
  ProjectWallSnapshotPanel,
} from "./project-wall-presentation";
import type { ProjectWallSceneWall } from "./project-wall-scene";

export interface ProjectWallActions
  extends ProjectWallNarrativeActions,
    ProjectWallPresentationActions {
  onAddCard: (source: {
    diagramViewId?: string;
    sourceId: string;
    sourceType: ProjectWallSourceType;
  }) => Promise<boolean>;
  onCreate: (title: string) => Promise<boolean>;
  onCreateFromSkeleton: (skeleton: ProjectWallSkeleton) => Promise<boolean>;
  onDelete: (wallId: string) => Promise<boolean>;
  onRename: (wallId: string, title: string) => Promise<boolean>;
  onSelect: (wallId: string) => void;
}

function optionKey(
  option: Pick<ProjectWallSourceOption, "diagramViewId" | "id" | "sourceType">,
) {
  return `${option.sourceType}:${option.id}${option.diagramViewId ? `:${option.diagramViewId}` : ""}`;
}

function CreateWallForm({
  onCreate,
}: {
  onCreate: ProjectWallActions["onCreate"];
}) {
  const [title, setTitle] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      return;
    }
    if (await onCreate(name)) {
      // Only a persisted wall clears the draft; a failed write keeps it.
      setTitle("");
    }
  }
  return (
    <form
      aria-label="Create Project Wall"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-title">Project Wall name</Label>
        <Input
          id="project-wall-title"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
      </div>
      <Button type="submit">Create Project Wall</Button>
    </form>
  );
}

function RenameWallForm({
  onRename,
  wall,
}: {
  onRename: ProjectWallActions["onRename"];
  wall: ProjectWallView;
}) {
  const [title, setTitle] = useState(wall.title);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (name && name !== wall.title) {
      // A rename remounts this form with the saved title once it persists.
      await onRename(wall.id, name);
    }
  }
  return (
    <form
      aria-label="Rename Project Wall"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-rename">Rename</Label>
        <Input
          id="project-wall-rename"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
      </div>
      <Button type="submit" variant="outline">
        Rename
      </Button>
    </form>
  );
}

/** Picks an existing master record; the wall stores only its id and type. */
export function AddCardForm({
  onAddCard,
  options,
  placed,
}: {
  onAddCard: ProjectWallActions["onAddCard"];
  options: ProjectWallSourceOption[];
  /** Records already on this wall: one live card per record per wall. */
  placed: ReadonlySet<string>;
}) {
  // One live card per record per wall, whichever Diagram View it selects.
  const available = options.filter(
    (option) => !placed.has(`${option.sourceType}:${option.id}`),
  );
  const [selected, setSelected] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const option = available.find(
      (candidate) => optionKey(candidate) === selected,
    );
    if (!option) {
      return;
    }
    if (
      await onAddCard({
        ...(option.diagramViewId
          ? { diagramViewId: option.diagramViewId }
          : {}),
        sourceId: option.id,
        sourceType: option.sourceType,
      })
    ) {
      // Only a persisted card drops the selection; a failed write keeps it.
      setSelected("");
    }
  }
  return (
    <form
      aria-label="Place live card"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="project-wall-source">Source record</Label>
        <NativeSelect
          id="project-wall-source"
          onChange={(event) => setSelected(event.target.value)}
          value={selected}
        >
          <NativeSelectOption value="">Select a record</NativeSelectOption>
          {available.map((option) => (
            <NativeSelectOption
              key={optionKey(option)}
              value={optionKey(option)}
            >
              {option.sourceType} · {option.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button disabled={!selected} type="submit">
        Place live card
      </Button>
    </form>
  );
}

function renderCanvas(
  canvas: ReactNode | ((shown: ProjectWallSceneWall) => ReactNode),
  shown: ProjectWallSceneWall,
) {
  return typeof canvas === "function" ? canvas(shown) : canvas;
}

/** View-local in-wall navigation: open a named group, then return safely. */
function ProjectWallGroupNav({
  onOpen,
  onShowFullWall,
  openGroupId,
  wall,
}: {
  onOpen: (groupId: string) => void;
  onShowFullWall: () => void;
  openGroupId: string | null;
  wall: ProjectWallView;
}) {
  if (wall.groups.length === 0 && !openGroupId) {
    return null;
  }
  return (
    <nav aria-label="Open group" className="flex flex-wrap gap-2">
      {wall.groups.map((group) => (
        <Button
          aria-pressed={openGroupId === group.id}
          key={group.id}
          onClick={() => onOpen(group.id)}
          type="button"
          variant="outline"
        >
          Open group: {group.title}
        </Button>
      ))}
      {openGroupId ? (
        <Button onClick={onShowFullWall} type="button" variant="outline">
          Show full wall
        </Button>
      ) : null}
    </nav>
  );
}

/**
 * Project Wall chrome: named flat walls of this Project, the add-card picker
 * and the canvas slot. Nothing here edits a source record.
 */
export function ProjectWallLayout({
  actions,
  canvas,
  options,
  selected,
  skeletons = [],
  walls,
}: {
  actions: ProjectWallActions;
  /** The canvas; a function receives the wall shown after group focus. */
  canvas: ReactNode | ((shown: ProjectWallSceneWall) => ReactNode);
  options: ProjectWallSourceOption[];
  selected: ProjectWallSceneWall | null;
  /** Skeletons the Project shell selected; none means no offer. */
  skeletons?: ProjectWallSkeleton[];
  walls: ProjectWallSummary[];
}) {
  const placed = new Set(
    (selected?.cards ?? []).map(
      (card) => `${card.sourceType}:${card.source.recordId}`,
    ),
  );
  const [presenting, setPresenting] = useState(false);
  // In-wall navigation is view-local state: nothing here is saved.
  const [opened, setOpened] = useState<{
    groupId: string;
    wallId: string;
  } | null>(null);
  const openGroupId =
    selected && opened?.wallId === selected.id ? opened.groupId : null;
  const focused =
    selected && openGroupId
      ? focusProjectWallGroup(selected, openGroupId)
      : selected;
  if (selected && presenting) {
    // Presentation Mode hides every editing tool; exit returns to this view.
    return (
      <ProjectWallPresentationView
        onExit={() => setPresenting(false)}
        wall={selected}
      />
    );
  }
  return (
    <section aria-label="Project Wall" className="space-y-4">
      <h2 className="font-semibold text-lg">Project Wall</h2>
      <CreateWallForm onCreate={actions.onCreate} />
      {skeletons.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skeletons.map((skeleton) => (
            <Button
              key={skeleton}
              onClick={() => actions.onCreateFromSkeleton(skeleton)}
              type="button"
              variant="outline"
            >
              Create from {skeleton}
            </Button>
          ))}
        </div>
      ) : null}
      {walls.length === 0 ? (
        <p>No Project Wall yet.</p>
      ) : (
        <ul aria-label="Project Walls" className="flex flex-wrap gap-2">
          {walls.map((wall) => (
            <li key={wall.id}>
              <Button
                aria-pressed={selected?.id === wall.id}
                onClick={() => actions.onSelect(wall.id)}
                type="button"
                variant={selected?.id === wall.id ? "default" : "outline"}
              >
                {wall.title} ({wall.cardCount})
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <RenameWallForm
              key={`${selected.id}:${selected.title}`}
              onRename={actions.onRename}
              wall={selected}
            />
            <Button
              onClick={() => actions.onDelete(selected.id)}
              type="button"
              variant="outline"
            >
              Delete Project Wall
            </Button>
            <Button
              onClick={() => setPresenting(true)}
              type="button"
              variant="outline"
            >
              Presentation Mode
            </Button>
          </div>
          <AddCardForm
            key={selected.id}
            onAddCard={actions.onAddCard}
            options={options}
            placed={placed}
          />
          <ProjectWallNarrativePanel actions={actions} wall={selected} />
          <ProjectWallFocusOrderEditor actions={actions} wall={selected} />
          <ProjectWallSnapshotPanel actions={actions} wall={selected} />
          <p className="text-muted-foreground text-xs">
            Cards are live references. Moving a card or changing its density
            never edits the source record; edit content with Open Source Record.
          </p>
          <ProjectWallGroupNav
            onOpen={(groupId) => setOpened({ groupId, wallId: selected.id })}
            onShowFullWall={() => setOpened(null)}
            openGroupId={openGroupId}
            wall={selected}
          />
          {focused ? (
            renderCanvas(canvas, focused)
          ) : (
            <p role="status">This group is no longer available.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
