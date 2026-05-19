type ChromeExecutionApi = {
  tabs: {
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
    get?: (tabId: number) => Promise<{ id?: number; url?: string; status?: string }>;
    reload?: (tabId: number) => Promise<unknown>;
  };
  scripting: {
    executeScript: (injection: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
  };
};

export type BrowserElementStep = {
  kind?: "browserElement";
  urlPattern?: string;
  wait?: { timeoutMs?: number; pollIntervalMs?: number; refreshBeforeWait?: boolean };
};

export type BrowserRefreshStep = {
  kind: "browserRefresh";
  urlPattern?: string;
  wait?: { timeoutMs?: number; pollIntervalMs?: number; refreshBeforeWait?: boolean };
  delayAfterMs?: number;
};

export type BrowserStep = BrowserElementStep | BrowserRefreshStep;

type TabLike = {
  id?: number;
  url?: string;
};

type StepRunOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export async function sendExecuteStepsWithFallback(api: ChromeExecutionApi, tabId: number, steps: unknown[]): Promise<Record<string, unknown>> {
  const message = { type: "CLICKPILOT_EXECUTE_STEPS", steps };
  const firstResponse = await api.tabs.sendMessage(tabId, message).catch(() => null);
  if (firstResponse && typeof firstResponse === "object") return firstResponse as Record<string, unknown>;

  await api.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] }).catch(() => undefined);
  const retryResponse = await api.tabs.sendMessage(tabId, message);
  return retryResponse && typeof retryResponse === "object" ? (retryResponse as Record<string, unknown>) : {};
}

export async function runStepsInTab(
  api: ChromeExecutionApi,
  tab: TabLike,
  steps: BrowserStep[],
  options: StepRunOptions = {},
): Promise<Record<string, unknown>> {
  if (!tab.id) {
    return { status: "failed", reason: "matchingTabNotFound", message: "No matching tab was found.", clickedSteps: 0 };
  }

  let clickedSteps = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const nextStep = steps[index + 1];
    if (step.kind === "browserRefresh") {
      const refreshResult = await runRefreshStep(api, tab.id, step, nextStep, options);
      if (!refreshResult.ok) {
        return {
          status: "failed",
          reason: "navigationFailed",
          message: `Tab did not reach ${step.urlPattern ?? nextStep?.urlPattern ?? "the expected URL"} after refresh.`,
          clickedSteps,
        };
      }
      continue;
    }

    let reachedNextUrlAfterInterruptedResponse = false;
    const response = await sendExecuteStepsWithFallback(api, tab.id, [step]).catch(async (error) => {
      if (nextStep?.urlPattern) {
        const waitResult = await waitForTabUrl(api, tab.id!, nextStep.urlPattern, {
          timeoutMs: options.timeoutMs ?? nextStep.wait?.timeoutMs ?? 15000,
          pollIntervalMs: options.pollIntervalMs ?? nextStep.wait?.pollIntervalMs ?? 100,
        });
        if (waitResult.ok) {
          reachedNextUrlAfterInterruptedResponse = true;
          return { status: "success", clickedSteps: 1 };
        }
      }
      throw error;
    });
    if (response.status === "failed") {
      return { ...response, clickedSteps };
    }

    clickedSteps += Number(response.clickedSteps ?? 1);

    if (nextStep?.urlPattern && !reachedNextUrlAfterInterruptedResponse) {
      const waitResult = await waitForTabUrl(api, tab.id, nextStep.urlPattern, {
        timeoutMs: options.timeoutMs ?? nextStep.wait?.timeoutMs ?? 15000,
        pollIntervalMs: options.pollIntervalMs ?? nextStep.wait?.pollIntervalMs ?? 100,
      });
      if (!waitResult.ok) {
        return {
          status: "failed",
          reason: "navigationFailed",
          message: `Tab did not reach ${nextStep.urlPattern}.`,
          clickedSteps,
        };
      }
    }
  }

  return { status: "success", clickedSteps };
}

async function runRefreshStep(
  api: ChromeExecutionApi,
  tabId: number,
  step: BrowserRefreshStep,
  nextStep: BrowserStep | undefined,
  options: StepRunOptions,
): Promise<{ ok: true } | { ok: false }> {
  if (!api.tabs.reload) return { ok: false };
  await api.tabs.reload(tabId);
  await delay(options.pollIntervalMs ?? step.wait?.pollIntervalMs ?? 100);

  const urlPattern = step.urlPattern ?? nextStep?.urlPattern;
  if (urlPattern) {
    return waitForTabUrl(api, tabId, urlPattern, {
      timeoutMs: options.timeoutMs ?? step.wait?.timeoutMs ?? 15000,
      pollIntervalMs: options.pollIntervalMs ?? step.wait?.pollIntervalMs ?? 100,
    });
  }

  await delay(step.delayAfterMs ?? 500);
  return { ok: true };
}

async function waitForTabUrl(
  api: ChromeExecutionApi,
  tabId: number,
  urlPattern: string,
  options: Required<StepRunOptions>,
): Promise<{ ok: true } | { ok: false }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < options.timeoutMs) {
    const tab = api.tabs.get ? await api.tabs.get(tabId).catch(() => null) : null;
    if (tab?.url && tab.status !== "loading" && urlMatches(tab.url, urlPattern)) return { ok: true };
    await delay(options.pollIntervalMs);
  }
  return { ok: false };
}

export function urlMatches(url: string, pattern: string) {
  if (url === pattern) return true;

  const normalizedUrl = normalizeComparableUrl(url);
  const normalizedPattern = normalizeComparableUrl(pattern);
  if (normalizedUrl && normalizedPattern && normalizedUrl === normalizedPattern) return true;

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(url);
}

function normalizeComparableUrl(value: string) {
  if (value.includes("*")) return null;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}`;
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
