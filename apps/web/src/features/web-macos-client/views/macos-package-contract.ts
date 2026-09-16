const gitCommitPattern = /^[a-f0-9]{40}$/;
const artifactDigestPattern = /^[a-f0-9]{64}$/;
const workflowRunIdPattern = /^[1-9]\d*$/;
const releaseTagPattern = /^cantiara-v.+$/;
const macOSVersionPattern = /^(14|15|26)(?:\.\d+)+$/;
const macOSArchitecturePattern = /^(?:arm64|x86_64)$/;

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
  notarization: "passed";
}

export interface MacOSPackageEvidence {
  artifact: MacOSPackageArtifact;
  backend: MacOSPackageBackendContract;
  checks: MacOSPackageChecks;
  environment: MacOSPackageEnvironment;
  evidenceType: "signed-notarized-package";
  schemaVersion: "cantiara.macos-package-evidence/v1";
  sourceCommit: string;
  target: MacOSPackageTarget;
  workflow: MacOSWorkflowMetadata;
}

type MacOSCleanInstallChecks = MacOSPackageChecks & {
  install: "passed";
};

export interface MacOSCleanInstallEvidence {
  artifact: MacOSPackageArtifact;
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

export interface MacOSPackageAcceptanceCandidate {
  cleanInstallEvidence: MacOSCleanInstallEvidence[];
  evidenceType: "acceptance-candidate";
  packageEvidence: MacOSPackageEvidence[];
  releaseTag: string;
  result: "passed";
  schemaVersion: "cantiara.macos-package-acceptance/v1";
  sourceCommit: string;
  supportedMacOSMajors: readonly number[];
  workflow: MacOSWorkflowMetadata;
}

const supportedMacOSMajorSet = new Set<number>(supportedMacOSMajors);
const macOSPackageTargetSet = new Set<string>(macOSPackageTargets);

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
    isMacOSPackageTarget(value.target) &&
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
    isSupportedMacOSMajor(value.expectedMajor) &&
    isMacOSPackageTarget(value.packageTarget) &&
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
    !Array.isArray(candidate.supportedMacOSMajors) ||
    candidate.supportedMacOSMajors.length !== supportedMacOSMajors.length ||
    !candidate.supportedMacOSMajors.every(
      (major, index) => major === supportedMacOSMajors[index],
    ) ||
    !Array.isArray(candidate.packageEvidence) ||
    candidate.packageEvidence.length !== macOSPackageTargets.length ||
    !candidate.packageEvidence.every(isMacOSPackageEvidence) ||
    !Array.isArray(candidate.cleanInstallEvidence) ||
    candidate.cleanInstallEvidence.length !== supportedMacOSMajors.length ||
    !candidate.cleanInstallEvidence.every(isMacOSCleanInstallEvidence)
  ) {
    return false;
  }

  const packageTargets = new Set(
    candidate.packageEvidence.map((evidence) => evidence.target),
  );
  const cleanInstallMajors = new Set(
    candidate.cleanInstallEvidence.map((evidence) => evidence.expectedMajor),
  );

  return (
    packageTargets.size === macOSPackageTargets.length &&
    macOSPackageTargets.every((target) => packageTargets.has(target)) &&
    cleanInstallMajors.size === supportedMacOSMajors.length &&
    supportedMacOSMajors.every((major) => cleanInstallMajors.has(major)) &&
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
    )
  );
}
