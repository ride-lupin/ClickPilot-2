import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright-core";

export async function saveScreenshot(page: Page, screenshotDir: string, name: string): Promise<string> {
  await mkdir(screenshotDir, { recursive: true });
  const path = join(screenshotDir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}
