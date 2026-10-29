import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

/**
 * Link Sharing Secrets: the Share token, the optional Link password and the
 * Paylaşım erişim oturumu cookie secret. Tokens and cookie secrets are 256-bit
 * random values, so only a SHA-256 of them is stored. The Link password is
 * human-chosen, so it gets a salted, memory-hard `scrypt` hash (`node:crypto`,
 * no dependency). Nothing here is reversible and nothing is logged.
 */

const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK = 8;
const SCRYPT_PARALLEL = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MEMORY = 128 * SCRYPT_COST * SCRYPT_BLOCK * 2;

export interface LinkPasswordHasher {
  hash: (password: string) => Promise<string>;
  /** Constant-work verification; a missing stored hash is checked against a dummy. */
  verify: (password: string, stored: string | null) => Promise<boolean>;
}

export const randomSecret = () => randomBytes(32).toString("base64url");

export const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Keyed hash for rotating, privacy-preserving rate-limit keys. */
export const hmacHex = (key: string, value: string) =>
  createHmac("sha256", key).update(value).digest("hex");

export function equalHex(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function derive(password: string, salt: Buffer, cost: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: cost,
        maxmem: SCRYPT_MEMORY * 2,
        p: SCRYPT_PARALLEL,
        r: SCRYPT_BLOCK,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

let dummyHash: Promise<string> | null = null;

export const scryptLinkPasswordHasher: LinkPasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16);
    const key = await derive(password, salt, SCRYPT_COST);
    return [
      "scrypt",
      SCRYPT_COST,
      salt.toString("base64url"),
      key.toString("base64url"),
    ].join("$");
  },
  async verify(password, stored) {
    let target = stored;
    let expectMatch = true;
    if (!target) {
      // Same work for a surface that has no password or does not exist.
      dummyHash ??= scryptLinkPasswordHasher.hash(randomSecret());
      target = await dummyHash;
      expectMatch = false;
    }
    const [scheme, cost, salt, key] = target.split("$");
    if (scheme !== "scrypt" || !(cost && salt && key)) {
      return false;
    }
    const expected = Buffer.from(key, "base64url");
    const actual = await derive(
      password,
      Buffer.from(salt, "base64url"),
      Number(cost),
    );
    return (
      expectMatch &&
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  },
};
