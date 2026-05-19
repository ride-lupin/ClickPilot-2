export type RunnerRequest = {
  taskId: string;
  taskName: string;
  profileDir: string;
  browser: "chrome" | "edge";
  loginCheckUrl?: string;
  loginSuccessSelector?: string;
  steps: BrowserStep[];
  screenshotDir: string;
};

export type BrowserStep = BrowserElementStep | BrowserRefreshStep;

export type BrowserElementStep = {
  kind?: "browserElement";
  urlPattern: string;
  selectorCandidates: SelectorCandidate[];
  textHint?: string;
  framePath: FrameTarget[];
  clickOffsetRatio: { x: number; y: number };
  wait: BrowserWaitPolicy;
  retry: BrowserRetryPolicy;
  delayAfterMs: number;
};

export type BrowserRefreshStep = {
  kind: "browserRefresh";
  urlPattern?: string;
  wait: BrowserWaitPolicy;
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
