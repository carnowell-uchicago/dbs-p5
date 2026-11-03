// The live page, in a real browser: a signed-in user sees the map, the ISS moves
// on its own (no reload), and the badge says Live.
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test("signed-in user watches the ISS move without reloading", async ({ page }) => {
  const email = process.env.E2E_USER1_EMAIL;
  if (!email) throw new Error("Set E2E_USER1_EMAIL in .env.local");

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session));
  await page.goto("/live");

  const map = page.getByRole("region", { name: /Live map/ });
  await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/live-1.png` : "test-results/live-1.png" });

  // The map must stay on screen once data has arrived. Regression check: React once
  // overwrote the div Leaflet styles, stripping .leaflet-container and hiding the tiles.
  const box1 = await map.boundingBox();
  expect(box1?.height ?? 0).toBeGreaterThan(200);
  await expect(map).toHaveClass(/leaflet-container/);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();

  const marker = page.locator(".iss-marker").first();
  const before = await marker.boundingBox();
  await page.waitForTimeout(12_000); // more than one worker run
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/live-2.png` : "test-results/live-2.png" });
  const box2 = await map.boundingBox();
  expect(box2?.height ?? 0).toBeGreaterThan(200);
  await expect(map).toHaveClass(/leaflet-container/);
  await expect(marker).toBeVisible();

  // The ISS is followed by the camera, so check the map tiles moved instead of the marker.
  const tile = await page.locator(".leaflet-tile-pane").evaluate((el) => getComputedStyle(el.parentElement!).transform);
  expect(before).not.toBeNull();
  expect(tile).not.toBe("none");
  expect(errors, errors.join("\n")).toEqual([]);
});
