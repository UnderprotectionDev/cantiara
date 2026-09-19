import { isTauriRuntime } from "@/features/account-access/lib/tauri-session";

export interface TauriUpdateCandidate {
  downloadAndInstall: () => Promise<void>;
  version: string;
}

export interface TauriUpdaterDependencies {
  check: () => Promise<TauriUpdateCandidate | null>;
  isTauriRuntime?: () => boolean;
  relaunch?: () => Promise<void>;
}

export type TauriUpdateResult = "unsupported" | "not-available" | "updated";

async function checkWithTauriUpdater() {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) {
    return null;
  }

  return {
    downloadAndInstall: () => update.downloadAndInstall(),
    version: update.version,
  } satisfies TauriUpdateCandidate;
}

async function relaunchWithTauriProcess() {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export async function applyTauriUpdate(
  dependencies: TauriUpdaterDependencies = {
    check: checkWithTauriUpdater,
    relaunch: relaunchWithTauriProcess,
  },
): Promise<TauriUpdateResult> {
  const runtimeCheck = dependencies.isTauriRuntime ?? isTauriRuntime;
  if (!runtimeCheck()) {
    return "unsupported";
  }

  const update = await dependencies.check();
  if (!update) {
    return "not-available";
  }

  // Tauri's native updater verifies the signed artifact before installation.
  // Errors are deliberately propagated: the previous app remains the recovery path.
  await update.downloadAndInstall();
  if (dependencies.relaunch) {
    await dependencies.relaunch();
  }
  return "updated";
}
