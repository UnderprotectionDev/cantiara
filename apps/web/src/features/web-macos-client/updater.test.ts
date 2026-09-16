import { describe, expect, test, vi } from "vitest";

import { applyTauriUpdate } from "./updater";

describe("Client Shell Tauri updater", () => {
  test("does not attempt a desktop update in the web runtime", async () => {
    const check = vi.fn();

    await expect(
      applyTauriUpdate({ check, isTauriRuntime: () => false }),
    ).resolves.toBe("unsupported");
    expect(check).not.toHaveBeenCalled();
  });

  test("applies the update returned by the signature-verifying updater", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const relaunch = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyTauriUpdate({
        check: async () => ({
          downloadAndInstall,
          version: "0.2.0",
        }),
        isTauriRuntime: () => true,
        relaunch,
      }),
    ).resolves.toBe("updated");
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  test("rejects an invalid signature without replacing the previous version or rolling it back", async () => {
    const activeApp = { version: "0.1.0" };
    const updateVersion = "0.2.0";
    function createDownloadAndInstall(signatureIsValid: boolean) {
      return vi.fn(() => {
        if (!signatureIsValid) {
          return Promise.reject<void>(new Error("Invalid signature"));
        }
        activeApp.version = updateVersion;
        return Promise.resolve();
      });
    }
    const downloadAndInstall = createDownloadAndInstall(false);
    const relaunch = vi.fn().mockResolvedValue(undefined);

    await expect(
      applyTauriUpdate({
        check: async () => ({
          downloadAndInstall,
          version: updateVersion,
        }),
        isTauriRuntime: () => true,
        relaunch,
      }),
    ).rejects.toThrow("Invalid signature");

    expect(activeApp.version).toBe("0.1.0");
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).not.toHaveBeenCalled();
  });
});
