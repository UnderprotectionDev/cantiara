import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption of the Operasyonel yedek (tech-stack: application-layer
 * AES-256-GCM, per-record data key wrapped by a versioned root key). The
 * backup key ring is its own scope, separate from the production, integration
 * and export rings: the scope name is part of every AAD, so a ciphertext of
 * another scope never opens here even with identical key bytes. The key
 * version travels with the ciphertext; rotation adds a version to the ring and
 * never rewrites sealed records in place (ADR-0019).
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SCOPE = "backup";

export class BackupKeyError extends Error {
  readonly code = "BACKUP_KEY_UNREADABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "BackupKeyError";
  }
}

export interface BackupKeyRing {
  currentVersion: number;
  keys: ReadonlyMap<number, Buffer>;
}

export interface SealedBackup {
  ciphertext: string;
  keyVersion: number;
  scope: typeof SCOPE;
  wrappedDataKey: string;
}

export interface BackupSealer {
  open: (sealed: SealedBackup, aad: string) => string;
  seal: (plaintext: string, aad: string) => SealedBackup;
}

/** `1:<base64 32-byte key>,2:<base64 32-byte key>` in any order. */
export function parseBackupKeyRing(
  source: string,
  currentVersion: number,
): BackupKeyRing {
  const keys = new Map<number, Buffer>();
  for (const entry of source.split(",")) {
    const [version, encoded] = entry.trim().split(":");
    const key = Buffer.from(encoded ?? "", "base64");
    if (!(Number.isInteger(Number(version)) && key.length === KEY_BYTES)) {
      throw new BackupKeyError("Key ring entries must be version:base64.");
    }
    keys.set(Number(version), key);
  }
  if (!keys.has(currentVersion)) {
    throw new BackupKeyError("The current key version is not in the ring.");
  }
  return { currentVersion, keys };
}

/** Rotation: a ring with one more, higher version; older versions stay readable. */
export function rotateBackupKeyRing(
  ring: BackupKeyRing,
  key: Buffer = randomBytes(KEY_BYTES),
): BackupKeyRing {
  if (key.length !== KEY_BYTES) {
    throw new BackupKeyError("A backup key is 32 bytes.");
  }
  const currentVersion = Math.max(...ring.keys.keys()) + 1;
  return {
    currentVersion,
    keys: new Map([...ring.keys, [currentVersion, key]]),
  };
}

/** An in-process key, for drills and tests only. */
export function createEphemeralBackupKeyRing(): BackupKeyRing {
  return { currentVersion: 1, keys: new Map([[1, randomBytes(KEY_BYTES)]]) };
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
    throw new BackupKeyError("Sealed backup is truncated.");
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
    throw new BackupKeyError("Sealed backup failed authentication.");
  }
}

const bound = (aad: string) => `${SCOPE}:${aad}`;
const dekAad = (version: number, aad: string) =>
  `dek:${SCOPE}:${version}:${aad}`;

export function createBackupSealer(ring: BackupKeyRing): BackupSealer {
  const keyOf = (version: number) => {
    const key = ring.keys.get(version);
    if (!key) {
      throw new BackupKeyError(`Key version ${version} is not available.`);
    }
    return key;
  };
  return {
    open(sealed, aad) {
      if (sealed.scope !== SCOPE) {
        throw new BackupKeyError("Sealed value is not in the backup scope.");
      }
      const dataKey = decrypt(
        keyOf(sealed.keyVersion),
        sealed.wrappedDataKey,
        dekAad(sealed.keyVersion, aad),
      );
      return decrypt(dataKey, sealed.ciphertext, bound(aad)).toString("utf8");
    },
    seal(plaintext, aad) {
      const dataKey = randomBytes(KEY_BYTES);
      const keyVersion = ring.currentVersion;
      return {
        ciphertext: encrypt(
          dataKey,
          Buffer.from(plaintext, "utf8"),
          bound(aad),
        ),
        keyVersion,
        scope: SCOPE,
        wrappedDataKey: encrypt(
          keyOf(keyVersion),
          dataKey,
          dekAad(keyVersion, aad),
        ),
      };
    },
  };
}
