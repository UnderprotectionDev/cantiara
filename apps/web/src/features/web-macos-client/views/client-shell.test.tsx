import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import {
  ClientShellProvider,
  ClientShellStatus,
  createClientShell,
} from "./client-shell";

describe("Client Shell", () => {
  test("shows the offline state with the Account-formatted last save and risk", () => {
    const shell = createClientShell({
      initialConnection: "offline",
      initialLastSavedAt: new Date("2026-09-16T09:00:00.000Z"),
      initialUnsavedChanges: true,
    });

    const html = renderToStaticMarkup(
      <ClientShellProvider
        accountFormattingPreferences={{
          locale: "en-GB",
          timeZone: "Europe/Istanbul",
        }}
        shell={shell}
      >
        <ClientShellStatus />
      </ClientShellProvider>,
    );

    expect(html).toContain("You’re offline");
    expect(html).toContain("Last saved");
    expect(html).toContain("16 Sept 2026, 12:00");
    expect(html).toContain("Unsaved changes may be lost");
    expect(html).toContain('role="status"');
  });

  test("does not show the unsaved risk when no changes are at risk", () => {
    const shell = createClientShell({
      initialConnection: "offline",
      initialLastSavedAt: new Date("2026-09-16T09:00:00.000Z"),
    });

    const html = renderToStaticMarkup(
      <ClientShellProvider shell={shell}>
        <ClientShellStatus />
      </ClientShellProvider>,
    );

    expect(html).not.toContain("Unsaved changes may be lost");
  });

  test("uses the Account locale and time zone for the last saved value", () => {
    const shell = createClientShell({
      initialConnection: "offline",
      initialLastSavedAt: new Date("2026-09-16T09:00:00.000Z"),
    });

    const html = renderToStaticMarkup(
      <ClientShellProvider
        accountFormattingPreferences={{
          locale: "en-US",
          timeZone: "America/New_York",
        }}
        shell={shell}
      >
        <ClientShellStatus />
      </ClientShellProvider>,
    );

    expect(html).toContain("Sep 16, 2026, 5:00 AM");
  });

  test("refuses an offline write without replaying it after reconnect", async () => {
    const shell = createClientShell({
      initialConnection: "offline",
      initialUnsavedChanges: true,
      now: () => new Date("2026-09-16T10:00:00.000Z"),
    });
    const write = vi.fn().mockResolvedValue("saved");

    await expect(shell.runWrite(write)).rejects.toMatchObject({
      name: "ClientShellOfflineError",
    });
    expect(write).not.toHaveBeenCalled();

    shell.setConnectionState("online");
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();

    await expect(shell.runWrite(write)).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
    expect(shell.getState().lastSavedAt).toBeInstanceOf(Date);
    expect(shell.getState().hasUnsavedChanges).toBe(false);
    expect(shell.getState().lastSavedAt?.toISOString()).toBe(
      "2026-09-16T10:00:00.000Z",
    );
  });

  test("does not send a product request while offline", async () => {
    const shell = createClientShell({ initialConnection: "offline" });
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      shell.request(
        "https://api.cantiara.example/rpc/records",
        undefined,
        fetcher,
      ),
    ).rejects.toMatchObject({ name: "ClientShellOfflineError" });

    expect(fetcher).not.toHaveBeenCalled();
  });

  test("marks the connection offline after a network request failure", async () => {
    const shell = createClientShell({ initialConnection: "online" });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      shell.request(
        "https://api.cantiara.example/rpc/records",
        undefined,
        fetcher,
      ),
    ).rejects.toThrow("Failed to fetch");

    expect(shell.getState().connection).toBe("offline");
  });
});
