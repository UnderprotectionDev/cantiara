import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import {
  ClientShellContent,
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
    expect(html).toContain(">Retry<");
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

  test("keeps authenticated content out of the offline shell", () => {
    const shell = createClientShell({ initialConnection: "offline" });

    const html = renderToStaticMarkup(
      <ClientShellProvider shell={shell}>
        <ClientShellContent>
          <h1>Dashboard</h1>
        </ClientShellContent>
      </ClientShellProvider>,
    );

    expect(html).toContain("You’re offline");
    expect(html).not.toContain("Dashboard");
  });

  test("keeps feature recovery content mounted beside the offline status", () => {
    const shell = createClientShell({ initialConnection: "offline" });

    const html = renderToStaticMarkup(
      <ClientShellProvider shell={shell}>
        <ClientShellStatus />
        <h1>Draft editor</h1>
      </ClientShellProvider>,
    );

    expect(html).toContain("You’re offline");
    expect(html).toContain("Draft editor");
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

  test("does not record an online-only operation as a content save", async () => {
    const lastSavedAt = new Date("2026-09-16T09:00:00.000Z");
    const shell = createClientShell({
      initialLastSavedAt: lastSavedAt,
      initialUnsavedChanges: true,
    });

    await expect(shell.runOnlineOnly(async () => "revoked")).resolves.toBe(
      "revoked",
    );

    expect(shell.getState().hasUnsavedChanges).toBe(true);
    expect(shell.getState().lastSavedAt?.toISOString()).toBe(
      lastSavedAt.toISOString(),
    );
  });

  test("can release an offline state through an explicit retry", () => {
    vi.stubGlobal("navigator", { onLine: true });

    try {
      const shell = createClientShell({ initialConnection: "offline" });

      expect(shell.retryConnection()).toBe(true);
      expect(shell.getState().connection).toBe("online");
    } finally {
      vi.unstubAllGlobals();
    }
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

  test("marks the connection offline after a failure while the browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    try {
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
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("keeps a transient request failure retryable while the browser is online", async () => {
    vi.stubGlobal("navigator", { onLine: true });

    try {
      const shell = createClientShell({ initialConnection: "online" });
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(
        shell.request(
          "https://api.cantiara.example/rpc/records",
          undefined,
          fetcher,
        ),
      ).rejects.toThrow("Failed to fetch");
      expect(shell.getState().connection).toBe("online");

      await expect(
        shell.request(
          "https://api.cantiara.example/rpc/records",
          undefined,
          fetcher,
        ),
      ).resolves.toBeInstanceOf(Response);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
