import { expect, test } from "vitest";
import {
  acquireLeaseWithPreparation,
  superviseDevelopmentProcess,
} from "./development-session";

test("stops the development process and closes the lease when monitoring fails", async () => {
  let closed = 0;
  let verified = 0;
  const result = await superviseDevelopmentProcess(
    ["bun", "-e", "setInterval(() => {}, 1000)"],
    {
      verify() {
        verified += 1;
        return Promise.reject(new Error("fixture connection lost"));
      },
      close() {
        closed += 1;
        return Promise.resolve();
      },
    },
    25,
  );
  expect(result).toBe(1);
  expect(verified).toBe(1);
  expect(closed).toBe(1);
});

test("preserves the development process exit code and releases the lease", async () => {
  let closed = 0;
  const result = await superviseDevelopmentProcess(
    ["bun", "-e", "process.exit(7)"],
    {
      verify() {
        return Promise.resolve();
      },
      close() {
        closed += 1;
        return Promise.resolve();
      },
    },
  );
  expect(result).toBe(7);
  expect(closed).toBe(1);
});

test("prepares databases and retries once when the first lease fails", async () => {
  let attempts = 0;
  let prepared = 0;
  const lease = await acquireLeaseWithPreparation(
    () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("pending"))
        : Promise.resolve("lease");
    },
    () => {
      prepared += 1;
      return Promise.resolve(true);
    },
  );
  expect(lease).toBe("lease");
  expect(attempts).toBe(2);
  expect(prepared).toBe(1);
});

test("keeps the original failure when preparation is blocked", async () => {
  let attempts = 0;
  await expect(
    acquireLeaseWithPreparation(
      () => {
        attempts += 1;
        return Promise.reject(new Error("not ready"));
      },
      () => Promise.resolve(false),
    ),
  ).rejects.toThrow("not ready");
  expect(attempts).toBe(1);
});

test("does not prepare when the first lease succeeds", async () => {
  let prepared = 0;
  const lease = await acquireLeaseWithPreparation(
    () => Promise.resolve("lease"),
    () => {
      prepared += 1;
      return Promise.resolve(true);
    },
  );
  expect(lease).toBe("lease");
  expect(prepared).toBe(0);
});
