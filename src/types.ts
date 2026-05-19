export type MouseButton = "left" | "right" | "middle";

export type Schedule =
  | { type: "oneShot"; runAt: string }
  | { type: "daily"; timeOfDay: string }
  | { type: "weekly"; days: string[]; timeOfDay: string }
  | { type: "repeatInterval"; intervalMs: number; maxRuns?: number; endAt?: string };

export type Safety = {
  countdownSeconds: number;
  stopHotkey: string;
};

export type AutomationTask = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: Schedule;
  steps: AutomationStep[];
  safety: Safety;
  runTarget: BrowserRunTarget;
  createdAt: string;
  updatedAt: string;
};

export type AutomationStep = BrowserElementStep | BrowserRefreshStep | ScreenCoordinateStep;

export type BrowserElementStep = {
  kind: "browserElement";
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

export type ScreenCoordinateStep = {
  kind: "screenCoordinate";
  x: number;
  y: number;
  button: MouseButton;
  clickCount: number;
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

export type BrowserRunTarget = ManagedBrowserProfileTarget | ExistingBrowserTabTarget;

export type ManagedBrowserProfileTarget = {
  mode: "managedProfile";
  browser: "chrome" | "edge";
  profileId: string;
  preopenSeconds: number;
  loginCheckUrl?: string;
  loginSuccessSelector?: string;
};

export type ExistingBrowserTabTarget = {
  mode: "existingTab";
  browser: "chrome" | "edge" | "any";
  preopenSeconds: number;
  tabUrlPattern: string;
  requireActiveTab: boolean;
  loginCheckUrl?: string;
  loginSuccessSelector?: string;
};

export type BrowserBridgeStatus = {
  port: number;
  paired: boolean;
  captureActive: boolean;
};

export type BrowserCaptureSession = {
  port: number;
  pairingToken: string;
};

export type CapturedBrowserElement = {
  url: string;
  selectorCandidates: SelectorCandidate[];
  textHint?: string;
  framePath: FrameTarget[];
  clickOffsetRatio: { x: number; y: number };
};

export type ExecutionStartResult = {
  taskId: string;
  status: "started";
};

export type LoginCheckResult = {
  status: "unchecked" | "checking" | "success" | "failed";
  message?: string;
};

export type ExecutionLog = {
  id: string;
  taskId: string;
  taskName: string;
  status: "started" | "success" | "stopped" | "missed" | "failed";
  message?: string;
  failureReason?: string;
  screenshotPath?: string;
  startedAt: string;
  finishedAt?: string;
};
