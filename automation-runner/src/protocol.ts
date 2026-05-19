export type RunnerRequest = {
  taskId: string;
  taskName: string;
  profileDir: string;
  browser: "chrome" | "edge";
  loginCheckUrl?: string;
  loginSuccessSelector?: string;
  steps: BrowserElementStep[];
  screenshotDir: string;
};

export type BrowserElementStep = {
  urlPattern: string;
  selectorCandidates: SelectorCandidate[];
  textHint?: string;
  framePath: FrameTarget[];
  clickOffsetRatio: { x: number; y: number };
  wait: BrowserWaitPolicy;
  retry: BrowserRetryPolicy;
  delayAfterMs: number;
};

export type SelectorCandidate = {
  strategy: "css" | "text" | "role";
  value: string;
  confidence: number;
};

export type FrameTarget = {
  urlPattern: string;
  name?: string;
};

export type BrowserWaitPolicy = {
  timeoutMs: number;
  pollIntervalMs: number;
  refreshBeforeWait: boolean;
};

export type BrowserRetryPolicy = {
  maxAttempts: number;
  retryDelayMs: number;
};

export type RunnerResult =
  | {
      status: "success";
      screenshotPath: string;
      clickedSteps: number;
    }
  | {
      status: "failed";
      reason: "browserNotFound" | "loginCheckFailed" | "navigationFailed" | "elementNotFound" | "multipleElements" | "clickFailed";
      message: string;
      screenshotPath?: string;
      clickedSteps: number;
    };
