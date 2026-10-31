import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import {
  EXIT_ENVELOPE_MAGIC,
  EXIT_ENVELOPE_VERSION,
  EXIT_KDF,
  EXIT_KDF_MAX_N,
  ExitPackageError,
} from "@cantiara/api/workspace-exit-package";

/**
 * Password envelope of the Workspace Exit Package (tech-stack: `node:crypto`
 * scrypt + AES-256-GCM, no dependency). Layout, published in
 * `docs/workspace-exit-package-envelope.md`:
 * `"CXEP" | u8 version | u32be headerLength | header JSON | ciphertext | 16-byte tag`.
 * The header (KDF parameters, salt, IV) is plaintext and is bound to the
 * ciphertext as AES-GCM AAD. The password lives only in the call frame.
 */

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX_BYTES = 9;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;
const magic = Buffer.from(EXIT_ENVELOPE_MAGIC, "ascii");

interface EnvelopeHeader {
  cipher: "aes-256-gcm";
  iv: string;
  kdf: { N: number; name: "scrypt"; p: number; r: number; salt: string };
}

function deriveKey(password: string, kdf: EnvelopeHeader["kdf"]): Buffer {
  return scryptSync(
    password.normalize("NFKC"),
    Buffer.from(kdf.salt, "base64"),
    KEY_BYTES,
    {
      N: kdf.N,
      maxmem: SCRYPT_MAXMEM,
      p: kdf.p,
      r: kdf.r,
    },
  );
}

function prefix(headerLength: number): Buffer {
  const out = Buffer.alloc(PREFIX_BYTES);
  magic.copy(out, 0);
  out.writeUInt8(EXIT_ENVELOPE_VERSION, 4);
  out.writeUInt32BE(headerLength, 5);
  return out;
}

export function sealExitPackage(
  plaintext: Uint8Array,
  password: string,
): Uint8Array {
  const header: EnvelopeHeader = {
    cipher: "aes-256-gcm",
    iv: randomBytes(IV_BYTES).toString("base64"),
    kdf: { ...EXIT_KDF, salt: randomBytes(SALT_BYTES).toString("base64") },
  };
  const headerBytes = Buffer.from(JSON.stringify(header));
  const head = Buffer.concat([prefix(headerBytes.length), headerBytes]);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveKey(password, header.kdf),
    Buffer.from(header.iv, "base64"),
  );
  cipher.setAAD(head);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return new Uint8Array(Buffer.concat([head, body, cipher.getAuthTag()]));
}

function unreadable(): ExitPackageError {
  return new ExitPackageError(
    "package_unreadable",
    "The package cannot be opened with this password.",
  );
}

/**
 * Verifier-side open. Not a product restore: nothing in the product calls it,
 * it exists so the published definition is executable and testable.
 */
export function openExitPackage(
  envelope: Uint8Array,
  password: string,
): Uint8Array {
  const raw = Buffer.from(envelope);
  if (
    raw.length < PREFIX_BYTES + TAG_BYTES ||
    !raw.subarray(0, 4).equals(magic)
  ) {
    throw unreadable();
  }
  if (raw.readUInt8(4) !== EXIT_ENVELOPE_VERSION) {
    throw unreadable();
  }
  const headerLength = raw.readUInt32BE(5);
  const headEnd = PREFIX_BYTES + headerLength;
  if (headEnd + TAG_BYTES > raw.length) {
    throw unreadable();
  }
  try {
    const header = JSON.parse(
      raw.subarray(PREFIX_BYTES, headEnd).toString("utf8"),
    ) as EnvelopeHeader;
    if (
      header.cipher !== "aes-256-gcm" ||
      header.kdf.name !== "scrypt" ||
      header.kdf.N > EXIT_KDF_MAX_N
    ) {
      throw unreadable();
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(password, header.kdf),
      Buffer.from(header.iv, "base64"),
    );
    decipher.setAAD(raw.subarray(0, headEnd));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    return new Uint8Array(
      Buffer.concat([
        decipher.update(raw.subarray(headEnd, raw.length - TAG_BYTES)),
        decipher.final(),
      ]),
    );
  } catch (error) {
    throw Object.assign(unreadable(), { cause: error });
  }
}
