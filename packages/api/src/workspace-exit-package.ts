import { z } from "zod";

/**
 * Workspace Exit Package contract (spec 82, ADR-0023). The package is a
 * password-encrypted, manifested archive of the whole Workspace. It is not a
 * Selected Export (spec 79), not an operator backup (spec 85) and it has no
 * in-product restore: this module exposes no restore or import vocabulary.
 */

export const WORKSPACE_EXIT_PACKAGE_LABEL = "Workspace Exit Package";

export const EXIT_PACKAGE_FORMAT = "cantiara-workspace-exit-package";
export const EXIT_PACKAGE_MANIFEST_VERSION = 1;
export const EXIT_PACKAGE_MANIFEST_PATH = "manifest.json";

/** Content families the package carries (PRD 13). */
export const EXIT_CONTENT_FAMILIES = [
  "content",
  "attachment-versions",
  "identities",
  "relations",
  "history",
  "configuration",
] as const;
export type ExitContentFamily = (typeof EXIT_CONTENT_FAMILIES)[number];

/** Classes that never enter the package (PRD 13). */
export const EXIT_EXCLUDED_CLASSES = [
  "sessions",
  "secrets",
  "external-access-keys",
  "operation-logs",
  "derived-caches",
  "capture-staging-attachments",
] as const;
export type ExitExcludedClass = (typeof EXIT_EXCLUDED_CLASSES)[number];

export const EXIT_FILE_KINDS = ["markdown", "json", "binary"] as const;
export type ExitFileKind = (typeof EXIT_FILE_KINDS)[number];

export const EXIT_NATURE_NOTE =
  "A Workspace Exit Package is a portable archive. It is not a Selected Export, an operator backup or a restore point, and Cantiara cannot restore it.";
export const EXIT_RESIDENCY_NOTE =
  "Producing this package does not move your data. Live data stays in the EU until permanent delete.";
export const EXIT_PASSWORD_NOTE =
  "The password is never stored. If you forget it, the package cannot be read and there is no recovery code or plaintext copy.";

export const exitManifestFileSchema = z
  .object({
    family: z.enum(EXIT_CONTENT_FAMILIES),
    kind: z.enum(EXIT_FILE_KINDS),
    path: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    size: z.number().int().min(0),
  })
  .strict();
export type ExitManifestFile = z.infer<typeof exitManifestFileSchema>;

export const exitManifestSchema = z
  .object({
    excludedClasses: z.array(z.enum(EXIT_EXCLUDED_CLASSES)),
    families: z.array(
      z
        .object({
          family: z.enum(EXIT_CONTENT_FAMILIES),
          fileCount: z.number().int().min(0),
        })
        .strict(),
    ),
    files: z.array(exitManifestFileSchema),
    format: z.literal(EXIT_PACKAGE_FORMAT),
    manifestVersion: z.literal(EXIT_PACKAGE_MANIFEST_VERSION),
    nature: z.literal(EXIT_NATURE_NOTE),
    producedAt: z.string(),
    residency: z.literal(EXIT_RESIDENCY_NOTE),
    /** Secret class values the seam removed, by key or credential class (never values). */
    removedSecretKeys: z.array(z.string()),
  })
  .strict();
export type ExitManifest = z.infer<typeof exitManifestSchema>;

/** One file a source hands to the package. The seam closes the world over it. */
export interface ExitSourceFile {
  content: string | Uint8Array;
  /** Set by a source that knows the entry belongs to an excluded class. */
  excludedClass?: ExitExcludedClass;
  family: ExitContentFamily;
  kind: ExitFileKind;
  path: string;
}

/** Read-only, access-checked source of the Account's whole Workspace. */
export interface ExitPackageSource {
  /** `null` when the Account has no readable Workspace. */
  read: (input: { accountId: string }) => Promise<ExitSourceFile[] | null>;
}

export type ExitPackageErrorCode =
  | "download_expired"
  | "download_not_found"
  | "download_revoked"
  | "invalid_download_window"
  | "invalid_password"
  | "invalid_path"
  | "package_unreadable"
  | "source_unavailable";

export class ExitPackageError extends Error {
  readonly code: ExitPackageErrorCode;

  constructor(
    code: ExitPackageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExitPackageError";
    this.code = code;
  }
}

export const EXIT_PASSWORD_MIN_LENGTH = 12;
export const EXIT_PASSWORD_MAX_LENGTH = 256;

export const produceExitPackageInputSchema = z
  .object({
    /** Optional: the closure freeze (84) asks for 30 days. Defaults to 24 hours. */
    downloadWindowMs: z.number().int().positive().optional(),
    password: z
      .string()
      .min(EXIT_PASSWORD_MIN_LENGTH)
      .max(EXIT_PASSWORD_MAX_LENGTH),
  })
  .strict();
export type ProduceExitPackageInput = z.infer<
  typeof produceExitPackageInputSchema
>;

export const EXIT_DEFAULT_DOWNLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EXIT_MAX_DOWNLOAD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface ExitPackageDownload {
  expiresAt: string;
  packageId: string;
  /** Shown once; only its SHA-256 digest is stored. */
  token: string;
}

export interface ExitPackageProduction {
  download: ExitPackageDownload;
  manifest: ExitManifest;
  packageId: string;
}

export interface ExitPackageSuccess {
  packageId: string;
  producedAt: string;
}

/**
 * Published, application-free envelope definition (`docs/workspace-exit-package-envelope.md`).
 * Header and ciphertext layout; the header is authenticated as AES-GCM AAD.
 */
export const EXIT_ENVELOPE_MAGIC = "CXEP";
export const EXIT_ENVELOPE_VERSION = 1;
export const EXIT_KDF = { N: 32_768, name: "scrypt", p: 1, r: 8 } as const;
export const EXIT_KDF_MAX_N = 2 ** 20;
