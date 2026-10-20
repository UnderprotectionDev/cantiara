// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed wall.
import type {
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

export interface ProjectWallActions {
  onAddCard: (source: {
    sourceId: string;
    sourceType: ProjectWallSourceType;
  }) => Promise<unknown>;
  onCreate: (title: string) => Promise<unknown>;
  onDelete: (wallId: string) => Promise<unknown>;
  onRename: (wallId: string, title: string) => Promise<unknown>;
  onSelect: (wallId: string) => void;
}

function optionKey(option: Pick<ProjectWallSourceOption, "id" | "sourceType">) {
  return `${option.sourceType}:${option.id}`;
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
    await onCreate(name);
    setTitle("");
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
  const available = options.filter((option) => !placed.has(optionKey(option)));
  const [selected, setSelected] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const option = available.find(
      (candidate) => optionKey(candidate) === selected,
    );
    if (!option) {
      return;
    }
    await onAddCard({ sourceId: option.id, sourceType: option.sourceType });
    setSelected("");
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

/**
 * Project Wall chrome: named flat walls of this Project, the add-card picker
 * and the canvas slot. Nothing here edits a source record.
 */
export function ProjectWallLayout({
  actions,
  canvas,
  options,
  selected,
  walls,
}: {
  actions: ProjectWallActions;
  canvas: ReactNode;
  options: ProjectWallSourceOption[];
  selected: ProjectWallView | null;
  walls: ProjectWallSummary[];
}) {
  const placed = new Set(
    (selected?.cards ?? []).map(
      (card) => `${card.sourceType}:${card.source.recordId}`,
    ),
  );
  return (
    <section aria-label="Project Wall" className="space-y-4">
      <h2 className="font-semibold text-lg">Project Wall</h2>
      <CreateWallForm onCreate={actions.onCreate} />
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
          </div>
          <AddCardForm
            key={selected.id}
            onAddCard={actions.onAddCard}
            options={options}
            placed={placed}
          />
          <p className="text-muted-foreground text-xs">
            Cards are live references. Moving a card or changing its density
            never edits the source record; edit content with Open Source Record.
          </p>
          {canvas}
        </div>
      ) : null}
    </section>
  );
}
