const gitCommitPattern = /^[a-f0-9]{40}$/;
const artifactDigestPattern = /^[a-f0-9]{64}$/;
const artifactReferenceDigestPattern = /^sha256:[a-f0-9]{64}$/;
const artifactIdPattern = /^[1-9]\d*$/;
const workflowRunIdPattern = /^[1-9]\d*$/;
const releaseTagPattern = /^cantiara-v.+$/;
const macOSVersionPattern = /^(14|15|26)(?:\.\d+)+$/;
const macOSArchitecturePattern = /^(?:arm64|x86_64)$/;
const evidenceIdPattern =
  /^client-shell\.macos-(?:package|clean-install)-[a-z0-9_-]+\.v1$/;
const artifactUrlPattern =
  /^https:\/\/github\.com\/.+\/actions\/runs\/[1-9]\d*\/artifacts\/[1-9]\d*$/;
const releaseAssetUrlPattern =
  /^https:\/\/github\.com\/.+\/releases\/download\/cantiara-v.+\/acceptance-candidate\.json$/;
const releaseEvidenceAssetUrlPattern =
  /^https:\/\/github\.com\/.+\/releases\/download\/cantiara-v.+\/macos-acceptance-evidence\.tar\.gz$/;

export const supportedMacOSMajors = [26, 15, 14] as const;

export const macOSPackageTargets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
] as const;

export type MacOSPackageTarget = (typeof macOSPackageTargets)[number];

interface MacOSWorkflowMetadata {
  ref: string;
  runAttempt: string;
  runId: string;
  sha: string;
}

interface MacOSPackageBackendContract {
  api: "hono-bun";
  localDataLayer: false;
  sourceOfTruth: "neon-postgresql";
}

interface MacOSPackageArtifact {
  kind: "dmg";
  name: string;
  sha256: string;
}

interface MacOSPackageEnvironment {
  macOSVersion: string;
  runnerArchitecture: string;
}

interface MacOSPackageChecks {
  codesign: "passed";
  gatekeeper: "passed";
  install: "passed";
  notarization: "passed";
}

interface MacOSAcceptanceTrace {
  acceptanceJourney: "macOS paket kabulü";
  evidenceId: string;
  fixture: "Sentetik fixture";
  seam: "Client Shell";
  testType: "exact-build platform matrix";
}

export interface MacOSPackageEvidence {
  acceptance: MacOSAcceptanceTrace;
  artifact: MacOSPackageArtifact;
  artifactReference?: MacOSArtifactReference;
  backend: MacOSPackageBackendContract;
  checks: MacOSPackageChecks;
  environment: MacOSPackageEnvironment;
  evidenceType: "signed-notarized-package";
  schemaVersion: "cantiara.macos-package-evidence/v1";
  sourceCommit: string;
  target: MacOSPackageTarget;
  workflow: MacOSWorkflowMetadata;
}

export interface MacOSArtifactReference {
  artifactDigest: string;
  artifactId: string;
  artifactName: string;
  artifactUrl: string;
  evidenceKey: string;
  manifestSha256: string;
  retentionDays: number;
}

interface MacOSReleaseAssetReference {
  name: "acceptance-candidate.json";
  url: string;
}

interface MacOSReleaseEvidenceAssetReference {
  name: "macos-acceptance-evidence.tar.gz";
  sha256: string;
  url: string;
}

type MacOSCleanInstallChecks = MacOSPackageChecks;

export interface MacOSCleanInstallEvidence {
  acceptance: MacOSAcceptanceTrace;
  artifact: MacOSPackageArtifact;
  artifactReference?: MacOSArtifactReference;
  backend: MacOSPackageBackendContract;
  checks: MacOSCleanInstallChecks;
  environment: MacOSPackageEnvironment;
  evidenceType: "clean-install";
  expectedMajor: (typeof supportedMacOSMajors)[number];
  packageTarget: MacOSPackageTarget;
  schemaVersion: "cantiara.macos-package-evidence/v1";
  sourceCommit: string;
  workflow: MacOSWorkflowMetadata;
}

interface MacOSAcceptanceCoverage {
  acceptanceJourney: "macOS paket kabulü";
  evidenceIds: string[];
  fixture: "Sentetik fixture";
  result: "passed";
  seam: "Client Shell";
  testType: "exact-build platform matrix";
}

export interface MacOSPackageAcceptanceCandidate {
  acceptanceCoverage: MacOSAcceptanceCoverage[];
  cleanInstallArtifactReferences: MacOSArtifactReference[];
  cleanInstallEvidence: MacOSCleanInstallEvidence[];
  evidenceType: "acceptance-candidate";
  packageArtifactReferences: MacOSArtifactReference[];
  packageEvidence: MacOSPackageEvidence[];
  releaseAsset: MacOSReleaseAssetReference;
  releaseEvidenceAsset: MacOSReleaseEvidenceAssetReference;
  releaseTag: string;
  result: "passed";
  schemaVersion: "cantiara.macos-package-acceptance/v1";
  sourceCommit: string;
  supportedMacOSMajors: readonly number[];
  workflow: MacOSWorkflowMetadata;
}

const supportedMacOSMajorSet = new Set<number>(supportedMacOSMajors);
const macOSPackageTargetSet = new Set<string>(macOSPackageTargets);

function cleanInstallEvidenceKey(
  major: (typeof supportedMacOSMajors)[number],
  target: MacOSPackageTarget,
) {
  return `${major}:${target}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isGitCommit(value: unknown): value is string {
  return typeof value === "string" && gitCommitPattern.test(value);
}

function isMacOSVersion(value: unknown): value is string {
  return typeof value === "string" && macOSVersionPattern.test(value);
}

function macOSMajor(value: string) {
  return Number.parseInt(value, 10);
}

function isMacOSArchitecture(value: unknown): value is string {
  return typeof value === "string" && macOSArchitecturePattern.test(value);
}

function isMacOSPackageTarget(value: unknown): value is MacOSPackageTarget {
  return typeof value === "string" && macOSPackageTargetSet.has(value);
}

function isSupportedMacOSMajor(
  value: unknown,
): value is (typeof supportedMacOSMajors)[number] {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    supportedMacOSMajorSet.has(value)
  );
}

function isWorkflowMetadata(value: unknown): value is MacOSWorkflowMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.ref) &&
    isNonEmptyString(value.runAttempt) &&
    workflowRunIdPattern.test(value.runAttempt) &&
    isNonEmptyString(value.runId) &&
    workflowRunIdPattern.test(value.runId) &&
    isGitCommit(value.sha)
  );
}

function isBackendContract(
  value: unknown,
): value is MacOSPackageBackendContract {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.api === "hono-bun" &&
    value.localDataLayer === false &&
    value.sourceOfTruth === "neon-postgresql"
  );
}

function isArtifact(value: unknown): value is MacOSPackageArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === "dmg" &&
    typeof value.name === "string" &&
    value.name.endsWith(".dmg") &&
    typeof value.sha256 === "string" &&
    artifactDigestPattern.test(value.sha256)
  );
}

function isArtifactReference(value: unknown): value is MacOSArtifactReference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.artifactDigest) &&
    artifactReferenceDigestPattern.test(value.artifactDigest) &&
    isNonEmptyString(value.artifactId) &&
    artifactIdPattern.test(value.artifactId) &&
    isNonEmptyString(value.artifactName) &&
    isNonEmptyString(value.artifactUrl) &&
    artifactUrlPattern.test(value.artifactUrl) &&
    value.artifactUrl.endsWith(`/${value.artifactId}`) &&
    isNonEmptyString(value.evidenceKey) &&
    isNonEmptyString(value.manifestSha256) &&
    artifactDigestPattern.test(value.manifestSha256) &&
    typeof value.retentionDays === "number" &&
    Number.isInteger(value.retentionDays) &&
    value.retentionDays > 0 &&
    value.retentionDays <= 90
  );
}

function isAcceptanceTrace(value: unknown): value is MacOSAcceptanceTrace {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.acceptanceJourney === "string" &&
    value.acceptanceJourney === "macOS paket kabulü" &&
    typeof value.evidenceId === "string" &&
    evidenceIdPattern.test(value.evidenceId) &&
    value.fixture === "Sentetik fixture" &&
    value.seam === "Client Shell" &&
    value.testType === "exact-build platform matrix"
  );
}

function isAcceptanceCoverage(
  value: unknown,
): value is MacOSAcceptanceCoverage {
  if (!(isRecord(value) && Array.isArray(value.evidenceIds))) {
    return false;
  }

  return (
    value.acceptanceJourney === "macOS paket kabulü" &&
    value.evidenceIds.length > 0 &&
    value.evidenceIds.every(
      (evidenceId) =>
        typeof evidenceId === "string" && evidenceIdPattern.test(evidenceId),
    ) &&
    value.fixture === "Sentetik fixture" &&
    value.result === "passed" &&
    value.seam === "Client Shell" &&
    value.testType === "exact-build platform matrix"
  );
}

function isReleaseAssetReference(
  value: unknown,
): value is MacOSReleaseAssetReference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.name === "acceptance-candidate.json" &&
    typeof value.url === "string" &&
    releaseAssetUrlPattern.test(value.url)
  );
}

function isReleaseEvidenceAssetReference(
  value: unknown,
): value is MacOSReleaseEvidenceAssetReference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.name === "macos-acceptance-evidence.tar.gz" &&
    typeof value.sha256 === "string" &&
    artifactDigestPattern.test(value.sha256) &&
    typeof value.url === "string" &&
    releaseEvidenceAssetUrlPattern.test(value.url)
  );
}

function isPackageEnvironment(
  value: unknown,
): value is MacOSPackageEnvironment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isMacOSVersion(value.macOSVersion) &&
    isMacOSArchitecture(value.runnerArchitecture)
  );
}

function isPackageChecks(value: unknown): value is MacOSPackageChecks {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.codesign === "passed" &&
    value.gatekeeper === "passed" &&
    value.install === "passed" &&
    value.notarization === "passed"
  );
}

function isCleanInstallChecks(
  value: unknown,
): value is MacOSCleanInstallChecks {
  return (
    isPackageChecks(value) && isRecord(value) && value.install === "passed"
  );
}

function isReferencedMacOSPackageEvidence(
  value: unknown,
): value is MacOSPackageEvidence & {
  artifactReference: MacOSArtifactReference;
} {
  return (
    isMacOSPackageEvidence(value) &&
    isArtifactReference(value.artifactReference)
  );
}

function isReferencedMacOSCleanInstallEvidence(
  value: unknown,
): value is MacOSCleanInstallEvidence & {
  artifactReference: MacOSArtifactReference;
} {
  return (
    isMacOSCleanInstallEvidence(value) &&
    isArtifactReference(value.artifactReference)
  );
}

function isSameArtifactReference(
  left: MacOSArtifactReference,
  right: MacOSArtifactReference,
) {
  return (
    left.artifactDigest === right.artifactDigest &&
    left.artifactId === right.artifactId &&
    left.artifactName === right.artifactName &&
    left.artifactUrl === right.artifactUrl &&
    left.evidenceKey === right.evidenceKey &&
    left.manifestSha256 === right.manifestSha256 &&
    left.retentionDays === right.retentionDays
  );
}

function isWorkflowForSource(
  value: MacOSWorkflowMetadata,
  candidate: MacOSPackageAcceptanceCandidate,
) {
  return (
    value.ref === candidate.workflow.ref &&
    value.runAttempt === candidate.workflow.runAttempt &&
    value.runId === candidate.workflow.runId &&
    value.sha === candidate.workflow.sha
  );
}

export function isMacOSPackageEvidence(
  value: unknown,
): value is MacOSPackageEvidence {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.evidenceType === "signed-notarized-package" &&
    value.schemaVersion === "cantiara.macos-package-evidence/v1" &&
    isGitCommit(value.sourceCommit) &&
    isWorkflowMetadata(value.workflow) &&
    isAcceptanceTrace(value.acceptance) &&
    isMacOSPackageTarget(value.target) &&
    value.acceptance.evidenceId ===
      `client-shell.macos-package-${value.target}.v1` &&
    isBackendContract(value.backend) &&
    isPackageEnvironment(value.environment) &&
    isArtifact(value.artifact) &&
    isPackageChecks(value.checks)
  );
}

export function isMacOSCleanInstallEvidence(
  value: unknown,
): value is MacOSCleanInstallEvidence {
  if (!(isRecord(value) && isCleanInstallChecks(value.checks))) {
    return false;
  }

  const { checks } = value;
  return (
    value.evidenceType === "clean-install" &&
    value.schemaVersion === "cantiara.macos-package-evidence/v1" &&
    isGitCommit(value.sourceCommit) &&
    isWorkflowMetadata(value.workflow) &&
    isAcceptanceTrace(value.acceptance) &&
    isSupportedMacOSMajor(value.expectedMajor) &&
    isMacOSPackageTarget(value.packageTarget) &&
    value.acceptance.evidenceId ===
      `client-shell.macos-clean-install-${value.expectedMajor}-${value.packageTarget}.v1` &&
    isBackendContract(value.backend) &&
    isPackageEnvironment(value.environment) &&
    macOSMajor(value.environment.macOSVersion) === value.expectedMajor &&
    isArtifact(value.artifact) &&
    checks.install === "passed"
  );
}

export function isMacOSPackageAcceptanceCandidate(
  value: unknown,
): value is MacOSPackageAcceptanceCandidate {
  if (!(isRecord(value) && isWorkflowMetadata(value.workflow))) {
    return false;
  }

  const candidate = value as unknown as MacOSPackageAcceptanceCandidate;
  if (
    candidate.evidenceType !== "acceptance-candidate" ||
    candidate.schemaVersion !== "cantiara.macos-package-acceptance/v1" ||
    candidate.result !== "passed" ||
    !isGitCommit(candidate.sourceCommit) ||
    !releaseTagPattern.test(candidate.releaseTag) ||
    !isReleaseAssetReference(candidate.releaseAsset) ||
    !isReleaseEvidenceAssetReference(candidate.releaseEvidenceAsset) ||
    !Array.isArray(candidate.acceptanceCoverage) ||
    candidate.acceptanceCoverage.length !== 1 ||
    !candidate.acceptanceCoverage.every(isAcceptanceCoverage) ||
    !Array.isArray(candidate.supportedMacOSMajors) ||
    candidate.supportedMacOSMajors.length !== supportedMacOSMajors.length ||
    !candidate.supportedMacOSMajors.every(
      (major, index) => major === supportedMacOSMajors[index],
    ) ||
    !Array.isArray(candidate.packageEvidence) ||
    candidate.packageEvidence.length !== macOSPackageTargets.length ||
    !candidate.packageEvidence.every(isReferencedMacOSPackageEvidence) ||
    !Array.isArray(candidate.packageArtifactReferences) ||
    candidate.packageArtifactReferences.length !== macOSPackageTargets.length ||
    !candidate.packageArtifactReferences.every(isArtifactReference) ||
    !Array.isArray(candidate.cleanInstallEvidence) ||
    candidate.cleanInstallEvidence.length !==
      supportedMacOSMajors.length * macOSPackageTargets.length ||
    !candidate.cleanInstallEvidence.every(
      isReferencedMacOSCleanInstallEvidence,
    ) ||
    !Array.isArray(candidate.cleanInstallArtifactReferences) ||
    candidate.cleanInstallArtifactReferences.length !==
      supportedMacOSMajors.length * macOSPackageTargets.length ||
    !candidate.cleanInstallArtifactReferences.every(isArtifactReference)
  ) {
    return false;
  }

  const packageTargets = new Set(
    candidate.packageEvidence.map((evidence) => evidence.target),
  );
  const cleanInstallMajors = new Set(
    candidate.cleanInstallEvidence.map((evidence) => evidence.expectedMajor),
  );
  const cleanInstallPairs = new Set(
    candidate.cleanInstallEvidence.map((evidence) =>
      cleanInstallEvidenceKey(evidence.expectedMajor, evidence.packageTarget),
    ),
  );
  const packageReferenceKeys = new Set(
    candidate.packageArtifactReferences.map(
      (reference) => reference.evidenceKey,
    ),
  );
  const cleanInstallReferenceKeys = new Set(
    candidate.cleanInstallArtifactReferences.map(
      (reference) => reference.evidenceKey,
    ),
  );
  const packageArtifactReferencesByKey = new Map(
    candidate.packageArtifactReferences.map((reference) => [
      reference.evidenceKey,
      reference,
    ]),
  );
  const cleanInstallArtifactReferencesByKey = new Map(
    candidate.cleanInstallArtifactReferences.map((reference) => [
      reference.evidenceKey,
      reference,
    ]),
  );
  const packageArtifactDigests = new Map(
    candidate.packageEvidence.map((evidence) => [
      evidence.target,
      evidence.artifact.sha256,
    ]),
  );
  const packageReferenceNames = new Set(
    candidate.packageArtifactReferences.map(
      (reference) => reference.artifactName,
    ),
  );
  const cleanInstallReferenceNames = new Set(
    candidate.cleanInstallArtifactReferences.map(
      (reference) => reference.artifactName,
    ),
  );
  const expectedCleanInstallPairs = new Set(
    supportedMacOSMajors.flatMap((major) =>
      macOSPackageTargets.map((target) =>
        cleanInstallEvidenceKey(major, target),
      ),
    ),
  );
  const artifactReferenceIds = new Set([
    ...candidate.packageArtifactReferences.map(
      (reference) => reference.artifactId,
    ),
    ...candidate.cleanInstallArtifactReferences.map(
      (reference) => reference.artifactId,
    ),
  ]);
  const artifactReferenceUrls = new Set([
    ...candidate.packageArtifactReferences.map(
      (reference) => reference.artifactUrl,
    ),
    ...candidate.cleanInstallArtifactReferences.map(
      (reference) => reference.artifactUrl,
    ),
  ]);
  const evidenceIds = new Set([
    ...candidate.packageEvidence.map(
      (evidence) => evidence.acceptance.evidenceId,
    ),
    ...candidate.cleanInstallEvidence.map(
      (evidence) => evidence.acceptance.evidenceId,
    ),
  ]);
  const coveredEvidenceIds = new Set(
    candidate.acceptanceCoverage[0].evidenceIds,
  );

  return (
    packageTargets.size === macOSPackageTargets.length &&
    macOSPackageTargets.every((target) => packageTargets.has(target)) &&
    cleanInstallMajors.size === supportedMacOSMajors.length &&
    supportedMacOSMajors.every((major) => cleanInstallMajors.has(major)) &&
    cleanInstallPairs.size === expectedCleanInstallPairs.size &&
    [...expectedCleanInstallPairs].every((pair) =>
      cleanInstallPairs.has(pair),
    ) &&
    packageReferenceKeys.size === macOSPackageTargets.length &&
    macOSPackageTargets.every((target) => packageReferenceKeys.has(target)) &&
    cleanInstallReferenceKeys.size === expectedCleanInstallPairs.size &&
    [...expectedCleanInstallPairs].every((pair) =>
      cleanInstallReferenceKeys.has(pair),
    ) &&
    packageReferenceNames.size === macOSPackageTargets.length &&
    macOSPackageTargets.every((target) =>
      candidate.packageArtifactReferences.some(
        (reference) =>
          reference.evidenceKey === target &&
          reference.artifactName === `macos-package-${target}`,
      ),
    ) &&
    candidate.packageArtifactReferences.every((reference) =>
      candidate.packageEvidence.some(
        (evidence) => evidence.target === reference.evidenceKey,
      ),
    ) &&
    candidate.packageEvidence.every((evidence) => {
      const reference = packageArtifactReferencesByKey.get(evidence.target);
      return (
        reference !== undefined &&
        isSameArtifactReference(evidence.artifactReference, reference)
      );
    }) &&
    cleanInstallReferenceNames.size === expectedCleanInstallPairs.size &&
    candidate.cleanInstallArtifactReferences.every((reference) => {
      const [major, target] = reference.evidenceKey.split(":");
      return (
        reference.artifactName === `macos-clean-install-${major}-${target}` &&
        expectedCleanInstallPairs.has(reference.evidenceKey) &&
        candidate.cleanInstallEvidence.some(
          (evidence) =>
            cleanInstallEvidenceKey(
              evidence.expectedMajor,
              evidence.packageTarget,
            ) === reference.evidenceKey,
        )
      );
    }) &&
    candidate.cleanInstallEvidence.every((evidence) => {
      const reference = cleanInstallArtifactReferencesByKey.get(
        cleanInstallEvidenceKey(evidence.expectedMajor, evidence.packageTarget),
      );
      return (
        reference !== undefined &&
        isSameArtifactReference(evidence.artifactReference, reference)
      );
    }) &&
    artifactReferenceIds.size ===
      macOSPackageTargets.length + expectedCleanInstallPairs.size &&
    artifactReferenceUrls.size ===
      macOSPackageTargets.length + expectedCleanInstallPairs.size &&
    candidate.releaseAsset.url.includes(
      `/releases/download/${candidate.releaseTag}/`,
    ) &&
    candidate.releaseEvidenceAsset.url.includes(
      `/releases/download/${candidate.releaseTag}/`,
    ) &&
    evidenceIds.size ===
      macOSPackageTargets.length + expectedCleanInstallPairs.size &&
    coveredEvidenceIds.size === evidenceIds.size &&
    candidate.acceptanceCoverage[0].evidenceIds.length === evidenceIds.size &&
    [...evidenceIds].every((evidenceId) =>
      coveredEvidenceIds.has(evidenceId),
    ) &&
    candidate.packageEvidence.every((evidence) =>
      isWorkflowForSource(evidence.workflow, candidate),
    ) &&
    candidate.cleanInstallEvidence.every((evidence) =>
      isWorkflowForSource(evidence.workflow, candidate),
    ) &&
    candidate.packageEvidence.every(
      (evidence) => evidence.sourceCommit === candidate.sourceCommit,
    ) &&
    candidate.cleanInstallEvidence.every(
      (evidence) => evidence.sourceCommit === candidate.sourceCommit,
    ) &&
    candidate.cleanInstallEvidence.every(
      (evidence) =>
        packageArtifactDigests.get(evidence.packageTarget) ===
        evidence.artifact.sha256,
    )
  );
}
