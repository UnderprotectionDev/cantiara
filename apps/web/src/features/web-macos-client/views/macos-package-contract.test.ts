import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const featureDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(featureDirectory, "../../../../");
const repositoryDirectory = resolve(webDirectory, "../..");

const tauriConfig = JSON.parse(
  readFileSync(resolve(webDirectory, "src-tauri/tauri.conf.json"), "utf8"),
) as {
  bundle?: {
    createUpdaterArtifacts?: boolean;
    macOS?: {
      hardenedRuntime?: boolean;
      minimumSystemVersion?: string;
    };
    targets?: string[];
  };
  identifier?: string;
};

const acceptanceDocument = readFileSync(
  resolve(repositoryDirectory, "docs/prd/16-product-acceptance.md"),
  "utf8",
);
const tauriCargoManifest = readFileSync(
  resolve(webDirectory, "src-tauri/Cargo.toml"),
  "utf8",
);
const releaseWorkflow = readFileSync(
  resolve(repositoryDirectory, ".github/workflows/macos-release.yml"),
  "utf8",
);
const applicationIdentifierPattern = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;
const rustDataLayerPattern = /\b(?:diesel|postgres|rusqlite|sqlite|sqlx)\b/i;
const unsupportedPackagePattern = /windows-latest|ubuntu-latest|\bPWA\b/i;
const apiUrlWorkflowExpression = [
  "VITE_SERVER_URL: $",
  "{{ vars.CANTIARA_API_URL }}",
].join("");

describe("Client Shell macOS package contract", () => {
  test("uses an application identity and only macOS bundles", () => {
    expect(tauriConfig.identifier).toMatch(applicationIdentifierPattern);
    expect(tauriConfig.identifier).not.toBe("com.tauri.dev");
    expect(tauriConfig.bundle?.targets).toEqual(["app", "dmg"]);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
  });

  test("enforces the supported macOS floor with hardened runtime", () => {
    expect(tauriConfig.bundle?.macOS).toMatchObject({
      hardenedRuntime: true,
      minimumSystemVersion: "14.0",
    });
  });

  test("records the frozen product support matrix", () => {
    expect(acceptanceDocument).toContain(
      "Ürün destek matrisi: macOS 26, macOS 15 ve macOS 14",
    );
    expect(releaseWorkflow).toContain("major: 26");
    expect(releaseWorkflow).toContain("major: 15");
    expect(releaseWorkflow).toContain("major: 14");
  });

  test("keeps the Rust shell on the web API without a local data layer", () => {
    expect(releaseWorkflow).toContain(apiUrlWorkflowExpression);
    expect(tauriCargoManifest).not.toMatch(rustDataLayerPattern);
  });

  test("builds and verifies only signed, notarized macOS artifacts", () => {
    expect(releaseWorkflow).toContain("tauri-apps/tauri-action@v1");
    expect(releaseWorkflow).toContain("apple-actions/import-codesign-certs@v7");
    expect(releaseWorkflow).toContain("APPLE_CERTIFICATE");
    expect(releaseWorkflow).toContain("APPLE_CERTIFICATE_PASSWORD");
    expect(releaseWorkflow).toContain("APPLE_SIGNING_IDENTITY");
    expect(releaseWorkflow).toContain("APPLE_API_KEY");
    expect(releaseWorkflow).toContain("APPLE_API_ISSUER");
    expect(releaseWorkflow).toContain("APPLE_API_KEY_PATH");
    expect(releaseWorkflow).toContain("codesign --verify");
    expect(releaseWorkflow).toContain("xcrun stapler validate");
    expect(releaseWorkflow).toContain("uploadUpdaterJson: false");
    expect(releaseWorkflow).toContain("uploadUpdaterSignatures: false");
    expect(releaseWorkflow).not.toMatch(unsupportedPackagePattern);
  });
});
