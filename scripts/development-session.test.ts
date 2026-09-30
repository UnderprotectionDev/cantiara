import { expect, test } from "vitest";
import { superviseDevelopmentProcess } from "./development-session";

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
