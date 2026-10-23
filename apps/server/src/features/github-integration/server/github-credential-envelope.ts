import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { SealedSecret } from "@cantiara/api/github-integration";

/**
 * Envelope encryption for GitHub App installation tokens (tech-stack: dynamic
 * integration tokens are application-layer ciphertext in PostgreSQL). Each
 * secret gets its own random data key; the data key is wrapped by a versioned
 * key-encryption key that lives in the runtime secret store, so rotating the
 * key version never needs the plaintext token. Plaintext never leaves this
 * module except through `open`.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const STATE_TTL_MS = 10 * 60 * 1000;

export class GitHubSecretError extends Error {
  readonly code = "GITHUB_SECRET_UNREADABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "GitHubSecretError";
  }
}

export interface GitHubKeyRing {
  currentVersion: number;
  keys: ReadonlyMap<number, Buffer>;
}

/** `1:<base64 32-byte key>,2:<base64 32-byte key>` in ascending or any order. */
export function parseGitHubKeyRing(
  source: string,
  currentVersion: number,
): GitHubKeyRing {
  const keys = new Map<number, Buffer>();
  for (const entry of source.split(",")) {
    const [version, encoded] = entry.trim().split(":");
    const key = Buffer.from(encoded ?? "", "base64");
    if (!(Number.isInteger(Number(version)) && key.length === KEY_BYTES)) {
      throw new GitHubSecretError("Key ring entries must be version:base64.");
    }
    keys.set(Number(version), key);
  }
  if (!keys.has(currentVersion)) {
    throw new GitHubSecretError("The current key version is not in the ring.");
  }
  return { currentVersion, keys };
}

function encrypt(key: Buffer, plaintext: Buffer, aad: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function decrypt(key: Buffer, encoded: string, aad: string) {
  const raw = Buffer.from(encoded, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new GitHubSecretError("Sealed secret is truncated.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    raw.subarray(0, IV_BYTES),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
  } catch {
    // biome-ignore lint/style/useErrorCause: The cipher error must not carry key material.
    throw new GitHubSecretError("Sealed secret failed authentication.");
  }
}

export interface InstallState {
  accountId: string;
  projectId: string;
}

export interface GitHubSecrets {
  /** `aad` binds the ciphertext to its row so it cannot be moved to another one. */
  open: (sealed: SealedSecret, aad: string) => string;
  seal: (plaintext: string, aad: string) => SealedSecret;
  /** Install `state`: signed, expiring, bound to one account and Project. */
  signState: (payload: InstallState, now: Date) => string;
  verifyState: (
    state: string,
    now: Date,
  ) => (InstallState & { expiresAt: number }) | null;
}

export function createGitHubSecrets(ring: GitHubKeyRing): GitHubSecrets {
  const keyOf = (version: number) => {
    const key = ring.keys.get(version);
    if (!key) {
      throw new GitHubSecretError(`Key version ${version} is not available.`);
    }
    return key;
  };
  const sign = (body: string, version: number) =>
    createHmac(
      "sha256",
      createHmac("sha256", keyOf(version))
        .update("github-install-state")
        .digest(),
    )
      .update(body)
      .digest("base64url");

  return {
    open(sealed, aad) {
      const dataKey = decrypt(
        keyOf(sealed.keyVersion),
        sealed.wrappedDataKey,
        `dek:${sealed.keyVersion}:${aad}`,
      );
      return decrypt(dataKey, sealed.ciphertext, aad).toString("utf8");
    },

    seal(plaintext, aad) {
      const dataKey = randomBytes(KEY_BYTES);
      const keyVersion = ring.currentVersion;
      return {
        ciphertext: encrypt(dataKey, Buffer.from(plaintext, "utf8"), aad),
        keyVersion,
        wrappedDataKey: encrypt(
          keyOf(keyVersion),
          dataKey,
          `dek:${keyVersion}:${aad}`,
        ),
      };
    },

    signState(payload, now) {
      const body = Buffer.from(
        JSON.stringify({
          a: payload.accountId,
          e: now.getTime() + STATE_TTL_MS,
          n: randomBytes(8).toString("hex"),
          p: payload.projectId,
          v: ring.currentVersion,
        }),
      ).toString("base64url");
      return `${body}.${sign(body, ring.currentVersion)}`;
    },

    verifyState(state, now) {
      const [body, signature] = state.split(".");
      if (!(body && signature)) {
        return null;
      }
      try {
        const parsed = JSON.parse(
          Buffer.from(body, "base64url").toString("utf8"),
        ) as { a?: unknown; e?: unknown; p?: unknown; v?: unknown };
        if (
          typeof parsed.a !== "string" ||
          typeof parsed.p !== "string" ||
          typeof parsed.e !== "number" ||
          typeof parsed.v !== "number" ||
          parsed.e < now.getTime()
        ) {
          return null;
        }
        const expected = Buffer.from(sign(body, parsed.v));
        const actual = Buffer.from(signature);
        if (
          expected.length !== actual.length ||
          !timingSafeEqual(expected, actual)
        ) {
          return null;
        }
        return {
          accountId: parsed.a,
          expiresAt: parsed.e,
          projectId: parsed.p,
        };
      } catch {
        return null;
      }
    },
  };
}
