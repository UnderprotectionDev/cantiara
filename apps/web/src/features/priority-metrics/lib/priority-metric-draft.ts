import type {
  PriorityMetric,
  PriorityMetricRankDescriptions,
} from "@cantiara/api/priority-metrics";

export interface PriorityMetricDraft {
  name: string;
  rankDescriptions: PriorityMetricRankDescriptions;
  shortDescription: string;
}

const EMPTY_RANK_DESCRIPTIONS: PriorityMetricRankDescriptions = {
  High: "",
  Low: "",
  Medium: "",
  "Very high": "",
  "Very low": "",
};

export const EMPTY_DRAFT: PriorityMetricDraft = {
  name: "",
  rankDescriptions: EMPTY_RANK_DESCRIPTIONS,
  shortDescription: "",
};

export function draftFromMetric(metric: PriorityMetric): PriorityMetricDraft {
  return {
    name: metric.name,
    rankDescriptions: { ...metric.rankDescriptions },
    shortDescription: metric.shortDescription,
  };
}
