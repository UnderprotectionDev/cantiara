import {
  SECURITY_REDACTION_DETECTION_LIMIT,
  SECURITY_REDACTION_LOCATOR_KINDS,
  type SecurityRedactionAccess,
  type SecurityRedactionActor,
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocatorSource,
  type SecurityRedactionScope,
  type SecurityRedactionSpread,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";

import { createSecurityRedactionSpread } from "./security-redaction-spread";

/**
 * Security Redaction (spec 78 #504, #505): preview and apply. The gate order
 * is fixed so a refusal never writes: ownership, the typed Account or Project
 * name (never a record title), then the Account Access grant is consumed
 * exactly once; right after, apply calls the `SecurityRedactionSpread` port.
 * Apply writes no security event; the event and replay are #506. The
 * sensitive value only travels to the locator sources and the spread and is
 * never stored, logged or returned.
 */

export interface SecurityRedactionOptions {
  /** One source per spread target; a target without a source is reported as not searched. */
  locators?: readonly SecurityRedactionLocatorSource[];
  now?: () => Date;
  /** The Project's current name, or `null` when it is not the Account's. */
  projectName: (accountId: string, projectId: string) => Promise<string | null>;
  /** The removal across the closed spread targets; without it nothing is wired. */
  spread?: SecurityRedactionSpread;
}

export function createSecurityRedaction(
  options: SecurityRedactionOptions,
): SecurityRedactionAccess {
  const { projectName } = options;
  const sources = options.locators ?? [];
  const spread = options.spread ?? createSecurityRedactionSpread([]);
  const now = options.now ?? (() => new Date());

  async function target(
    actor: SecurityRedactionActor,
    scope: SecurityRedactionScope,
  ) {
    if (scope.kind === "Account") {
      return { kind: "Account", name: actor.accountName } as const;
    }
    const name = await projectName(actor.accountId, scope.projectId);
    return name === null ? null : ({ kind: "Project", name } as const);
  }

  return {
    async preview(actor, input) {
      const typedNameTarget = await target(actor, input.scope);
      if (!typedNameTarget) {
        return null;
      }
      const found = await Promise.all(
        sources.map((source) =>
          source.locate({
            accountId: actor.accountId,
            scope: input.scope,
            sensitiveValue: input.sensitiveValue,
          }),
        ),
      );
      const searched = new Set(sources.map((source) => source.kind));
      return {
        detectionLimit: SECURITY_REDACTION_DETECTION_LIMIT,
        // Only locations are copied out: a source cannot leak more than that.
        locators: found
          .flat()
          .map(({ kind, location, recordId, recordKind }) => ({
            kind,
            location,
            recordId,
            recordKind,
          })),
        notSearched: SECURITY_REDACTION_LOCATOR_KINDS.filter(
          (kind) => !searched.has(kind),
        ),
        typedNameTarget,
      };
    },

    async apply(actor, input, consumeGrant) {
      const expected = await target(actor, input.scope);
      if (!expected) {
        return null;
      }
      // Typing the name is its own step and runs before the grant, so a typo
      // never burns the one-time proof.
      if (input.typedName !== expected.name) {
        throw new SecurityRedactionTypedNameMismatchError();
      }
      if (!(await consumeGrant(input.grant))) {
        throw new SecurityRedactionGrantRejectedError();
      }
      const removal = await spread.spread({
        accountId: actor.accountId,
        scope: input.scope,
        sensitiveValue: input.sensitiveValue,
      });
      return {
        passedAt: now().toISOString(),
        removal,
        scope: input.scope,
        status: "redacted",
      };
    },
  };
}
