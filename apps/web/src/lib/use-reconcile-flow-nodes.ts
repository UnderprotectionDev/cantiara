import type { Node } from "@xyflow/react";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";

/** Merge model changes with the interaction state kept by React Flow. */
export function useReconcileFlowNodes<T extends Node>(
  model: T[],
  setNodes: Dispatch<SetStateAction<T[]>>,
) {
  const previousModel = useRef(model);
  useEffect(() => {
    const previous = previousModel.current;
    if (previous === model) {
      return;
    }
    previousModel.current = model;
    setNodes((live) => {
      const previousById = new Map(previous.map((node) => [node.id, node]));
      const liveById = new Map(live.map((node) => [node.id, node]));
      return model.map((next) => {
        const current = liveById.get(next.id);
        const prior = previousById.get(next.id);
        if (!(current && prior)) {
          return next;
        }
        return {
          ...next,
          dragging: current.dragging,
          measured: current.measured,
          position: current.dragging ? current.position : next.position,
          selected:
            next.selected === prior.selected ? current.selected : next.selected,
        };
      });
    });
  }, [model, setNodes]);
}
