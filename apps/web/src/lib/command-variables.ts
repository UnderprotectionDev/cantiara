import { hashKey } from "@tanstack/react-query";

/** A resubmitted payload can replay its failed command; a changed one gets a new key. */
export function commandVariables<T extends object>(
  input: T,
  failed?: T & { clientIdempotencyKey: string },
) {
  if (failed) {
    const { clientIdempotencyKey: _, ...previous } = failed;
    if (hashKey([previous]) === hashKey([input])) {
      return failed;
    }
  }
  return { ...input, clientIdempotencyKey: crypto.randomUUID() };
}
