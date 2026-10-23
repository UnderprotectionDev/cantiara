import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { log } from "evlog";

import type { WorkAutomation } from "./work-automation";

type StatusCommand = "close" | "reopen" | "updateStatus";

/**
 * Emits the original user events Work Automation reacts to. A rule's own write
 * never reaches this decorator, so there is no cascade; an automation failure
 * becomes an `automation-failed` signal and never fails the user's command.
 */
export function withWorkAutomationEvents<T extends WorkLifecycleAccess>(
  lifecycle: T,
  automation: Pick<WorkAutomation, "handleEvent">,
  now: () => Date = () => new Date(),
): T {
  async function emit(event: unknown) {
    try {
      await automation.handleEvent(event);
    } catch (error) {
      log.error({
        action: "work-automation.handle-event",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Without a receipt the command changed nothing, so there is no original event.
  function statusEvent(result: {
    id: string;
    projectId: string;
    receiptId: string | null;
    status: string;
  }) {
    return {
      id: `status:${result.receiptId}`,
      kind: "work-status-changed",
      occurredAt: now().toISOString(),
      origin: "user",
      projectId: result.projectId,
      to: result.status,
      workId: result.id,
    };
  }

  async function createdEvent(profile: WorkProfile) {
    await emit({
      id: `created:${profile.id}`,
      kind: "work-created",
      occurredAt: now().toISOString(),
      origin: "user",
      projectId: profile.projectId,
      workId: profile.id,
    });
  }

  const wrapped: T = {
    ...lifecycle,
    async create(accountId, input) {
      const created = await lifecycle.create(accountId, input);
      await createdEvent(created);
      return created;
    },
    // A status move through the fields editor is an original status change.
    async updateFields(accountId, input) {
      const before = await lifecycle.find(accountId, input.workId);
      const updated = await lifecycle.updateFields(accountId, input);
      if (before && updated.status !== before.status) {
        await emit({
          id: `status-fields:${input.clientIdempotencyKey}`,
          kind: "work-status-changed",
          occurredAt: now().toISOString(),
          origin: "user",
          projectId: updated.projectId,
          to: updated.status,
          workId: updated.id,
        });
      }
      return updated;
    },
    async recreate(accountId, input) {
      const created = await lifecycle.recreate(accountId, input);
      await createdEvent(created);
      return created;
    },
    async convertChecklistItem(accountId, input) {
      const result = await lifecycle.convertChecklistItem(accountId, input);
      await createdEvent(result.work);
      return result;
    },
  };
  const batchCreate = lifecycle.createDocumentWorkBatch;
  if (batchCreate) {
    (wrapped as Record<string, unknown>).createDocumentWorkBatch = async (
      accountId: string,
      input: Parameters<typeof batchCreate>[1],
    ) => {
      const created = await batchCreate.call(lifecycle, accountId, input);
      for (const profile of created) {
        // biome-ignore lint/performance/noAwaitInLoops: one independent event per created Work, in order.
        await createdEvent(profile);
      }
      return created;
    };
  }
  for (const command of [
    "close",
    "reopen",
    "updateStatus",
  ] as StatusCommand[]) {
    const original = lifecycle[command] as (...args: unknown[]) => Promise<{
      id: string;
      projectId: string;
      receiptId: string | null;
      status: string;
    }>;
    (wrapped as Record<string, unknown>)[command] = async (
      ...args: unknown[]
    ) => {
      const result = await original.apply(lifecycle, args);
      if (result.receiptId) {
        await emit(statusEvent(result));
      }
      return result;
    };
  }
  return wrapped;
}
