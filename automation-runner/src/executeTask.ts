import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import type { BrowserElementStep, BrowserRefreshStep, RunnerRequest, RunnerResult } from "./protocol.js";
import { resolveLocator } from "./selector.js";
import { verifyLogin } from "./loginCheck.js";
import { saveScreenshot } from "./screenshot.js";

export async function executeTask(request: RunnerRequest): Promise<RunnerResult> {
  const context = await chromium.launchPersistentContext(request.profileDir, {
    channel: request.browser === "chrome" ? "chrome" : "msedge",
    headless: false,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  let clickedSteps = 0;

  try {
    const firstUrl = urlFromPattern(request.steps[0]?.urlPattern);
    if (!firstUrl) return { status: "failed", reason: "navigationFailed", message: "No browser URL was provided.", clickedSteps };
    await page.goto(firstUrl, { waitUntil: "domcontentloaded" });

    if (!(await verifyLogin(page, request))) {
      const screenshotPath = await saveScreenshot(page, request.screenshotDir, "login-failed");
      return { status: "failed", reason: "loginCheckFailed", message: "Login check failed.", screenshotPath, clickedSteps };
    }

    for (const step of request.steps) {
      const result = step.kind === "browserRefresh" ? await executeRefreshStep(page, step) : await executeStep(page, step);
      if (!result.ok) {
        const screenshotPath = await saveScreenshot(page, request.screenshotDir, result.reason);
        return { status: "failed", reason: result.reason, message: result.message, screenshotPath, clickedSteps };
      }
      if (step.kind !== "browserRefresh") clickedSteps += 1;
      await page.waitForTimeout(step.delayAfterMs);
    }

    const screenshotPath = await saveScreenshot(page, request.screenshotDir, "success");
    return { status: "success", screenshotPath, clickedSteps };
  } catch (error) {
    const screenshotPath = await saveScreenshot(page, request.screenshotDir, "failed").catch(() => undefined);
    return {
      status: "failed",
      reason: "clickFailed",
      message: error instanceof Error ? error.message : "Unknown automation error.",
      screenshotPath,
      clickedSteps,
    };
  } finally {
    await context.close();
  }
}

async function executeRefreshStep(page: Page, step: BrowserRefreshStep) {
  await page.reload({ waitUntil: "domcontentloaded" });
  if (step.urlPattern) {
    const ok = await waitForPageUrl(page, step.urlPattern, step.wait.timeoutMs, step.wait.pollIntervalMs);
    if (!ok) return { ok: false as const, reason: "navigationFailed" as const, message: `Page did not reach ${step.urlPattern} after refresh.` };
  }
  return { ok: true as const };
}

async function executeStep(page: Page, step: BrowserElementStep) {
  if (step.wait.refreshBeforeWait) await page.reload({ waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < step.retry.maxAttempts; attempt += 1) {
    const locator = await resolveLocator(page, step.selectorCandidates);
    if (locator) {
      await locator.waitFor({ timeout: step.wait.timeoutMs });
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) return { ok: false as const, reason: "elementNotFound" as const, message: "Element has no visible box." };
      await page.mouse.click(box.x + box.width * step.clickOffsetRatio.x, box.y + box.height * step.clickOffsetRatio.y);
      return { ok: true as const };
    }
    await page.waitForTimeout(step.retry.retryDelayMs);
  }

  return { ok: false as const, reason: "elementNotFound" as const, message: "Element was not found." };
}

function urlFromPattern(pattern?: string): string | null {
  if (!pattern) return null;
  return pattern.replace(/\*.*$/, "");
}

async function waitForPageUrl(page: Page, pattern: string, timeoutMs: number, pollIntervalMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (urlMatches(page.url(), pattern)) return true;
    await page.waitForTimeout(pollIntervalMs);
  }
  return false;
}

function urlMatches(url: string, pattern: string) {
  if (url === pattern) return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(url);
}
