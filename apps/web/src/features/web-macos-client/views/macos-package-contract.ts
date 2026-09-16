import { z } from "zod";

const gitCommitPattern = /^[a-f0-9]{40}$/;
const artifactDigestPattern = /^[a-f0-9]{64}$/;
const artifactReferenceDigestPattern = /^sha256:[a-f0-9]{64}$/;
const artifactIdPattern = /^[1-9]\d*$/;
const workflowRunIdPattern = /^[1-9]\d*$/;
const releaseTagPattern = /^cantiara-v.+$/;
const macOSVersionPattern = /^(14|15|26)(?:\.\d+)+$/;
const schemaVersionPattern = /^\d{4}_[A-Za-z0-9_-]+:[a-f0-9]{64}$/;
const evidenceIdPattern =
  /^client-shell\.macos-(?:package|clean-install)-[a-z0-9_-]+\.v1$/;
const workflowRefPattern =
  /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/\.github\/workflows\/macos-release\.yml@.+$/;
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

const macOSPackageTargetSchema = z.enum(macOSPackageTargets);
const supportedMacOSMajorSchema = z.union([
  z.literal(26),
  z.literal(15),
  z.literal(14),
]);
const macOSArchitectureSchema = z.enum(["arm64", "x86_64"]);
const gitCommitSchema = z.string().regex(gitCommitPattern);
const schemaVersionSchema = z.string().regex(schemaVersionPattern);
const macOSPackageEvidenceFormatVersion =
  "cantiara.macos-package-evidence/v1" as const;
const macOSPackageAcceptanceFormatVersion =
  "cantiara.macos-package-acceptance/v1" as const;
export type MacOSPackageTarget = z.infer<typeof macOSPackageTargetSchema>;

const workflowMetadataSchema = z.object({
  ref: z.string().min(1).regex(workflowRefPattern),
  runAttempt: z.string().regex(workflowRunIdPattern),
  runId: z.string().regex(workflowRunIdPattern),
  sha: gitCommitSchema,
});
type MacOSWorkflowMetadata = z.infer<typeof workflowMetadataSchema>;

const backendContractSchema = z.object({
  api: z.literal("hono-bun"),
  localDataLayer: z.literal(false),
  sourceOfTruth: z.literal("neon-postgresql"),
});

const packageArtifactSchema = z.object({
  kind: z.literal("dmg"),
  name: z.string().regex(/\.dmg$/),
  sha256: z.string().regex(artifactDigestPattern),
});

const packageEnvironmentSchema = z.object({
  macOSVersion: z.string().regex(macOSVersionPattern),
  runnerArchitecture: macOSArchitectureSchema,
});

const packageChecksSchema = z.object({
  codesign: z.literal("passed"),
  gatekeeper: z.literal("passed"),
  install: z.literal("passed"),
  notarization: z.literal("passed"),
});

const acceptanceTraceSchema = z.object({
  acceptanceJourney: z.literal("macOS paket kabulü"),
  evidenceId: z.string().regex(evidenceIdPattern),
  fixture: z.literal("Sentetik fixture"),
  seam: z.literal("Client Shell"),
  testType: z.literal("exact-build platform matrix"),
});

const artifactReferenceSchema = z
  .object({
    artifactDigest: z.string().regex(artifactReferenceDigestPattern),
    artifactId: z.string().regex(artifactIdPattern),
    artifactName: z.string().min(1),
    artifactUrl: z.string().regex(artifactUrlPattern),
    evidenceKey: z.string().min(1),
    manifestSha256: z.string().regex(artifactDigestPattern),
    retentionDays: z.number().int().positive().max(90),
  })
  .refine(
    (value) => value.artifactUrl.endsWith(`/${value.artifactId}`),
    "artifactUrl must end with artifactId",
  );
export type MacOSArtifactReference = z.infer<typeof artifactReferenceSchema>;

const releaseAssetReferenceSchema = z.object({
  name: z.literal("acceptance-candidate.json"),
  url: z.string().regex(releaseAssetUrlPattern),
});
type MacOSReleaseAssetReference = z.infer<typeof releaseAssetReferenceSchema>;

const releaseEvidenceAssetReferenceSchema = z.object({
  name: z.literal("macos-acceptance-evidence.tar.gz"),
  sha256: z.string().regex(artifactDigestPattern),
  url: z.string().regex(releaseEvidenceAssetUrlPattern),
});
type MacOSReleaseEvidenceAssetReference = z.infer<
  typeof releaseEvidenceAssetReferenceSchema
>;

const packageEvidenceSchema = z.object({
  acceptance: acceptanceTraceSchema,
  artifact: packageArtifactSchema,
  artifactReference: artifactReferenceSchema.optional(),
  backend: backendContractSchema,
  checks: packageChecksSchema,
  environment: packageEnvironmentSchema,
  evidenceType: z.literal("signed-notarized-package"),
  manifestFormatVersion: z.literal(macOSPackageEvidenceFormatVersion),
  result: z.literal("passed"),
  schemaVersion: schemaVersionSchema,
  sourceCommit: gitCommitSchema,
  target: macOSPackageTargetSchema,
  workflow: workflowMetadataSchema,
});
export type MacOSPackageEvidence = z.infer<typeof packageEvidenceSchema>;

const cleanInstallEvidenceSchema = z.object({
  acceptance: acceptanceTraceSchema,
  artifact: packageArtifactSchema,
  artifactReference: artifactReferenceSchema.optional(),
  backend: backendContractSchema,
  checks: packageChecksSchema,
  environment: packageEnvironmentSchema,
  evidenceType: z.literal("clean-install"),
  expectedMajor: supportedMacOSMajorSchema,
  manifestFormatVersion: z.literal(macOSPackageEvidenceFormatVersion),
  packageTarget: macOSPackageTargetSchema,
  result: z.literal("passed"),
  schemaVersion: schemaVersionSchema,
  sourceCommit: gitCommitSchema,
  workflow: workflowMetadataSchema,
});
export type MacOSCleanInstallEvidence = z.infer<
  typeof cleanInstallEvidenceSchema
>;

const acceptanceCoverageSchema = z.object({
  acceptanceJourney: z.literal("macOS paket kabulü"),
  evidenceIds: z.array(z.string().regex(evidenceIdPattern)).min(1),
  fixture: z.literal("Sentetik fixture"),
  result: z.literal("passed"),
  seam: z.literal("Client Shell"),
  testType: z.literal("exact-build platform matrix"),
});

const acceptanceCandidateSchema = z.object({
  acceptanceCoverage: z.array(acceptanceCoverageSchema),
  cleanInstallArtifactReferences: z.array(artifactReferenceSchema),
  cleanInstallEvidence: z.array(cleanInstallEvidenceSchema),
  evidenceType: z.literal("acceptance-candidate"),
  manifestFormatVersion: z.literal(macOSPackageAcceptanceFormatVersion),
  packageArtifactReferences: z.array(artifactReferenceSchema),
  packageEvidence: z.array(packageEvidenceSchema),
  releaseAsset: releaseAssetReferenceSchema,
  releaseEvidenceAsset: releaseEvidenceAssetReferenceSchema,
  releaseTag: z.string().regex(releaseTagPattern),
  result: z.literal("passed"),
  schemaVersion: schemaVersionSchema,
  sourceCommit: gitCommitSchema,
  supportedMacOSMajors: z.array(supportedMacOSMajorSchema).readonly(),
  workflow: workflowMetadataSchema,
});
export type MacOSPackageAcceptanceCandidate = z.infer<
  typeof acceptanceCandidateSchema
>;

function cleanInstallEvidenceKey(
  major: (typeof supportedMacOSMajors)[number],
  target: MacOSPackageTarget,
) {
  return `${major}:${target}`;
}

function macOSMajor(value: string) {
  return Number.parseInt(value, 10);
}

function isArtifactReference(value: unknown): value is MacOSArtifactReference {
  return artifactReferenceSchema.safeParse(value).success;
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

function workflowRepository(workflowRef: string) {
  return workflowRefPattern.exec(workflowRef)?.[1];
}

function isArtifactReferenceForWorkflow(
  reference: MacOSArtifactReference,
  workflow: MacOSWorkflowMetadata,
) {
  const repository = workflowRepository(workflow.ref);
  return (
    repository !== undefined &&
    reference.artifactUrl ===
      `https://github.com/${repository}/actions/runs/${workflow.runId}/artifacts/${reference.artifactId}`
  );
}

function isReleaseAssetForWorkflow(
  reference: MacOSReleaseAssetReference,
  candidate: MacOSPackageAcceptanceCandidate,
) {
  const repository = workflowRepository(candidate.workflow.ref);
  return (
    repository !== undefined &&
    reference.url ===
      `https://github.com/${repository}/releases/download/${candidate.releaseTag}/acceptance-candidate.json`
  );
}

function isReleaseEvidenceAssetForWorkflow(
  reference: MacOSReleaseEvidenceAssetReference,
  candidate: MacOSPackageAcceptanceCandidate,
) {
  const repository = workflowRepository(candidate.workflow.ref);
  return (
    repository !== undefined &&
    reference.url ===
      `https://github.com/${repository}/releases/download/${candidate.releaseTag}/macos-acceptance-evidence.tar.gz`
  );
}

export function isMacOSPackageEvidence(
  value: unknown,
): value is MacOSPackageEvidence {
  const parsed = packageEvidenceSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.acceptance.evidenceId ===
      `client-shell.macos-package-${parsed.data.target}.v1`
  );
}

export function isMacOSCleanInstallEvidence(
  value: unknown,
): value is MacOSCleanInstallEvidence {
  const parsed = cleanInstallEvidenceSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.acceptance.evidenceId ===
      `client-shell.macos-clean-install-${parsed.data.expectedMajor}-${parsed.data.packageTarget}.v1` &&
    macOSMajor(parsed.data.environment.macOSVersion) ===
      parsed.data.expectedMajor
  );
}

export function isMacOSPackageAcceptanceCandidate(
  value: unknown,
): value is MacOSPackageAcceptanceCandidate {
  const parsed = acceptanceCandidateSchema.safeParse(value);
  if (!parsed.success) {
    return false;
  }

  const candidate = parsed.data;
  if (
    candidate.acceptanceCoverage.length !== 1 ||
    candidate.supportedMacOSMajors.length !== supportedMacOSMajors.length ||
    !candidate.supportedMacOSMajors.every(
      (major, index) => major === supportedMacOSMajors[index],
    ) ||
    candidate.packageEvidence.length !== macOSPackageTargets.length ||
    !candidate.packageEvidence.every(isReferencedMacOSPackageEvidence) ||
    candidate.packageArtifactReferences.length !== macOSPackageTargets.length ||
    candidate.cleanInstallEvidence.length !==
      supportedMacOSMajors.length * macOSPackageTargets.length ||
    !candidate.cleanInstallEvidence.every(
      isReferencedMacOSCleanInstallEvidence,
    ) ||
    candidate.cleanInstallArtifactReferences.length !==
      supportedMacOSMajors.length * macOSPackageTargets.length ||
    !candidate.packageArtifactReferences.every(isArtifactReference) ||
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
    isReleaseAssetForWorkflow(candidate.releaseAsset, candidate) &&
    isReleaseEvidenceAssetForWorkflow(
      candidate.releaseEvidenceAsset,
      candidate,
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
    candidate.packageEvidence.every(
      (evidence) => evidence.schemaVersion === candidate.schemaVersion,
    ) &&
    candidate.cleanInstallEvidence.every(
      (evidence) => evidence.schemaVersion === candidate.schemaVersion,
    ) &&
    candidate.packageArtifactReferences.every((reference) =>
      isArtifactReferenceForWorkflow(reference, candidate.workflow),
    ) &&
    candidate.cleanInstallArtifactReferences.every((reference) =>
      isArtifactReferenceForWorkflow(reference, candidate.workflow),
    ) &&
    candidate.cleanInstallEvidence.every(
      (evidence) =>
        packageArtifactDigests.get(evidence.packageTarget) ===
        evidence.artifact.sha256,
    )
  );
}
