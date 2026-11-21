#!/usr/bin/env node
// Screenshot every key page for the README.
// Requires the mock-data dev server to be running:
//   pnpm dev:mock      # starts on :3001 with MOCK_DATA=true + DEV_AUTH_BYPASS=true
// Then in another terminal:
//   pnpm screenshots
//
// Output: docs/screenshots/{name}.png at 1440×900.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = "docs/screenshots";

const PAGES = [
  { name: "dashboard", path: "/" },
  { name: "plan", path: "/plan" },
  { name: "activities", path: "/activities" },
  // Pick a representative activity (the threshold workout in mock data has streams + analysis)
  { name: "activity", path: "/activities/10000000011" },
  { name: "shoes", path: "/shoes" },
  { name: "fitness", path: "/fitness" },
  { name: "stats", path: "/stats" },
  { name: "races", path: "/races" },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();

for (const { name, path } of PAGES) {
  const url = `${BASE}${path}`;
  console.log(`→ ${url}`);
  try {
    // Map tiles can keep the network busy indefinitely, so a networkidle
    // timeout just means "screenshot what's loaded".
    await page
      .goto(url, { waitUntil: "networkidle", timeout: 15_000 })
      .catch((e) => {
        if (!e.message.includes("Timeout")) throw e;
      });
    // Hide the Next.js dev-tools badge so it doesn't end up in the shots.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    // Let any post-mount animations settle (sparklines, ring fills)
    await page.waitForTimeout(800);
    const out = `${OUT_DIR}/${name}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log(`   saved ${out}`);
  } catch (e) {
    console.error(`   failed: ${e.message}`);
  }
}

await browser.close();
console.log("\nDone.");
