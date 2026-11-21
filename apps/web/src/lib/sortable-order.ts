import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import type { UseSortableInput } from "@dnd-kit/react/sortable";

export const pointerDragSensor = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Distance({ value: 4 }),
  ],
});

// Keep the DOM in server order until Query receives the result of the write.
export const serverOrderedSortable: Pick<UseSortableInput, "plugins"> = {
  plugins: (defaults) =>
    defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
};
