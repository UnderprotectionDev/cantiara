import type {
  ReturnSource,
  ReturnToWorkAccess,
} from "@cantiara/api/return-to-work";
import { cardsForSources } from "@cantiara/api/return-to-work";
export interface ReturnToWorkStore {
  markViewed: ReturnToWorkAccess["markViewed"];
  read: (
    accountId: string,
    context: Parameters<ReturnToWorkAccess["read"]>[1],
  ) => Promise<ReturnSource[]>;
  readTimeZone: (accountId: string) => Promise<string>;
  saveNextStep: ReturnToWorkAccess["saveNextStep"];
}
export function createReturnToWork(
  store: ReturnToWorkStore,
  clock = () => new Date(),
): ReturnToWorkAccess {
  return {
    async read(accountId, context) {
      const [sources, timeZone] = await Promise.all([
        store.read(accountId, context),
        store.readTimeZone(accountId),
      ]);
      return {
        cards: cardsForSources(sources, clock(), timeZone),
        source:
          sources.find(
            (source) =>
              source.id === (context.workId ?? context.projectId) &&
              source.recordType === (context.workId ? "Work" : "Project"),
          ) ?? null,
      };
    },
    saveNextStep: store.saveNextStep,
    markViewed: store.markViewed,
  };
}
