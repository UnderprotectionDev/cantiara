import { describe, expect, test } from "vitest";

import {
  isMacOSCleanInstallEvidence,
  isMacOSPackageAcceptanceCandidate,
  isMacOSPackageEvidence,
  type MacOSCleanInstallEvidence,
  type MacOSPackageAcceptanceCandidate,
  type MacOSPackageEvidence,
  macOSPackageTargets,
  supportedMacOSMajors,
} from "./macos-package-contract";

const sourceCommit = "a".repeat(40);
const workflow = {
  ref: "cantiara/.github/workflows/macos-release.yml@refs/tags/cantiara-v0.1.0",
  runAttempt: "1",
  runId: "123456789",
  sha: sourceCommit,
};
const backend = {
  api: "hono-bun",
  localDataLayer: false,
  sourceOfTruth: "neon-postgresql",
} as const;
const digest = "b".repeat(64);

function createPackageEvidence(
  target: MacOSPackageEvidence["target"],
  runnerArchitecture: string,
) {
  return {
    artifact: {
      kind: "dmg",
      name: `cantiara_0.1.0_${target}.dmg`,
      sha256: digest,
    },
    backend,
    checks: {
      codesign: "passed",
      gatekeeper: "passed",
      notarization: "passed",
    },
    environment: {
      macOSVersion: "14.7.8",
      runnerArchitecture,
    },
    evidenceType: "signed-notarized-package",
    schemaVersion: "cantiara.macos-package-evidence/v1",
    sourceCommit,
    target,
    workflow,
  } satisfies MacOSPackageEvidence;
}

function createCleanInstallEvidence(
  expectedMajor: MacOSCleanInstallEvidence["expectedMajor"],
) {
  return {
    artifact: {
      kind: "dmg",
      name: `cantiara_0.1.0_${macOSPackageTargets[0]}.dmg`,
      sha256: digest,
    },
    backend,
    checks: {
      codesign: "passed",
      gatekeeper: "passed",
      install: "passed",
      notarization: "passed",
    },
    environment: {
      macOSVersion: `${expectedMajor}.7.8`,
      runnerArchitecture: "arm64",
    },
    evidenceType: "clean-install",
    expectedMajor,
    packageTarget: macOSPackageTargets[0],
    schemaVersion: "cantiara.macos-package-evidence/v1",
    sourceCommit,
    workflow,
  } satisfies MacOSCleanInstallEvidence;
}

function createCandidate() {
  return {
    cleanInstallEvidence: supportedMacOSMajors.map(createCleanInstallEvidence),
    evidenceType: "acceptance-candidate",
    packageEvidence: [
      createPackageEvidence(macOSPackageTargets[0], "arm64"),
      createPackageEvidence(macOSPackageTargets[1], "arm64"),
    ],
    releaseTag: "cantiara-v0.1.0",
    result: "passed",
    schemaVersion: "cantiara.macos-package-acceptance/v1",
    sourceCommit,
    supportedMacOSMajors,
    workflow,
  } satisfies MacOSPackageAcceptanceCandidate;
}

describe("Client Shell macOS package contract", () => {
  test("accepts signed and notarized package evidence for both macOS targets", () => {
    expect(
      isMacOSPackageEvidence(
        createPackageEvidence(macOSPackageTargets[0], "arm64"),
      ),
    ).toBe(true);
    expect(
      isMacOSPackageEvidence(
        createPackageEvidence(macOSPackageTargets[1], "arm64"),
      ),
    ).toBe(true);
  });

  test("rejects missing notarization, a local data source, or another platform", () => {
    const packageEvidence = createPackageEvidence(
      macOSPackageTargets[0],
      "arm64",
    );
    const missingNotarization = {
      ...packageEvidence,
      checks: { ...packageEvidence.checks, notarization: "failed" },
    };
    const localDataSource = {
      ...packageEvidence,
      backend: { ...packageEvidence.backend, localDataLayer: true },
    };
    const anotherPlatform = {
      ...packageEvidence,
      target: "x86_64-pc-windows-msvc",
    };

    expect(isMacOSPackageEvidence(missingNotarization)).toBe(false);
    expect(isMacOSPackageEvidence(localDataSource)).toBe(false);
    expect(isMacOSPackageEvidence(anotherPlatform)).toBe(false);
  });

  test("accepts the frozen macOS support matrix and rejects incomplete evidence", () => {
    const candidate = createCandidate();
    const incompleteCandidate = {
      ...candidate,
      cleanInstallEvidence: candidate.cleanInstallEvidence.filter(
        (evidence) => evidence.expectedMajor !== 14,
      ),
    };

    expect(isMacOSPackageAcceptanceCandidate(candidate)).toBe(true);
    expect(isMacOSPackageAcceptanceCandidate(incompleteCandidate)).toBe(false);
  });

  test("requires the clean-install evidence to match its expected major", () => {
    const evidence = createCleanInstallEvidence(15);
    const wrongVersion = {
      ...evidence,
      environment: { ...evidence.environment, macOSVersion: "14.7.8" },
    };

    expect(isMacOSCleanInstallEvidence(evidence)).toBe(true);
    expect(isMacOSCleanInstallEvidence(wrongVersion)).toBe(false);
  });
});
