import { sendExecuteStepsWithFallback } from "./execution";

type ExistingTabExecutionRequest = {
  executionId: string;
  taskId: string;
  taskName: string;
  browser: "chrome" | "edge" | "any";
  tabUrlPattern: string;
  requireActiveTab: boolean;
  steps: unknown[];
};

let pollingInterval: number | undefined;
const pollAlarmName = "clickpilot-poll";

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLICKPILOT_CAPTURED_ELEMENT") {
    void postCapture(message.payload);
  }
  if (message.type === "CLICKPILOT_START_POLLING") {
    void schedulePolling();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void schedulePolling();
});

chrome.runtime.onStartup.addListener(() => {
  void schedulePolling();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === pollAlarmName) void pollAll();
});

async function postCapture(payload: unknown) {
  const { port, pairingToken } = (await chrome.storage.local.get(["port", "pairingToken"])) as {
    port?: number;
    pairingToken?: string;
  };
  if (!port || !pairingToken) return;

  await fetch(`http://127.0.0.1:${port}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ClickPilot-Token": pairingToken,
    },
    body: JSON.stringify(payload),
  });
}

async function schedulePolling() {
  void chrome.alarms.create(pollAlarmName, { periodInMinutes: 0.5 });
  void pollAll();
  if (pollingInterval) return;
  pollingInterval = globalThis.setInterval(() => void pollAll(), 1000);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.port || changes.pairingToken) void schedulePolling();
});

async function pollAll() {
  await pollCaptureRequest();
  await pollExistingTabExecution();
}

async function pollExistingTabExecution() {
  const { port, pairingToken } = (await chrome.storage.local.get(["port", "pairingToken"])) as {
    port?: number;
    pairingToken?: string;
  };
  if (!port || !pairingToken) return;
  const response = await fetch(`http://127.0.0.1:${port}/existing-tab/next`, {
    headers: { "X-ClickPilot-Token": pairingToken },
  }).catch(() => null);
  if (!response) return;
  if (response.status === 204 || !response.ok) return;
  const request = (await response.json()) as ExistingTabExecutionRequest;
  const result = await runExistingTab(request);
  await fetch(`http://127.0.0.1:${port}/existing-tab/result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ClickPilot-Token": pairingToken,
    },
    body: JSON.stringify(result),
  });
}

async function pollCaptureRequest() {
  const { port, pairingToken } = (await chrome.storage.local.get(["port", "pairingToken"])) as {
    port?: number;
    pairingToken?: string;
  };
  if (!port || !pairingToken) return;
  const response = await fetch(`http://127.0.0.1:${port}/capture/request`, {
    headers: { "X-ClickPilot-Token": pairingToken },
  }).catch(() => null);
  if (!response?.ok || response.status === 204) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  await activateCaptureInTab(tab.id);
}

async function activateCaptureInTab(tabId: number) {
  const response = await chrome.tabs.sendMessage(tabId, { type: "CLICKPILOT_START_CAPTURE" }).catch(() => null);
  if (response?.ok) return;

  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] }).catch(() => undefined);
  await chrome.tabs.sendMessage(tabId, { type: "CLICKPILOT_START_CAPTURE" }).catch(() => undefined);
}

async function runExistingTab(request: ExistingTabExecutionRequest) {
  const tabs = await chrome.tabs.query(request.requireActiveTab ? { active: true, currentWindow: true } : {});
  const tab = tabs.find((candidate) => candidate.id && candidate.url && urlMatches(candidate.url, request.tabUrlPattern));
  if (!tab?.id) {
    return {
      executionId: request.executionId,
      taskId: request.taskId,
      taskName: request.taskName,
      status: "failed",
      reason: "matchingTabNotFound",
      message: `No matching tab was found for ${request.tabUrlPattern}.`,
      clickedSteps: 0,
    };
  }

  await revealTab(tab);
  const response = await sendExecuteStepsWithFallback(chrome, tab.id, request.steps);
  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return {
    executionId: request.executionId,
    taskId: request.taskId,
    taskName: request.taskName,
    ...response,
    screenshotDataUrl,
  };
}

async function revealTab(tab: chrome.tabs.Tab) {
  if (tab.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
  if (tab.id !== undefined) {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
  }
}

function urlMatches(url: string, pattern: string) {
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
