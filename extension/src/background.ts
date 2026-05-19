type ExistingTabExecutionRequest = {
  executionId: string;
  taskId: string;
  taskName: string;
  browser: "chrome" | "edge" | "any";
  tabUrlPattern: string;
  requireActiveTab: boolean;
  steps: unknown[];
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLICKPILOT_CAPTURED_ELEMENT") {
    void postCapture(message.payload);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void schedulePolling();
});

chrome.runtime.onStartup.addListener(() => {
  void schedulePolling();
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
  globalThis.setInterval(() => void pollExistingTabExecution(), 3000);
}

async function pollExistingTabExecution() {
  const { port, pairingToken } = (await chrome.storage.local.get(["port", "pairingToken"])) as {
    port?: number;
    pairingToken?: string;
  };
  if (!port || !pairingToken) return;
  const response = await fetch(`http://127.0.0.1:${port}/existing-tab/next`, {
    headers: { "X-ClickPilot-Token": pairingToken },
  });
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

async function runExistingTab(request: ExistingTabExecutionRequest) {
  const tabs = await chrome.tabs.query(request.requireActiveTab ? { active: true, currentWindow: true } : {});
  const tab = tabs.find((candidate) => candidate.id && candidate.url && urlMatches(candidate.url, request.tabUrlPattern));
  if (!tab?.id) {
    return {
      executionId: request.executionId,
      status: "failed",
      reason: "matchingTabNotFound",
      message: "No matching tab was found.",
      clickedSteps: 0,
    };
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: "CLICKPILOT_EXECUTE_STEPS", steps: request.steps });
  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return {
    executionId: request.executionId,
    ...response,
    screenshotDataUrl,
  };
}

function urlMatches(url: string, pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(url);
}
