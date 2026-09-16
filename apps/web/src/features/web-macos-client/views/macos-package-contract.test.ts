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
const schemaVersion = `0002_medical_gorilla_man:${"e".repeat(64)}`;
const workflow = {
  ref: "UnderprotectionDev/cantiara/.github/workflows/macos-release.yml@refs/tags/cantiara-v0.1.0",
  runAttempt: "1",
  runId: "123456789",
  sha: sourceCommit,
};
const backend = {
  api: "hono-bun",
  localDataLayer: false,
  sourceOfTruth: "neon-postgresql",
} as const;
const packageDigests: Record<MacOSPackageEvidence["target"], string> = {
  [macOSPackageTargets[0]]: "b".repeat(64),
  [macOSPackageTargets[1]]: "d".repeat(64),
};
const manifestDigest = "e".repeat(64);

function createArtifactReference(evidenceKey: string) {
  const artifactIds: Record<string, string> = {
    "aarch64-apple-darwin": "987654321",
    "x86_64-apple-darwin": "987654322",
    "26:aarch64-apple-darwin": "987654323",
    "26:x86_64-apple-darwin": "987654324",
    "15:aarch64-apple-darwin": "987654325",
    "15:x86_64-apple-darwin": "987654326",
    "14:aarch64-apple-darwin": "987654327",
    "14:x86_64-apple-darwin": "987654328",
  };
  const artifactId = artifactIds[evidenceKey];
  if (!artifactId) {
    throw new Error(`Unknown evidence key: ${evidenceKey}`);
  }

  const isPackageReference =
    evidenceKey.includes("darwin") && !evidenceKey.includes(":");
  const artifactPrefix = isPackageReference
    ? "macos-package"
    : "macos-clean-install";
  const artifactName = isPackageReference
    ? `${artifactPrefix}-${evidenceKey}`
    : `${artifactPrefix}-${evidenceKey.replace(":", "-")}`;
  return {
    artifactDigest: `sha256:${"c".repeat(64)}`,
    artifactId,
    artifactName,
    artifactUrl: `https://github.com/UnderprotectionDev/cantiara/actions/runs/123456789/artifacts/${artifactId}`,
    evidenceKey,
    manifestSha256: manifestDigest,
    retentionDays: 90,
  } satisfies MacOSArtifactReference;
}

function createPackageEvidence(
  target: MacOSPackageEvidence["target"],
  runnerArchitecture: MacOSPackageEvidence["environment"]["runnerArchitecture"],
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
      sha256: packageDigests[target],
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
    manifestFormatVersion: "cantiara.macos-package-evidence/v1",
    result: "passed",
    schemaVersion,
    sourceCommit,
    target,
    workflow,
  } satisfies MacOSPackageEvidence;
}

function createCleanInstallEvidence(
  expectedMajor: MacOSCleanInstallEvidence["expectedMajor"],
  packageTarget: MacOSCleanInstallEvidence["packageTarget"],
) {
  return {
    acceptance: {
      acceptanceJourney: "macOS paket kabulü",
      evidenceId: `client-shell.macos-clean-install-${expectedMajor}-${packageTarget}.v1`,
      fixture: "Sentetik fixture",
      seam: "Client Shell",
      testType: "exact-build platform matrix",
    },
    artifact: {
      kind: "dmg",
      name: `cantiara_0.1.0_${packageTarget}.dmg`,
      sha256: packageDigests[packageTarget],
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
      runnerArchitecture:
        packageTarget === macOSPackageTargets[0] ? "arm64" : "x86_64",
    },
    evidenceType: "clean-install",
    expectedMajor,
    manifestFormatVersion: "cantiara.macos-package-evidence/v1",
    packageTarget,
    result: "passed",
    schemaVersion,
    sourceCommit,
    workflow,
  } satisfies MacOSCleanInstallEvidence;
}

function createCandidate() {
  const cleanInstallEvidence = supportedMacOSMajors.flatMap((major) =>
    macOSPackageTargets.map((target) =>
      createCleanInstallEvidence(major, target),
    ),
  );
  const cleanInstallArtifactReferences = supportedMacOSMajors.flatMap((major) =>
    macOSPackageTargets.map((target) =>
      createArtifactReference(`${major}:${target}`),
    ),
  );
  const packageArtifactReferences = macOSPackageTargets.map(
    createArtifactReference,
  );
  const packageEvidence = [
    createPackageEvidence(macOSPackageTargets[0], "arm64"),
    createPackageEvidence(macOSPackageTargets[1], "arm64"),
  ].map((evidence) => ({
    ...evidence,
    artifactReference: packageArtifactReferences.find(
      (reference) => reference.evidenceKey === evidence.target,
    ),
  }));
  const referencedCleanInstallEvidence = cleanInstallEvidence.map(
    (evidence) => ({
      ...evidence,
      artifactReference: cleanInstallArtifactReferences.find(
        (reference) =>
          reference.evidenceKey ===
          `${evidence.expectedMajor}:${evidence.packageTarget}`,
      ),
    }),
  );

  return {
    acceptanceCoverage: [
      {
        acceptanceJourney: "macOS paket kabulü",
        evidenceIds: [
          ...macOSPackageTargets.map(
            (target) => `client-shell.macos-package-${target}.v1`,
          ),
          ...cleanInstallEvidence.map(
            (evidence) => evidence.acceptance.evidenceId,
          ),
        ],
        fixture: "Sentetik fixture",
        result: "passed",
        seam: "Client Shell",
        testType: "exact-build platform matrix",
      },
    ],
    cleanInstallEvidence: referencedCleanInstallEvidence,
    cleanInstallArtifactReferences,
    evidenceType: "acceptance-candidate",
    packageEvidence,
    packageArtifactReferences,
    releaseTag: "cantiara-v0.1.0",
    releaseAsset: {
      name: "acceptance-candidate.json",
      url: "https://github.com/UnderprotectionDev/cantiara/releases/download/cantiara-v0.1.0/acceptance-candidate.json",
    },
    releaseEvidenceAsset: {
      name: "macos-acceptance-evidence.tar.gz",
      sha256: "f".repeat(64),
      url: "https://github.com/UnderprotectionDev/cantiara/releases/download/cantiara-v0.1.0/macos-acceptance-evidence.tar.gz",
    },
    result: "passed",
    manifestFormatVersion: "cantiara.macos-package-acceptance/v1",
    schemaVersion,
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
        (evidence) =>
          !(
            evidence.expectedMajor === 14 &&
            evidence.packageTarget === macOSPackageTargets[0]
          ),
      ),
    };

    expect(isMacOSPackageAcceptanceCandidate(candidate)).toBe(true);
    expect(isMacOSPackageAcceptanceCandidate(incompleteCandidate)).toBe(false);
  });

  test("accepts a workflow-dispatch ref from the selected branch", () => {
    const candidate = createCandidate();
    const manualDispatchWorkflow = {
      ...workflow,
      ref: "UnderprotectionDev/cantiara/.github/workflows/macos-release.yml@refs/heads/main",
    };
    const manualDispatchCandidate = {
      ...candidate,
      packageEvidence: candidate.packageEvidence.map((evidence) => ({
        ...evidence,
        workflow: manualDispatchWorkflow,
      })),
      cleanInstallEvidence: candidate.cleanInstallEvidence.map((evidence) => ({
        ...evidence,
        workflow: manualDispatchWorkflow,
      })),
      workflow: manualDispatchWorkflow,
    };

    expect(isMacOSPackageAcceptanceCandidate(manualDispatchCandidate)).toBe(
      true,
    );
  });

  test("requires a migration-backed schema version", () => {
    const candidate = createCandidate();
    const legacySchemaCandidate = {
      ...candidate,
      schemaVersion: "cantiara.macos-package-acceptance/v1",
    };

    expect(isMacOSPackageAcceptanceCandidate(legacySchemaCandidate)).toBe(
      false,
    );
  });

  test("requires an explicit result on every evidence record", () => {
    const candidate = createCandidate();
    const { result: _result, ...packageEvidenceWithoutResult } =
      candidate.packageEvidence[0];
    const missingResult = {
      ...candidate,
      packageEvidence: [
        packageEvidenceWithoutResult,
        ...candidate.packageEvidence.slice(1),
      ],
    };

    expect(isMacOSPackageAcceptanceCandidate(missingResult)).toBe(false);
  });

  test("rejects clean-install evidence for a different package digest", () => {
    const candidate = createCandidate();
    const mismatchedCandidate = {
      ...candidate,
      cleanInstallEvidence: candidate.cleanInstallEvidence.map((evidence) =>
        evidence.expectedMajor === 14 &&
        evidence.packageTarget === macOSPackageTargets[0]
          ? {
              ...evidence,
              artifact: { ...evidence.artifact, sha256: "c".repeat(64) },
            }
          : evidence,
      ),
    };

    expect(isMacOSPackageAcceptanceCandidate(mismatchedCandidate)).toBe(false);
  });

  test("rejects an artifact reference with a different artifact URL", () => {
    const candidate = createCandidate();
    const mismatchedReference = {
      ...candidate,
      packageArtifactReferences: candidate.packageArtifactReferences.map(
        (reference, index) =>
          index === 0
            ? {
                ...reference,
                artifactUrl: `${reference.artifactUrl.slice(0, -1)}2`,
              }
            : reference,
      ),
    };

    expect(isMacOSPackageAcceptanceCandidate(mismatchedReference)).toBe(false);
  });

  test("rejects a bare upload artifact digest", () => {
    const candidate = createCandidate();
    const packageArtifactReferences = candidate.packageArtifactReferences.map(
      (reference) => ({
        ...reference,
        artifactDigest: "c".repeat(64),
      }),
    );
    const bareDigestCandidate = {
      ...candidate,
      packageArtifactReferences,
      packageEvidence: candidate.packageEvidence.map((evidence) => ({
        ...evidence,
        artifactReference: packageArtifactReferences.find(
          (reference) => reference.evidenceKey === evidence.target,
        ),
      })),
    };

    expect(isMacOSPackageAcceptanceCandidate(bareDigestCandidate)).toBe(false);
  });

  test("rejects an artifact reference from another workflow run", () => {
    const candidate = createCandidate();
    const externalReference = {
      ...candidate.packageArtifactReferences[0],
      artifactUrl: `https://github.com/another-owner/another-repo/actions/runs/987654321/artifacts/${candidate.packageArtifactReferences[0].artifactId}`,
    };
    const externalArtifactCandidate = {
      ...candidate,
      packageArtifactReferences: [
        externalReference,
        ...candidate.packageArtifactReferences.slice(1),
      ],
      packageEvidence: [
        {
          ...candidate.packageEvidence[0],
          artifactReference: externalReference,
        },
        ...candidate.packageEvidence.slice(1),
      ],
    };

    expect(isMacOSPackageAcceptanceCandidate(externalArtifactCandidate)).toBe(
      false,
    );
  });

  test("rejects release assets from another repository or release tag", () => {
    const candidate = createCandidate();
    const externalReleaseAsset = {
      ...candidate,
      releaseAsset: {
        ...candidate.releaseAsset,
        url: "https://github.com/another-owner/another-repo/releases/download/cantiara-v0.1.0/acceptance-candidate.json",
      },
    };
    const mismatchedReleaseEvidenceAsset = {
      ...candidate,
      releaseEvidenceAsset: {
        ...candidate.releaseEvidenceAsset,
        url: "https://github.com/UnderprotectionDev/cantiara/releases/download/cantiara-v0.2.0/macos-acceptance-evidence.tar.gz",
      },
    };

    expect(isMacOSPackageAcceptanceCandidate(externalReleaseAsset)).toBe(false);
    expect(
      isMacOSPackageAcceptanceCandidate(mismatchedReleaseEvidenceAsset),
    ).toBe(false);
  });

  test("requires each evidence record to carry its matching artifact reference", () => {
    const candidate = createCandidate();
    const [firstReference, secondReference] =
      candidate.packageArtifactReferences;
    const [firstPackageEvidence] = candidate.packageEvidence;
    const mismatchedReference = {
      ...candidate,
      packageArtifactReferences: candidate.packageArtifactReferences.map(
        (reference, index) =>
          index === 0
            ? {
                ...reference,
                artifactDigest: secondReference.artifactDigest,
                artifactId: secondReference.artifactId,
                artifactUrl: secondReference.artifactUrl,
                manifestSha256: secondReference.manifestSha256,
              }
            : reference,
      ),
    };

    expect(firstReference.evidenceKey).toBe(
      firstPackageEvidence.artifactReference?.evidenceKey,
    );
    expect(isMacOSPackageAcceptanceCandidate(mismatchedReference)).toBe(false);
  });

  test("requires durable release evidence", () => {
    const candidate = createCandidate();
    const missingReleaseEvidence = {
      ...candidate,
      releaseEvidenceAsset: undefined,
    };

    expect(isMacOSPackageAcceptanceCandidate(missingReleaseEvidence)).toBe(
      false,
    );
  });

  test("requires the clean-install evidence to match its expected major", () => {
    const evidence = createCleanInstallEvidence(15, macOSPackageTargets[0]);
    const wrongVersion = {
      ...evidence,
      environment: { ...evidence.environment, macOSVersion: "14.7.8" },
    };

    expect(isMacOSCleanInstallEvidence(evidence)).toBe(true);
    expect(isMacOSCleanInstallEvidence(wrongVersion)).toBe(false);
  });
});
