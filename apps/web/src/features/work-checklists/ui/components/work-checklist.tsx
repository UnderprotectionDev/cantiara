// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current item state.

import type { WorkChecklistItem } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";
import { resolveChecklistDrafts } from "./work-checklist-items";

export default function WorkChecklist({
  checklist,
  disabled,
  onSave,
  workKey,
}: {
  checklist: WorkChecklistItem[];
  disabled: boolean;
  onSave: (checklist: WorkChecklistItem[]) => Promise<unknown>;
  workKey: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(checklist.map((item) => [item.id, item.text])),
  );
  const [newItem, setNewItem] = useState("");
  const resolvedChecklist = resolveChecklistDrafts(checklist, drafts);
  const completedCount = resolvedChecklist.filter(
    (item) => item.completed,
  ).length;

  // Every save sends the resolved list so pending text edits ride along with
  // any item action instead of being silently discarded by it. The parent owns
  // the error display; a failed save leaves local state untouched so typed
  // text is never lost.
  async function saveNext(next: WorkChecklistItem[]) {
    try {
      await onSave(next);
      return true;
    } catch {
      return false;
    }
  }

  async function addItem() {
    const text = newItem.trim();
    if (!text) {
      return;
    }
    const saved = await saveNext([
      ...resolvedChecklist,
      { completed: false, id: crypto.randomUUID(), text },
    ]);
    if (saved) {
      setNewItem("");
    }
  }

  async function toggleItem(itemId: string, completed: boolean) {
    await saveNext(
      resolvedChecklist.map((item) =>
        item.id === itemId ? { ...item, completed } : item,
      ),
    );
  }

  async function moveItem(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= resolvedChecklist.length) {
      return;
    }
    const reordered = [...resolvedChecklist];
    const [item] = reordered.splice(index, 1);
    if (!item) {
      return;
    }
    reordered.splice(destination, 0, item);
    await saveNext(reordered);
  }

  async function deleteItem(itemId: string) {
    await saveNext(resolvedChecklist.filter((item) => item.id !== itemId));
  }

  return (
    <section
      aria-label={`Checklist for ${workKey}`}
      className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium text-sm">Checklist</h4>
        {resolvedChecklist.length > 0 ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {completedCount} of {resolvedChecklist.length} complete
          </p>
        ) : null}
      </div>
      {resolvedChecklist.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add the first small step for this Work.
        </p>
      ) : (
        <ol className="space-y-2">
          {resolvedChecklist.map((item, index) => {
            const draft = drafts[item.id] ?? item.text;
            return (
              <li className="flex flex-wrap items-center gap-2" key={item.id}>
                <Checkbox
                  aria-label={`Mark ${item.text} ${
                    item.completed ? "incomplete" : "complete"
                  }`}
                  checked={item.completed}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleItem(item.id, checked)}
                />
                <Input
                  aria-label={`Item ${index + 1} for ${workKey}`}
                  className={`min-w-48 flex-1 ${
                    item.completed ? "text-muted-foreground line-through" : ""
                  }`}
                  disabled={disabled}
                  maxLength={1000}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  value={draft}
                />
                <Button
                  aria-label={`Save item ${index + 1}`}
                  disabled={
                    disabled ||
                    !draft.trim() ||
                    draft.trim() === checklist[index]?.text
                  }
                  onClick={() => saveNext(resolvedChecklist)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  Save item
                </Button>
                <Button
                  aria-label={`Move item ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => moveItem(index, -1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Move up
                </Button>
                <Button
                  aria-label={`Move item ${index + 1} down`}
                  disabled={disabled || index === resolvedChecklist.length - 1}
                  onClick={() => moveItem(index, 1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Move down
                </Button>
                <Button
                  aria-label={`Delete item ${index + 1}`}
                  disabled={disabled}
                  onClick={() => deleteItem(item.id)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Delete item
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      <form
        className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await addItem();
        }}
      >
        <label
          className="min-w-48 flex-1 text-muted-foreground text-xs"
          htmlFor={`new-checklist-item-${workKey}`}
        >
          Item
          <Input
            aria-label={`New item for ${workKey}`}
            className="mt-1"
            disabled={disabled}
            id={`new-checklist-item-${workKey}`}
            maxLength={1000}
            onChange={(event) => setNewItem(event.target.value)}
            value={newItem}
          />
        </label>
        <Button disabled={disabled || !newItem.trim()} size="sm" type="submit">
          Add item
        </Button>
      </form>
    </section>
  );
}
