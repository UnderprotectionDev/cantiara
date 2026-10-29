import type { LinkSharingSecurityEvents } from "./link-sharing";

/**
 * Restore replay (spec 73, ADR-0003, ADR-0019). After a database restore the
 * surface rows can be older than the irreversible security event log. Replay
 * re-applies what the log knows, without any secret:
 *
 * - `link-sharing.surface-revoked` cancels the row, whatever else it says.
 * - A token or password change newer than the row's access epoch means the
 *   restored row still holds the old secret. The new secret was never logged,
 *   so the row cannot be repaired; it is cancelled (fail closed) and the
 *   founder reshares. A row whose epoch already reached the event is current
 *   and is left alone.
 * - Every event raises the row's access epoch to the logged one, so a visitor
 *   session minted before the revoke can never wake up.
 *
 * Replay never lowers an epoch, never reopens a cancelled row and is
 * idempotent, so it runs on every start.
 */
export interface LinkSharingReplayStore {
  /** Cancels an uncancelled row; with `belowEpoch`, only when its epoch is lower. */
  cancel: (surfaceId: string, at: Date, belowEpoch?: number) => Promise<void>;
  raiseEpoch: (surfaceId: string, epoch: number) => Promise<void>;
}

export function createLinkSharingReplay(
  events: Pick<LinkSharingSecurityEvents, "list">,
  store: LinkSharingReplayStore,
) {
  return {
    async replay() {
      const log = await events.list();
      // Judge every stale-secret event against the row as restored, before
      // any epoch is raised.
      await Promise.all(
        log.map((event) => {
          if (event.type === "link-sharing.surface-revoked") {
            return store.cancel(event.surfaceId, event.occurredAt);
          }
          if (
            event.type === "link-sharing.token-rotated" ||
            event.type === "link-sharing.password-changed"
          ) {
            return store.cancel(
              event.surfaceId,
              event.occurredAt,
              event.accessEpoch,
            );
          }
          return Promise.resolve();
        }),
      );
      await Promise.all(
        log.map((event) =>
          store.raiseEpoch(event.surfaceId, event.accessEpoch),
        ),
      );
    },
  };
}
