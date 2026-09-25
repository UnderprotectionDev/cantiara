import {
  buildWorkContextModel,
  type WorkContextPriorityValue,
  type WorkContextProjection,
  type WorkContextSource,
} from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";

export interface KanbanCardSummary {
  priorities: readonly WorkContextPriorityValue[];
  signals: readonly WorkContextSource[];
}

function isIncomingBlocker(source: WorkContextSource) {
  return source.relationKind === "Blocks" && source.direction === "incoming";
}

export function buildKanbanCardSummary(
  work: WorkProfile,
  context: WorkContextProjection,
): KanbanCardSummary {
  const model = buildWorkContextModel({
    priorityValues: context.priorityValues,
    relations: context.relations,
    work,
  });

  return {
    priorities: model.priorityFoundations.values.filter(
      (value) =>
        "kind" in value.source &&
        value.source.kind === "Priority criterion" &&
        value.value !== "Unevaluated",
    ),
    signals: model.sources
      .filter(
        (source) => isIncomingBlocker(source) || source.recordType === "Risk",
      )
      .map((source) =>
        isIncomingBlocker(source) ? { ...source, label: "Blocked by" } : source,
      ),
  };
}
