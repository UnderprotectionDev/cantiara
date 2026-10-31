import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  EXIT_DEFAULT_DOWNLOAD_WINDOW_MS,
  EXIT_MAX_DOWNLOAD_WINDOW_MS,
  type ExitManifest,
  type ExitPackageDownload,
  ExitPackageError,
  type ExitPackageProduction,
  type ExitPackageSource,
  type ExitPackageSuccess,
  produceExitPackageInputSchema,
} from "@cantiara/api/workspace-exit-package";

import { assembleExitPackage, packExitPackage } from "./exit-package-archive";
import { sealExitPackage } from "./exit-package-envelope";

/** What the store keeps of one package. The password and plaintext never reach it. */
export interface StoredExitPackage {
  accountId: string;
  ciphertext: Uint8Array;
  expiresAt: Date;
  packageId: string;
  producedAt: Date;
  revokedAt: Date | null;
  tokenDigest: string;
}

/**
 * Persistence port. An Account holds at most one downloadable package, so a
 * new one replaces the old (`replaceActive`): there is no restore-point
 * library. The success record outlives the download window (spec 84 gate).
 */
export interface ExitPackageStore {
  findByTokenDigest: (digest: string) => Promise<StoredExitPackage | null>;
  lastSuccess: (accountId: string) => Promise<ExitPackageSuccess | null>;
  recordSuccess: (
    accountId: string,
    success: ExitPackageSuccess,
  ) => Promise<void>;
  replaceActive: (record: StoredExitPackage) => Promise<void>;
  revoke: (accountId: string, packageId: string, at: Date) => Promise<boolean>;
}

export interface WorkspaceExitPackage {
  /** The ciphertext behind a download token, or a stable refusal. */
  download: (token: string) => Promise<Uint8Array>;
  /** Content and exclusion contract only: no artifact, nothing is stored. */
  preview: (input: { accountId: string }) => Promise<ExitManifest>;
  produce: (input: {
    accountId: string;
    downloadWindowMs?: number;
    password: string;
  }) => Promise<ExitPackageProduction>;
  revoke: (input: { accountId: string; packageId: string }) => Promise<void>;
  /** Spec 84 asks this before permanent delete; 84 enforces the rule. */
  successfulProduction: (input: {
    accountId: string;
  }) => Promise<ExitPackageSuccess | null>;
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createWorkspaceExitPackage(deps: {
  now?: () => Date;
  source: ExitPackageSource;
  store: ExitPackageStore;
}): WorkspaceExitPackage {
  const now = deps.now ?? (() => new Date());

  async function load(accountId: string) {
    const files = await deps.source.read({ accountId });
    if (!files) {
      throw new ExitPackageError(
        "source_unavailable",
        "The Workspace is not readable for this Account.",
      );
    }
    return files;
  }

  return {
    async download(token) {
      const stored = await deps.store.findByTokenDigest(digest(token));
      if (!stored) {
        throw new ExitPackageError(
          "download_not_found",
          "This download link is not valid.",
        );
      }
      if (stored.revokedAt) {
        throw new ExitPackageError(
          "download_revoked",
          "This download link was revoked.",
        );
      }
      if (stored.expiresAt <= now()) {
        throw new ExitPackageError(
          "download_expired",
          "This download link has expired.",
        );
      }
      return stored.ciphertext;
    },

    async preview({ accountId }) {
      return assembleExitPackage(await load(accountId), now()).manifest;
    },

    async produce({ accountId, ...input }) {
      const parsed = produceExitPackageInputSchema.safeParse(input);
      if (!parsed.success) {
        if (
          parsed.error.issues.length > 0 &&
          parsed.error.issues.every(
            (issue) => issue.path[0] === "downloadWindowMs",
          )
        ) {
          throw new ExitPackageError(
            "invalid_download_window",
            "The download window is a positive number of milliseconds.",
          );
        }
        throw new ExitPackageError(
          "invalid_password",
          "Enter a password of at least 12 characters.",
        );
      }
      const windowMs =
        parsed.data.downloadWindowMs ?? EXIT_DEFAULT_DOWNLOAD_WINDOW_MS;
      if (windowMs > EXIT_MAX_DOWNLOAD_WINDOW_MS) {
        throw new ExitPackageError(
          "invalid_download_window",
          "The download window is at most 30 days.",
        );
      }
      const producedAt = now();
      const assembled = assembleExitPackage(await load(accountId), producedAt);
      const ciphertext = sealExitPackage(
        packExitPackage(assembled),
        parsed.data.password,
      );
      const token = randomBytes(32).toString("base64url");
      const packageId = randomUUID();
      const expiresAt = new Date(producedAt.getTime() + windowMs);
      await deps.store.replaceActive({
        accountId,
        ciphertext,
        expiresAt,
        packageId,
        producedAt,
        revokedAt: null,
        tokenDigest: digest(token),
      });
      await deps.store.recordSuccess(accountId, {
        packageId,
        producedAt: producedAt.toISOString(),
      });
      const download: ExitPackageDownload = {
        expiresAt: expiresAt.toISOString(),
        packageId,
        token,
      };
      return { download, manifest: assembled.manifest, packageId };
    },

    async revoke({ accountId, packageId }) {
      const revoked = await deps.store.revoke(accountId, packageId, now());
      if (!revoked) {
        throw new ExitPackageError(
          "download_not_found",
          "This package is not available.",
        );
      }
    },

    successfulProduction({ accountId }) {
      return deps.store.lastSuccess(accountId);
    },
  };
}
