import { describe, expect, test } from "vitest";

import {
  isMacOSCleanInstallEvidence,
  isMacOSPackageAcceptanceCandidate,
  isMacOSPackageEvidence,
  type MacOSArtifactReference,
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

function createArtifactReference(evidenceKey: string) {
  const artifactIds: Record<string, string> = {
    "14": "987654324",
    "15": "987654325",
    "26": "987654326",
    "aarch64-apple-darwin": "987654321",
    "x86_64-apple-darwin": "987654322",
  };
  const artifactId = artifactIds[evidenceKey];
  if (!artifactId) {
    throw new Error(`Unknown evidence key: ${evidenceKey}`);
  }

  const artifactPrefix = evidenceKey.includes("darwin")
    ? "macos-package"
    : "macos-clean-install";
  return {
    artifactDigest: `sha256:${"c".repeat(64)}`,
    artifactId,
    artifactName: `${artifactPrefix}-${evidenceKey}`,
    artifactUrl: `https://github.com/UnderprotectionDev/cantiara/actions/runs/123456789/artifacts/${artifactId}`,
    evidenceKey,
    manifestSha256: digest,
    retentionDays: 90,
  } satisfies MacOSArtifactReference;
}

function createPackageEvidence(
  target: MacOSPackageEvidence["target"],
  runnerArchitecture: string,
) {
  return {
    acceptance: {
      acceptanceJourney: "macOS paket kabulü",
      evidenceId: `client-shell.macos-package-${target}.v1`,
      fixture: "Sentetik fixture",
      seam: "Client Shell",
      testType: "exact-build platform matrix",
    },
    artifact: {
      kind: "dmg",
      name: `cantiara_0.1.0_${target}.dmg`,
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
    acceptance: {
      acceptanceJourney: "macOS paket kabulü",
      evidenceId: `client-shell.macos-clean-install-${expectedMajor}.v1`,
      fixture: "Sentetik fixture",
      seam: "Client Shell",
      testType: "exact-build platform matrix",
    },
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
    acceptanceCoverage: [
      {
        acceptanceJourney: "macOS paket kabulü",
        evidenceIds: [
          ...macOSPackageTargets.map(
            (target) => `client-shell.macos-package-${target}.v1`,
          ),
          ...supportedMacOSMajors.map(
            (major) => `client-shell.macos-clean-install-${major}.v1`,
          ),
        ],
        fixture: "Sentetik fixture",
        result: "passed",
        seam: "Client Shell",
        testType: "exact-build platform matrix",
      },
    ],
    cleanInstallEvidence: supportedMacOSMajors.map(createCleanInstallEvidence),
    cleanInstallArtifactReferences: supportedMacOSMajors.map((major) =>
      createArtifactReference(String(major)),
    ),
    evidenceType: "acceptance-candidate",
    packageEvidence: [
      createPackageEvidence(macOSPackageTargets[0], "arm64"),
      createPackageEvidence(macOSPackageTargets[1], "arm64"),
    ],
    packageArtifactReferences: macOSPackageTargets.map(createArtifactReference),
    releaseTag: "cantiara-v0.1.0",
    releaseAsset: {
      name: "acceptance-candidate.json",
      url: "https://github.com/UnderprotectionDev/cantiara/releases/download/cantiara-v0.1.0/acceptance-candidate.json",
    },
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

  test("rejects clean-install evidence for a different package digest", () => {
    const candidate = createCandidate();
    const mismatchedCandidate = {
      ...candidate,
      cleanInstallEvidence: candidate.cleanInstallEvidence.map((evidence) =>
        evidence.expectedMajor === 14
          ? {
              ...evidence,
              artifact: { ...evidence.artifact, sha256: "c".repeat(64) },
            }
          : evidence,
      ),
    };

    expect(isMacOSPackageAcceptanceCandidate(mismatchedCandidate)).toBe(false);
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
