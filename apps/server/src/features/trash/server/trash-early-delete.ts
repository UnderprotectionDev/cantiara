import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import type { TrashEarlyDeleteAccess } from "@cantiara/api/trash-early-delete";
import {
  type PermanentlyDeletedResult,
  TrashDeleteBlockedError,
  TrashGrantRejectedError,
  TrashTypedNameMismatchError,
} from "@cantiara/api/trash-early-delete";

import type { StoredTrashEntry, TrashStore } from "./trash";
import {
  eraseAndRecord,
  type TrashEventLog,
  type TrashExpiryStore,
  trashPermanentDeleteEvent,
} from "./trash-expiry";

/**
 * Early permanent delete (spec 77) over the same mechanics as duration-end
 * delete: the expiry store erases content, entries and relations and writes
 * the audit record, and the event log gets the irreversible security event.
 * What is new is the gate, in a fixed order so a refusal never writes:
 * ownership, replay, blockers, typed Project name, then the Account Access
 * grant is consumed exactly once, then the erase.
 *
 * Every refusal that can be known up front (existence, revision, blockers,
 * typed name) runs before the grant is consumed. What remains after the
 * consume is the erase itself: the grant lives in Account Access, a different
 * store from the erase transaction, so it cannot join that transaction. If
 * the erase then finds the unit restored meanwhile, or fails, the one-time
 * grant is spent and the founder confirms again; nothing is erased and no
 * security event is written in that case. The answer of an applied key is
 * kept in memory only, so a retry after a restart is refused without
 * consuming a grant (fail closed); a durable receipt would need its own table
 * and is not part of this slice.
 */

interface Receipt {
  fingerprint: string;
  result: PermanentlyDeletedResult;
}

export interface TrashEarlyDeleteOptions {
  events: TrashEventLog;
  expiry: TrashExpiryStore;
  now?: () => Date;
  /** The Project's current name, or `null` when it is not the account's. */
  projectName: (accountId: string, projectId: string) => Promise<string | null>;
  store: TrashStore;
}

/** Secret-free aliased actor, the same shape Link Sharing writes. */
async function actorAlias(accountId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accountId),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `account:${hex.slice(0, 16)}`;
}

function staleRevision(recordId: string, currentRevision: number) {
  const value: MutationPayload = {};
  return new MutationStaleBaseRevisionError({
    id: recordId,
    revision: currentRevision,
    value,
  });
}

export function createTrashEarlyDelete(
  options: TrashEarlyDeleteOptions,
): TrashEarlyDeleteAccess {
  const { events, expiry, projectName, store } = options;
  const now = options.now ?? (() => new Date());
  // A delete removes the entry, so the answer of an applied key is kept here
  // for the retry that follows a lost response. A retry after a restart finds
  // no entry and is refused without consuming a grant (fail closed).
  const receipts = new Map<string, Receipt>();

  async function unitOf(projectId: string, entryId: string) {
    const entry = await store.find(projectId, entryId);
    if (!entry) {
      return null;
    }
    const unit: StoredTrashEntry[] = entry.groupId
      ? await store.group(projectId, entry.groupId)
      : [entry];
    return { entry, unit };
  }

  /** Every member is still in Trash at its expected revision; `false` when one is gone. */
  async function assertCurrent(
    entry: StoredTrashEntry,
    unit: readonly StoredTrashEntry[],
    baseRevision: number,
  ) {
    const facts = await Promise.all(
      unit.map((member) =>
        store.record(member.projectId, member.recordKind, member.recordId),
      ),
    );
    for (const [index, fact] of facts.entries()) {
      const member = unit[index];
      if (!(fact && member)) {
        return false;
      }
      const expected =
        member.id === entry.id ? baseRevision : member.baseRevision + 1;
      if (fact.revision !== expected) {
        throw staleRevision(member.recordId, fact.revision);
      }
    }
    return true;
  }

  return {
    async preview(accountId, input) {
      const name = await projectName(accountId, input.projectId);
      if (name === null) {
        return null;
      }
      const found = await unitOf(input.projectId, input.entryId);
      if (!found) {
        return null;
      }
      return {
        blockers: await expiry.blockers(found.unit),
        entryId: found.entry.id,
        groupId: found.entry.groupId,
        keepApprovedSurface: {
          available: false,
          reason:
            "Keep approved surface is not offered for Permanently Delete.",
        },
        members: found.unit.map((member) => ({
          entryId: member.id,
          recordId: member.recordId,
          recordKind: member.recordKind,
          recordLabel: member.recordLabel,
          revision: member.baseRevision + 1,
        })),
        typedNameTarget: { kind: "Project", name },
      };
    },

    async permanentlyDelete(accountId, input, consumeGrant) {
      const name = await projectName(accountId, input.projectId);
      if (name === null) {
        return null;
      }
      const fingerprint = await fingerprintMutationPayload({
        baseRevision: input.baseRevision,
        entryId: input.entryId,
        projectId: input.projectId,
      });
      const receiptKey = `${accountId}:${input.entryId}:${input.clientIdempotencyKey}`;
      const earlier = receipts.get(receiptKey);
      if (earlier) {
        if (earlier.fingerprint !== fingerprint) {
          throw new MutationConflictError(input.entryId);
        }
        return earlier.result;
      }

      const found = await unitOf(input.projectId, input.entryId);
      if (!found) {
        return null;
      }
      const { entry, unit } = found;

      if (!(await assertCurrent(entry, unit, input.baseRevision))) {
        return null;
      }

      const blockers = await expiry.blockers(unit);
      if (blockers.length > 0) {
        throw new TrashDeleteBlockedError(blockers);
      }
      // Typing the name is its own step and is checked before the grant, so a
      // typo never burns the one-time proof.
      if (input.typedName !== name) {
        throw new TrashTypedNameMismatchError();
      }
      if (!(await consumeGrant(input.grant))) {
        throw new TrashGrantRejectedError();
      }

      const at = now();
      const actor = await actorAlias(accountId);
      const unitEvents = unit.map((member) =>
        trashPermanentDeleteEvent(member, actor, at),
      );
      const erased = await eraseAndRecord(expiry, events, unit, unitEvents);
      if (!erased) {
        return null;
      }

      const result: PermanentlyDeletedResult = {
        deletedAt: at.toISOString(),
        entryId: entry.id,
        groupId: entry.groupId,
        projectId: entry.projectId,
        records: unit.map(({ recordId, recordKind }) => ({
          recordId,
          recordKind,
        })),
      };
      receipts.set(receiptKey, { fingerprint, result });
      return result;
    },
  };
}
