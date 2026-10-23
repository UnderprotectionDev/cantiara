import { describe, expect, test, vi } from "vitest";

import { createDb } from "./index";
import { createSecurityEventDb } from "./security-events";

const url = "postgresql://user:secret@localhost:5432/cantiara";

describe("idle pooled client errors", () => {
  test.each([
    ["primary", () => createDb({ DATABASE_URL: url })],
    ["security-event", () => createSecurityEventDb({ DATABASE_URL: url })],
  ])("%s pool survives a terminated idle connection", (_name, create) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = create();

    expect(() =>
      db.$client.emit("error", new Error("Connection terminated unexpectedly")),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
