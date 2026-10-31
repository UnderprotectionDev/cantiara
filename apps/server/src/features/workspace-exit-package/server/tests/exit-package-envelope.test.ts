import { ExitPackageError } from "@cantiara/api/workspace-exit-package";
import { describe, expect, test } from "vitest";

import { openExitPackage, sealExitPackage } from "../exit-package-envelope";

const password = "correct horse battery staple";
const plaintext = new TextEncoder().encode(
  "exit package plaintext marker 4242",
);

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

  test("an oversize KDF cost in a header is refused", () => {
    const sealed = Buffer.from(sealExitPackage(plaintext, password));
    const forged = Buffer.from(
      sealed.toString("latin1").replace('"N":32768', '"N":99999999'),
      "latin1",
    );
    expect(() => openExitPackage(forged, password)).toThrow(ExitPackageError);
  });
});
