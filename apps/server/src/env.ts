import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const sensitiveEnvKeys = [
  "BETTER_AUTH_SECRET",
  "DATABASE_URL",
  "GITHUB_CLIENT_SECRET",
] as const;
const redactedValue = "[REDACTED]";

export function createServerEnv(
  runtimeEnv: Record<string, string | undefined> = process.env,
) {
  return createEnv({
    server: {
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url(),
      CORS_ORIGIN: z.url(),
      DATABASE_URL: z.string().min(1),
      GITHUB_CLIENT_ID: z.string().min(1),
      GITHUB_CLIENT_SECRET: z.string().min(1),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export const env = createServerEnv();

function redactString(value: string) {
  return sensitiveEnvKeys.reduce(
    (redacted, key) => redacted.replaceAll(env[key], redactedValue),
    value,
  );
}

function redactError(error: Error, seen: Map<object, unknown>) {
  if (seen.has(error)) {
    return seen.get(error);
  }

  const copy = new Error("Redacted error");
  Object.setPrototypeOf(copy, Object.getPrototypeOf(error));
  seen.set(error, copy);

  const keys = new Set<PropertyKey>([
    ...Reflect.ownKeys(error),
    "message",
    "stack",
    "cause",
  ]);
  let changed = false;

  for (const key of keys) {
    let propertyValue: unknown;
    try {
      propertyValue = Reflect.get(error, key);
    } catch {
      continue;
    }

    const redactedPropertyValue = redactValue(propertyValue, seen);
    changed ||= redactedPropertyValue !== propertyValue;

    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: Object.prototype.propertyIsEnumerable.call(error, key),
      value: redactedPropertyValue,
      writable: true,
    });
  }

  if (!changed) {
    seen.set(error, error);
    return error;
  }

  return copy;
}

function redactValue(value: unknown, seen: Map<object, unknown>): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (value instanceof Error) {
    return redactError(value, seen);
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return value;
  }

  let copy: object;
  if (Array.isArray(value)) {
    copy = new Array(value.length);
  } else if (prototype === null) {
    copy = Object.create(null);
  } else {
    copy = {};
  }
  seen.set(value, copy);

  let changed = false;
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") {
      continue;
    }

    let propertyValue: unknown;
    try {
      propertyValue = Reflect.get(value, key);
    } catch {
      continue;
    }

    const redactedPropertyValue = redactValue(propertyValue, seen);
    changed ||= redactedPropertyValue !== propertyValue;

    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: Object.prototype.propertyIsEnumerable.call(value, key),
      value: redactedPropertyValue,
      writable: true,
    });
  }

  if (!changed) {
    seen.set(value, value);
    return value;
  }

  return copy;
}

export function redactSecrets(value: unknown) {
  return redactValue(value, new Map());
}

/** Packaged desktop builds serve the frontend from their own origin, not CORS_ORIGIN. */
export const desktopOrigins = ["tauri://localhost", "http://tauri.localhost"];
