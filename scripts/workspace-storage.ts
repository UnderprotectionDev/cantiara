import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export function redactedFailure(message: string, cause: unknown) {
  return new Error(message, {
    cause: cause instanceof Error ? "Redacted Error" : "Redacted failure",
  });
}

export function writePrivateJson(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(temporary, file);
  chmodSync(file, 0o600);
}

export function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw redactedFailure(
      "Cannot read database state; file contents redacted",
      error,
    );
  }
}

export async function withWorkspaceLock<Output>(
  file: string,
  action: () => Promise<Output>,
) {
  mkdirSync(dirname(file), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(file, "wx", 0o600);
  } catch (error) {
    throw redactedFailure(
      "Workspace database operation already locked; inspect the lock owner before removing a stale lock",
      error,
    );
  }
  writeFileSync(descriptor, `${process.pid}\n`);
  try {
    return await action();
  } finally {
    closeSync(descriptor);
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
}
