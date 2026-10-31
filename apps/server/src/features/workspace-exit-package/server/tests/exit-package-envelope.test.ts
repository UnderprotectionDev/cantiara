import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

import {
  EXIT_ENVELOPE_MAGIC,
  EXIT_ENVELOPE_VERSION,
  EXIT_KDF_MAX_N,
  ExitPackageError,
} from "@cantiara/api/workspace-exit-package";
import { describe, expect, test } from "vitest";

import { openExitPackage, sealExitPackage } from "../exit-package-envelope";

const password = "correct horse battery staple";
const plaintext = new TextEncoder().encode(
  "exit package plaintext marker 4242",
);
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PREFIX_BYTES = 9;

describe("Workspace Exit Package envelope", () => {
  test("ciphertext does not contain the plaintext and opens with the password", () => {
    const sealed = sealExitPackage(plaintext, password);
    expect(Buffer.from(sealed).includes(Buffer.from("plaintext marker"))).toBe(
      false,
    );
    expect(openExitPackage(sealed, password)).toEqual(plaintext);
  });

  test("a wrong, empty or altered password cannot open it", () => {
    const sealed = sealExitPackage(plaintext, password);
    for (const attempt of ["wrong password here", "", `${password} `]) {
      expect(() => openExitPackage(sealed, attempt)).toThrow(ExitPackageError);
    }
  });

  test("a flipped header or ciphertext byte is refused", () => {
    const sealed = sealExitPackage(plaintext, password);
    for (const index of [12, sealed.length - 20]) {
      const copy = sealed.slice();
      copy[index] = ((copy[index] ?? 0) + 1) % 256;
      expect(() => openExitPackage(copy, password)).toThrow(ExitPackageError);
    }
  });

  test("each seal uses a fresh salt and IV", () => {
    expect(
      Buffer.from(sealExitPackage(plaintext, password)).equals(
        Buffer.from(sealExitPackage(plaintext, password)),
      ),
    ).toBe(false);
  });

  test("an oversize KDF cost in a header is refused before authentication", () => {
    // Re-seal the plaintext by hand with N above the published cap so the
    // header is AAD-consistent (an attacker could not forge it). r = 2 keeps
    // this test-side derivation affordable. Refusal must then come from the
    // N cap itself, not from a broken tag or a derivation memory limit: the
    // guard throws its own ExitPackageError before any key is derived, and
    // that inner error stays as the outer error's cause.
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const headerBytes = Buffer.from(
      JSON.stringify({
        cipher: "aes-256-gcm",
        iv: iv.toString("base64"),
        kdf: {
          N: EXIT_KDF_MAX_N * 2,
          name: "scrypt",
          p: 1,
          r: 2,
          salt: salt.toString("base64"),
        },
      }),
    );
    const prefix = Buffer.alloc(PREFIX_BYTES);
    Buffer.from(EXIT_ENVELOPE_MAGIC, "ascii").copy(prefix, 0);
    prefix.writeUInt8(EXIT_ENVELOPE_VERSION, 4);
    prefix.writeUInt32BE(headerBytes.length, 5);
    const head = Buffer.concat([prefix, headerBytes]);
    const key = scryptSync(Buffer.from(password.normalize("NFKC")), salt, 32, {
      N: EXIT_KDF_MAX_N * 2,
      maxmem: 1024 * 1024 * 1024,
      p: 1,
      r: 2,
    });
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(head);
    const sealed = new Uint8Array(
      Buffer.concat([
        head,
        Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]),
        cipher.getAuthTag(),
      ]),
    );
    let caught: unknown;
    try {
      openExitPackage(sealed, password);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExitPackageError);
    expect((caught as { cause: unknown }).cause).toBeInstanceOf(
      ExitPackageError,
    );
  });
});
