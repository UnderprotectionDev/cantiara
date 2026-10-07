import type {
  ReturnChanges,
  ReturnSource,
  ReturnToWorkAccess,
} from "@cantiara/api/return-to-work";
import { cardsForSources, sinceLastLooked } from "@cantiara/api/return-to-work";
export interface ReturnToWorkStore {
  markViewed: ReturnToWorkAccess["markViewed"];
  read: (
    accountId: string,
    context: Parameters<ReturnToWorkAccess["read"]>[1],
  ) => Promise<ReturnSource[]>;
  readChanges: (
    accountId: string,
    context: Parameters<ReturnToWorkAccess["read"]>[1],
  ) => Promise<ReturnChanges>;
  readTimeZone: (accountId: string) => Promise<string>;
  saveNextStep: ReturnToWorkAccess["saveNextStep"];
}
export function createReturnToWork(
  store: ReturnToWorkStore,
  clock = () => new Date(),
): ReturnToWorkAccess {
  return {
    async read(accountId, context) {
      const [sources, timeZone, changes] = await Promise.all([
        store.read(accountId, context),
        store.readTimeZone(accountId),
        store.readChanges(accountId, context),
      ]);
      const now = clock();
      return {
        cards: cardsForSources(sources, now, timeZone),
        sinceLastLooked: sinceLastLooked(changes, now),
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
