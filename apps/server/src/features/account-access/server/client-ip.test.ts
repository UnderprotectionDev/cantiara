import type { Context } from "hono";
import { describe, expect, test } from "vitest";

import { requestClientIp } from "./client-ip";

function connectionContext(address?: string) {
  return {
    env: {
      requestIP: () =>
        address
          ? { address, family: address.includes(":") ? "IPv6" : "IPv4" }
          : null,
    },
  } as unknown as Context;
}

describe("Account Access client IP", () => {
  test("uses the client address from a trusted proxy chain", () => {
    const request = new Request("https://api.cantiara.example/", {
      headers: {
        "x-forwarded-for": "198.51.100.10, 203.0.113.10",
      },
    });

    expect(
      requestClientIp(request, connectionContext("203.0.113.10"), [
        "203.0.113.10",
      ]),
    ).toBe("198.51.100.10");
  });

  test("ignores forwarded headers from an untrusted connection", () => {
    const request = new Request("https://api.cantiara.example/", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    expect(
      requestClientIp(request, connectionContext("198.51.100.9"), [
        "203.0.113.10",
      ]),
    ).toBe("198.51.100.9");
  });

  test("fails closed to an unknown client when connection metadata is unavailable", () => {
    const request = new Request("https://api.cantiara.example/", {
      headers: {
        "x-forwarded-for": "198.51.100.10",
      },
    });

    expect(
      requestClientIp(request, connectionContext(), ["203.0.113.10"]),
    ).toBe("unknown");
  });
});
