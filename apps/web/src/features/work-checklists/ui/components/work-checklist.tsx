// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current item state.

import type { WorkChecklistItem } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useState } from "react";

export default function WorkChecklist({
  checklist,
  disabled,
  onSave,
  workKey,
}: {
  checklist: WorkChecklistItem[];
  disabled: boolean;
  onSave: (checklist: WorkChecklistItem[]) => void;
  workKey: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(checklist.map((item) => [item.id, item.text])),
  );
  const [newItem, setNewItem] = useState("");
  const completedCount = checklist.filter((item) => item.completed).length;

  function addItem() {
    const text = newItem.trim();
    if (!text) {
      return;
    }
    onSave([...checklist, { completed: false, id: crypto.randomUUID(), text }]);
    setNewItem("");
  }

  function replaceItem(
    itemId: string,
    replace: (item: WorkChecklistItem) => WorkChecklistItem,
  ) {
    onSave(
      checklist.map((item) => (item.id === itemId ? replace(item) : item)),
    );
  }

  function moveItem(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= checklist.length) {
      return;
    }
    const reordered = [...checklist];
    const [item] = reordered.splice(index, 1);
    if (!item) {
      return;
    }
    reordered.splice(destination, 0, item);
    onSave(reordered);
  }

  return (
    <section
      aria-label={`Checklist for ${workKey}`}
      className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium text-sm">Checklist</h4>
        {checklist.length > 0 ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {completedCount} of {checklist.length} complete
          </p>
        ) : null}
      </div>
      {checklist.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add the first small step for this Work.
        </p>
      ) : (
        <ol className="space-y-2">
          {checklist.map((item, index) => {
            const draft = drafts[item.id] ?? item.text;
            return (
              <li className="flex flex-wrap items-center gap-2" key={item.id}>
                <Checkbox
                  aria-label={`Mark ${item.text} ${
                    item.completed ? "incomplete" : "complete"
                  }`}
                  checked={item.completed}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    replaceItem(item.id, (current) => ({
                      ...current,
                      completed: checked,
                    }))
                  }
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
                    disabled || !draft.trim() || draft.trim() === item.text
                  }
                  onClick={() =>
                    replaceItem(item.id, (current) => ({
                      ...current,
                      text: draft.trim(),
                    }))
                  }
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
                  disabled={disabled || index === checklist.length - 1}
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
                  onClick={() =>
                    onSave(
                      checklist.filter((candidate) => candidate.id !== item.id),
                    )
                  }
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
        onSubmit={(event) => {
          event.preventDefault();
          addItem();
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
