import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for staged import files (tech-stack: application-layer
 * AES-256-GCM with a per-row data key wrapped by a versioned key; the import
 * keys are their own scope, separate from the GitHub App key ring). Plaintext
 * never leaves this module except through `open`.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class ImportStagingSecretError extends Error {
  readonly code = "IMPORT_STAGING_UNREADABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "ImportStagingSecretError";
  }
}

export interface ImportKeyRing {
  currentVersion: number;
  keys: ReadonlyMap<number, Buffer>;
}

export interface SealedImport {
  ciphertext: string;
  keyVersion: number;
  wrappedDataKey: string;
}

export interface ImportSealer {
  open: (sealed: SealedImport, aad: string) => string;
  seal: (plaintext: string, aad: string) => SealedImport;
}

/** `1:<base64 32-byte key>,2:<base64 32-byte key>` in any order. */
export function parseImportKeyRing(
  source: string,
  currentVersion: number,
): ImportKeyRing {
  const keys = new Map<number, Buffer>();
  for (const entry of source.split(",")) {
    const [version, encoded] = entry.trim().split(":");
    const key = Buffer.from(encoded ?? "", "base64");
    if (!(Number.isInteger(Number(version)) && key.length === KEY_BYTES)) {
      throw new ImportStagingSecretError(
        "Key ring entries must be version:base64.",
      );
    }
    keys.set(Number(version), key);
  }
  if (!keys.has(currentVersion)) {
    throw new ImportStagingSecretError(
      "The current key version is not in the ring.",
    );
  }
  return { currentVersion, keys };
}

/** An in-process key: staged files stay readable only until the process restarts. */
export function createEphemeralImportKeyRing(): ImportKeyRing {
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
    throw new ImportStagingSecretError("Staged import is truncated.");
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
    throw new ImportStagingSecretError("Staged import failed authentication.");
  }
}

export function createImportSealer(ring: ImportKeyRing): ImportSealer {
  const keyOf = (version: number) => {
    const key = ring.keys.get(version);
    if (!key) {
      throw new ImportStagingSecretError(
        `Key version ${version} is not available.`,
      );
    }
    return key;
  };
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
  };
}
