import type { Locator, Page } from "playwright-core";
import type { SelectorCandidate } from "./protocol.js";

export function locatorForCandidate(page: Page, candidate: SelectorCandidate): Locator {
  if (candidate.strategy === "css") return page.locator(candidate.value);
  if (candidate.strategy === "text") return page.getByText(candidate.value, { exact: false });
  return page.getByRole("button", { name: candidate.value });
}

export async function resolveLocator(page: Page, candidates: SelectorCandidate[]): Promise<Locator | null> {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  for (const candidate of sorted) {
    const locator = locatorForCandidate(page, candidate).first();
    if ((await locator.count()) > 0) return locator;
  }
  return null;
}
