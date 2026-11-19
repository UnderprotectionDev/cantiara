import { expect, test } from "@playwright/test";

for (const kind of ["audio", "video"]) {
  test(`File Attachment ${kind} preserves user-started playback, speed, loop and fullscreen`, async ({
    page,
  }) => {
    await page.goto(`/e2e/file-attachment-media.html?kind=${kind}`);
    const media = page.locator(kind);
    await expect(media).toBeVisible();
    await expect
      .poll(() =>
        media.evaluate((element: HTMLMediaElement) => element.readyState),
      )
      .toBeGreaterThan(0);
    expect(
      await media.evaluate((element: HTMLMediaElement) => element.paused),
    ).toBe(true);
    await expect(media).not.toHaveAttribute("autoplay");
    await page
      .getByRole("combobox", { name: "Playback speed" })
      .selectOption("1.5");
    await expect
      .poll(() =>
        media.evaluate((element: HTMLMediaElement) => element.playbackRate),
      )
      .toBe(1.5);
    await media.evaluate((element: HTMLMediaElement) => element.load());
    await expect
      .poll(() =>
        media.evaluate((element: HTMLMediaElement) => element.readyState),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        media.evaluate((element: HTMLMediaElement) => element.playbackRate),
      )
      .toBe(1.5);
    await page.getByRole("checkbox", { name: "Loop" }).check();
    await expect
      .poll(() => media.evaluate((element: HTMLMediaElement) => element.loop))
      .toBe(true);
    await page.getByRole("checkbox", { name: "Loop" }).uncheck();
    await expect
      .poll(() => media.evaluate((element: HTMLMediaElement) => element.loop))
      .toBe(false);
    await media.press("Space");
    await expect
      .poll(() =>
        media.evaluate((element: HTMLMediaElement) => element.currentTime),
      )
      .toBeGreaterThan(0);
    await media.press("Space");
    await expect
      .poll(() => media.evaluate((element: HTMLMediaElement) => element.paused))
      .toBe(true);
    await page.getByRole("button", { name: "Fullscreen" }).click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
  });
}
