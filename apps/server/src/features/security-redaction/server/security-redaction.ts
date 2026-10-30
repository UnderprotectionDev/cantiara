import { randomBytes, randomUUID } from "node:crypto";

import {
  SECURITY_REDACTION_DETECTION_LIMIT,
  SECURITY_REDACTION_EVENT_TYPE,
  SECURITY_REDACTION_LOCATOR_KINDS,
  type SecurityRedactionAccess,
  type SecurityRedactionActor,
  type SecurityRedactionEventLog,
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocatorSource,
  type SecurityRedactionScope,
  type SecurityRedactionSpread,
  SecurityRedactionTypedNameMismatchError,
  securityRedactionScopeAlias,
} from "@cantiara/api/security-redaction";

import { securityRedactionReplayLocator } from "./security-redaction-replay";
import { createSecurityRedactionSpread } from "./security-redaction-spread";

/**
 * Security Redaction (spec 78 #504, #505): preview and apply. The gate order
 * is fixed so a refusal never writes: ownership, the typed Account or Project
 * name (never a record title), then the Account Access grant is consumed
 * exactly once; right after, apply appends one secret-free
 * `security-redaction.applied` event (#506) and only then calls the
 * `SecurityRedactionSpread` port, so a crash mid-spread still leaves the event
 * for replay after a restore (`security-redaction-replay.ts`). If the append
 * fails nothing was removed and the error surfaces; applying again is safe. The sensitive value
 * only travels to the locator sources, the spread and the keyed replay digest
 * and is never stored, logged or returned.
 */

/** The irreversible event of an applied redaction: log, aliasing and replay key. */
export interface SecurityRedactionRecording {
  /** The aliased actor of the Account; never a name or an email. */
  actorAlias: (accountId: string) => Promise<string>;
  log: SecurityRedactionEventLog;
  newOperationId?: () => string;
  newSalt?: () => string;
  /** Server-only key of the replay digest. */
  replayKey: string;
}

export interface SecurityRedactionOptions {
  /** One source per spread target; a target without a source is reported as not searched. */
  locators?: readonly SecurityRedactionLocatorSource[];
  now?: () => Date;
  /** The Project's current name, or `null` when it is not the Account's. */
  projectName: (accountId: string, projectId: string) => Promise<string | null>;
  /** Required: an applied redaction must always leave its replay event. */
  recording: SecurityRedactionRecording;
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

  async function record(
    actor: SecurityRedactionActor,
    input: {
      reason: string;
      scope: SecurityRedactionScope;
      sensitiveValue: string;
    },
    occurredAt: string,
  ): Promise<{ actorAlias: string }> {
    const { recording } = options;
    const operationId = (recording.newOperationId ?? randomUUID)();
    const salt = (
      recording.newSalt ?? (() => randomBytes(16).toString("hex"))
    )();
    const actorAlias = await recording.actorAlias(actor.accountId);
    await recording.log.append({
      actorAlias,
      id: `security-redaction:${operationId}`,
      occurredAt,
      operationId,
      reason: input.reason,
      replay: securityRedactionReplayLocator(
        recording.replayKey,
        input.sensitiveValue,
        salt,
      ),
      scopeAlias: securityRedactionScopeAlias(actor.accountId, input.scope),
      type: SECURITY_REDACTION_EVENT_TYPE,
      version: 1,
    });
    return { actorAlias };
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
      const passedAt = now().toISOString();
      // The event comes first: a crash or a partly failed spread has already
      // removed the value from some targets, and replay can finish the job.
      const { actorAlias } = await record(actor, input, passedAt);
      const removal = await spread.spread({
        accountId: actor.accountId,
        scope: input.scope,
        sensitiveValue: input.sensitiveValue,
      });
      return {
        actorAlias,
        passedAt,
        reason: input.reason,
        removal,
        scope: input.scope,
        status: "redacted",
      };
    },
  };
}
