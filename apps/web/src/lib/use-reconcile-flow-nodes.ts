import { type Node, useNodesState } from "@xyflow/react";
import { useEffect, useRef } from "react";

/** Merge model changes with the interaction state kept by React Flow. */
export function useReconcileFlowNodes<T extends Node>(model: T[]) {
  const [nodes, setNodes, onNodesChange] = useNodesState(model);
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
  return { nodes, onNodesChange };
}
