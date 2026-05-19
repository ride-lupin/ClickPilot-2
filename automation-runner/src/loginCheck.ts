import type { Page } from "playwright-core";
import type { RunnerRequest } from "./protocol.js";

export async function verifyLogin(page: Page, request: RunnerRequest): Promise<boolean> {
  if (!request.loginCheckUrl && !request.loginSuccessSelector) return true;
  if (request.loginCheckUrl) await page.goto(request.loginCheckUrl, { waitUntil: "domcontentloaded" });
  if (!request.loginSuccessSelector) return true;
  return (await page.locator(request.loginSuccessSelector).count()) > 0;
}
