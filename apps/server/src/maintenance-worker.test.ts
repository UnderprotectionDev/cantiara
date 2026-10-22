import { beforeEach, describe, expect, test, vi } from "vitest";

const boss = vi.hoisted(() => ({
  on: vi.fn(),
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  createQueue: vi.fn(async () => undefined),
  work: vi.fn(async (_name: string, _handler: () => Promise<void>) => "worker"),
  schedule: vi.fn(async () => undefined),
}));

vi.mock("pg-boss", () => ({
  PgBoss: class {
    on = boss.on;
    start = boss.start;
    stop = boss.stop;
    createQueue = boss.createQueue;
    work = boss.work;
    schedule = boss.schedule;
  },
}));

import { createMaintenanceWorker } from "./maintenance-worker";

describe("maintenance worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("schedules each sweep as a durable pg-boss queue and runs it from the worker", async () => {
    const hourly = vi.fn(async () => 1);
    const quarterHourly = vi.fn(async () => 2);
    const worker = createMaintenanceWorker({
      connectionString: "postgresql://localhost/cantiara",
      sweeps: [
        { name: "hourly-sweep", cron: "0 * * * *", process: hourly },
        {
          name: "quarter-hourly-sweep",
          cron: "*/15 * * * *",
          process: quarterHourly,
        },
      ],
    });

    await worker.start();
    await worker.start();

    expect(boss.start).toHaveBeenCalledTimes(1);
    expect(boss.schedule).toHaveBeenCalledWith(
      "hourly-sweep",
      "0 * * * *",
      null,
      { missed: "once" },
    );
    expect(boss.schedule).toHaveBeenCalledWith(
      "quarter-hourly-sweep",
      "*/15 * * * *",
      null,
      { missed: "once" },
    );

    const handlers = new Map(
      boss.work.mock.calls.map(([name, handler]) => [name, handler]),
    );
    await handlers.get("hourly-sweep")?.();
    expect(hourly).toHaveBeenCalledTimes(1);
    expect(quarterHourly).not.toHaveBeenCalled();
  });

  test("allows a retry after a failed start", async () => {
    boss.start.mockRejectedValueOnce(new Error("down"));
    const worker = createMaintenanceWorker({
      connectionString: "postgresql://localhost/cantiara",
      sweeps: [{ name: "sweep", cron: "0 * * * *", process: async () => 0 }],
    });

    await expect(worker.start()).rejects.toThrow("down");
    await worker.start();

    expect(boss.start).toHaveBeenCalledTimes(2);
  });
});
