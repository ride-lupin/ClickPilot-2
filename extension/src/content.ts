import { buildSelectorCandidates, normalizedText, type SelectorCandidate } from "./selector";

type BrowserElementStep = {
  urlPattern: string;
  selectorCandidates: SelectorCandidate[];
  textHint?: string;
  clickOffsetRatio: { x: number; y: number };
  wait: { timeoutMs: number; pollIntervalMs: number; refreshBeforeWait: boolean };
  retry: { maxAttempts: number; retryDelayMs: number };
  delayAfterMs: number;
};

let captureEnabled = false;
let highlighted: HTMLElement | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CLICKPILOT_START_CAPTURE") {
    startCapture();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "CLICKPILOT_EXECUTE_STEPS") {
    void executeSteps(message.steps).then(sendResponse);
    return true;
  }
});

function startCapture() {
  captureEnabled = true;
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
}

function onMouseMove(event: MouseEvent) {
  if (!captureEnabled) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (highlighted) highlighted.style.outline = "";
  highlighted = target;
  highlighted.style.outline = "2px solid #14705d";
}

function onClick(event: MouseEvent) {
  if (!captureEnabled) return;
  event.preventDefault();
  event.stopPropagation();

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const rect = target.getBoundingClientRect();
  const payload = {
    url: window.location.href,
    selectorCandidates: buildSelectorCandidates(target),
    textHint: normalizedText(target),
    framePath: [],
    clickOffsetRatio: {
      x: clampRatio(rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5),
      y: clampRatio(rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5),
    },
  };

  stopCapture();
  chrome.runtime.sendMessage({ type: "CLICKPILOT_CAPTURED_ELEMENT", payload });
}

function stopCapture() {
  captureEnabled = false;
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClick, true);
  if (highlighted) highlighted.style.outline = "";
  highlighted = null;
}

async function executeSteps(steps: BrowserElementStep[]) {
  let clickedSteps = 0;
  for (const step of steps) {
    const result = await clickStep(step);
    if (!result.ok) return { status: "failed", reason: result.reason, clickedSteps };
    clickedSteps += 1;
    await delay(step.delayAfterMs);
  }
  return { status: "success", clickedSteps };
}

async function clickStep(step: BrowserElementStep): Promise<{ ok: true } | { ok: false; reason: string }> {
  for (let attempt = 0; attempt < step.retry.maxAttempts; attempt += 1) {
    const element = await waitForElement(step);
    if (element) {
      const rect = element.getBoundingClientRect();
      element.scrollIntoView({ block: "center", inline: "center" });
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width * step.clickOffsetRatio.x,
          clientY: rect.top + rect.height * step.clickOffsetRatio.y,
        }),
      );
      return { ok: true };
    }
    await delay(step.retry.retryDelayMs);
  }
  return { ok: false, reason: "elementNotFound" };
}

async function waitForElement(step: BrowserElementStep): Promise<HTMLElement | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < step.wait.timeoutMs) {
    const element = resolveElement(step.selectorCandidates);
    if (element) return element;
    await delay(step.wait.pollIntervalMs);
  }
  return null;
}

function resolveElement(candidates: SelectorCandidate[]): HTMLElement | null {
  for (const candidate of [...candidates].sort((a, b) => b.confidence - a.confidence)) {
    if (candidate.strategy === "css") {
      const match = document.querySelector(candidate.value);
      if (match instanceof HTMLElement) return match;
    }
    if (candidate.strategy === "text") {
      const match = Array.from(document.querySelectorAll("button,a,input,[role='button']")).find((element) =>
        normalizedText(element).includes(candidate.value),
      );
      if (match instanceof HTMLElement) return match;
    }
    if (candidate.strategy === "role") {
      const match = document.querySelector(`[aria-label*="${candidate.value.replace(/"/g, '\\"')}"]`);
      if (match instanceof HTMLElement) return match;
    }
  }
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}
