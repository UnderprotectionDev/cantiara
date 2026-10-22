import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
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

  function statusEvent(result: {
    id: string;
    projectId: string;
    receiptId: string | null;
    status: string;
  }) {
    return {
      id: `status:${result.receiptId ?? `${result.id}:${now().toISOString()}`}`,
      kind: "work-status-changed",
      occurredAt: now().toISOString(),
      origin: "user",
      projectId: result.projectId,
      to: result.status,
      workId: result.id,
    };
  }

  const wrapped: T = {
    ...lifecycle,
    async create(accountId, input) {
      const created = await lifecycle.create(accountId, input);
      await emit({
        id: `created:${created.id}`,
        kind: "work-created",
        occurredAt: now().toISOString(),
        origin: "user",
        projectId: created.projectId,
        workId: created.id,
      });
      return created;
    },
  };
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
      await emit(statusEvent(result));
      return result;
    };
  }
  return wrapped;
}
