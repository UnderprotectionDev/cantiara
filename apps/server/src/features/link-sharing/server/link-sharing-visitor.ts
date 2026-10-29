import {
  SHARE_VISITOR_SESSION_LIFETIME_MS,
  type ShareManifest,
  type ShareSurfaceSummary,
} from "@cantiara/api/link-sharing";
import {
  equalHex,
  hmacHex,
  type LinkPasswordHasher,
  randomSecret,
  scryptLinkPasswordHasher,
  sha256Hex,
} from "./link-sharing-credentials";

/**
 * Visitor access to a Link Sharing Dış yüzey (spec 73, #483, ADR-0002). The
 * token, with the optional Link password, is exchanged once for a
 * `Paylaşım erişim oturumu`: a random cookie secret bound to one surface, not a
 * Better Auth session. `authorize` is the single authorization function every
 * page request goes through; #484 adds revoked and expired checks in
 * `surfaceAdmits` and reuses it for asset and range requests.
 */

/** Failures before a cooldown starts, and the cooldown ladder after them. */
export const FREE_ATTEMPTS = 5;
const FIRST_COOLDOWN_SECONDS = 30;
const MAX_COOLDOWN_SECONDS = 60 * 60;
/** Gate attempt data is gone this long after the last attempt. */
export const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VisitorSurface {
  accessEpoch: number;
  /** Set by a terminal cancellation; #484 adds expiry and revoke on top. */
  cancelledAt: Date | null;
  passwordHash: string | null;
  surfaceId: string;
}

export interface VisitorSnapshot {
  approvedAt: string;
  label: ShareSurfaceSummary["label"];
  manifest: ShareManifest;
  revision: number;
}

export interface StoredVisitorSession {
  accessEpoch: number;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  secretHash: string;
  surfaceId: string;
}

export interface LinkSharingVisitorStore {
  /** Adds one failed attempt to the key and returns the new count. */
  bumpFailure: (key: string, now: Date) => Promise<number>;
  clearFailures: (keys: string[]) => Promise<void>;
  createSession: (session: StoredVisitorSession) => Promise<void>;
  findSession: (id: string) => Promise<StoredVisitorSession | null>;
  /** The latest cooldown end among the keys, when one is still running. */
  lockedUntil: (keys: string[], now: Date) => Promise<Date | null>;
  lockUntil: (key: string, until: Date) => Promise<void>;
  /** Deletes attempts older than the retention and sessions past their end. */
  purge: (now: Date) => Promise<void>;
  snapshot: (surfaceId: string) => Promise<VisitorSnapshot | null>;
  surface: (surfaceId: string) => Promise<VisitorSurface | null>;
  surfaceByTokenHash: (tokenHash: string) => Promise<VisitorSurface | null>;
}

export interface VisitorSignals {
  /** Device hint such as the User-Agent; hashed with a rotating key, never stored. */
  device: string;
  /** Network address; hashed with a rotating key, never stored. */
  network: string;
}

export type ExchangeResult =
  | { status: "granted"; surfaceId: string; cookieValue: string }
  /** Wrong password, unknown token, or a password still needed: one answer. */
  | { status: "denied" }
  | { status: "cooldown"; retryAfterSeconds: number };

export interface LinkSharingVisitorAccess {
  /** The single authorization function; `null` is one generic answer for every refusal. */
  authorize: (
    surfaceId: string,
    cookieValue: string | undefined,
  ) => Promise<VisitorSnapshot | null>;
  exchange: (input: {
    password: string | null;
    signals: VisitorSignals;
    token: string;
  }) => Promise<ExchangeResult>;
}

/** #484 extends this with expiry and revoke; the same function guards assets. */
function surfaceAdmits(surface: Pick<VisitorSurface, "cancelledAt">) {
  return surface.cancelledAt === null;
}

export function cooldownSeconds(failures: number) {
  if (failures < FREE_ATTEMPTS) {
    return 0;
  }
  return Math.min(
    FIRST_COOLDOWN_SECONDS * 2 ** (failures - FREE_ATTEMPTS),
    MAX_COOLDOWN_SECONDS,
  );
}

export function createLinkSharingVisitor(
  store: LinkSharingVisitorStore,
  options: {
    hasher?: LinkPasswordHasher;
    now?: () => Date;
    /** Server secret the rotating attempt keys derive from. */
    rateSecret: string;
  },
): LinkSharingVisitorAccess {
  const now = options.now ?? (() => new Date());
  const hasher = options.hasher ?? scryptLinkPasswordHasher;

  /** Keyed per UTC day, so yesterday's keys cannot be linked to today's. */
  function attemptKeys(
    signals: VisitorSignals,
    tokenHash: string,
    at: Date,
  ): string[] {
    const dayKey = hmacHex(
      options.rateSecret,
      `link-sharing-attempts:${Math.floor(at.getTime() / DAY_MS)}`,
    );
    return [
      hmacHex(dayKey, `surface|${tokenHash}`),
      hmacHex(
        dayKey,
        `client|${signals.network}|${signals.device}|${tokenHash}`,
      ),
      hmacHex(dayKey, `client|${signals.network}|${signals.device}`),
    ];
  }

  async function startSession(surface: VisitorSurface, at: Date) {
    const id = crypto.randomUUID();
    const secret = randomSecret();
    await store.createSession({
      accessEpoch: surface.accessEpoch,
      createdAt: at,
      expiresAt: new Date(at.getTime() + SHARE_VISITOR_SESSION_LIFETIME_MS),
      id,
      secretHash: sha256Hex(secret),
      surfaceId: surface.surfaceId,
    });
    return `${id}.${secret}`;
  }

  /** Counts one failed guess on a key and starts or lengthens its cooldown. */
  async function recordFailure(key: string, at: Date) {
    const wait = cooldownSeconds(await store.bumpFailure(key, at));
    if (wait > 0) {
      await store.lockUntil(key, new Date(at.getTime() + wait * 1000));
    }
  }

  async function grant(
    surface: VisitorSurface,
    at: Date,
  ): Promise<ExchangeResult> {
    return {
      cookieValue: await startSession(surface, at),
      status: "granted",
      surfaceId: surface.surfaceId,
    };
  }

  async function exchange(input: {
    password: string | null;
    signals: VisitorSignals;
    token: string;
  }): Promise<ExchangeResult> {
    const at = now();
    const tokenHash = sha256Hex(input.token.slice(0, MAX_TOKEN_LENGTH));
    const keys = attemptKeys(input.signals, tokenHash, at);
    await store.purge(at);
    const lockedUntil = await store.lockedUntil(keys, at);
    if (lockedUntil) {
      return {
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((lockedUntil.getTime() - at.getTime()) / 1000),
        ),
        status: "cooldown",
      };
    }
    const found = await store.surfaceByTokenHash(tokenHash);
    const surface = found && surfaceAdmits(found) ? found : null;
    if (input.password === null) {
      // Opening the link is not a guess: only a surface without a password
      // admits it, and nothing is counted.
      return surface && surface.passwordHash === null
        ? grant(surface, at)
        : { status: "denied" };
    }
    // Always the same hashing work, whether or not the surface exists.
    const passwordMatches = await hasher.verify(
      input.password.slice(0, MAX_PASSWORD_LENGTH),
      surface?.passwordHash ?? null,
    );
    if (surface && (surface.passwordHash === null || passwordMatches)) {
      await store.clearFailures(keys.slice(1));
      return grant(surface, at);
    }
    await Promise.all(keys.map((key) => recordFailure(key, at)));
    return { status: "denied" };
  }

  async function authorize(
    surfaceId: string,
    cookieValue: string | undefined,
  ): Promise<VisitorSnapshot | null> {
    const at = now();
    const [id, secret] = (cookieValue ?? "").split(".");
    if (!(id && secret)) {
      return null;
    }
    const session = await store.findSession(id);
    if (
      !(
        session &&
        session.surfaceId === surfaceId &&
        equalHex(session.secretHash, sha256Hex(secret)) &&
        at < session.expiresAt
      )
    ) {
      return null;
    }
    const surface = await store.surface(surfaceId);
    if (
      !(
        surface &&
        surface.accessEpoch === session.accessEpoch &&
        surfaceAdmits(surface)
      )
    ) {
      return null;
    }
    return store.snapshot(surfaceId);
  }

  return { authorize, exchange };
}
