// Guards against the "flashing" loop the student saw in dev: the page reloading or
// re-rendering /live over and over, remounting the map each time. Watches /live for
// 30 s and requires one page load, the same map element throughout, at most 5
// refetches, and no console errors (including hydration mismatches).
// Run it against production too: PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:e2e
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test("the live page stays put: no reload loop, no map remounts, no errors", async ({ page }) => {
  const email = process.env.E2E_USER1_EMAIL;
  if (!email) throw new Error("Set E2E_USER1_EMAIL in .env.local");

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session));

  const errors: string[] = [];
  let pageLoads = 0; // full document loads of /live (a real reload)
  let serverRefetches = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname !== "/live") return;
    if (r.resourceType() === "document") pageLoads++;
    if (r.resourceType() === "fetch") serverRefetches++;
  });

  await page.goto("/live");
  await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Tag the map's element; if React or a reload replaces it, the tag disappears.
  const map = page.getByRole("region", { name: /Live map/ });
  await map.evaluate((el) => el.setAttribute("data-stability-tag", "original"));

  await page.waitForTimeout(30_000); // three worker runs

  expect(pageLoads, "page reloaded").toBe(1);
  await expect(page.locator('[data-stability-tag="original"]'), "map element was remounted").toHaveCount(1);
  // A normal visit makes 2-3 (the first data request, plus prefetching the header's
  // "Live map" link). The dev loop made about 190 in 30 s.
  expect(serverRefetches, "page kept re-requesting /live").toBeLessThanOrEqual(5);
  expect(errors, errors.join("\n")).toEqual([]);
});
