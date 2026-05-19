# Browser Element Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework ClickPilot from a screen-coordinate clicker into a Windows/macOS desktop app that lets office users pick a Chrome/Edge page button visually, schedule it, verify login before execution, wait for the button to appear, retry safely, and save execution screenshots.

**Architecture:** Keep Tauri + React + Rust as the desktop shell, scheduler, storage, logs, and packaged app layer. Add a Chrome/Edge Manifest V3 extension for user-friendly element selection and optional execution in an existing browser tab, and add a Playwright/CDP sidecar runner for reliable scheduled execution through a dedicated ClickPilot browser profile.

**Tech Stack:** Tauri 2, React + TypeScript + Vite, Rust, Serde, Chrono, UUID, local JSON storage, Chrome/Edge Manifest V3 extension, Playwright Core, Node sidecar packaged as per-platform executables, Vitest, Testing Library, Rust unit tests, manual Windows/macOS smoke tests.

---

## Product Direction

This plan supersedes the absolute-coordinate-first MVP plan in `docs/superpowers/plans/2026-05-19-clickpilot-mvp.md`.

The new default workflow is:

- Office user creates a task in ClickPilot.
- User clicks `브라우저 버튼 선택`.
- Existing Chrome/Edge tab enters selection mode through the browser extension.
- User clicks the target button or link on the real site.
- ClickPilot stores URL pattern, selector candidates, element text, frame path, and element-relative click offset.
- Scheduled execution either opens a ClickPilot-managed Chrome/Edge automation profile or targets an already-open Chrome/Edge tab through the extension, depending on the task execution mode.
- ClickPilot checks whether the page is logged in.
- Playwright/CDP waits for the target element, scrolls it into view, clicks it, retries on configured transient failures, and stores a screenshot.

The existing OS coordinate click engine remains as a fallback step type. It is no longer the primary path.

The existing task-management UX must be preserved and improved while the browser automation architecture is added:

- New task creation remains available from the main command center.
- Coordinate fallback capture changes from a 3 second delay to a 2 second delay.
- Coordinate fallback capture shows a completion message after the point is saved.
- Each configured click step can be deleted individually.
- Schedule settings expose editable input fields instead of read-only schedule text.
- Existing tasks can be removed from the task list.
- Saved tasks can be run immediately from the task list or detail panel.
- Saved enabled tasks run automatically at their configured schedule while the desktop app is alive in the tray/menu bar.
- Users can choose between `전용 자동화 브라우저` execution and `기존에 열려 있는 브라우저 탭` execution per browser task.

## Key Decisions

- Chrome and Edge are supported first. Safari is excluded from this plan because Safari requires a separate Safari Web Extension packaging and a different automation path.
- Browser capture uses an extension because a desktop app cannot inspect the DOM of a normal existing Chrome/Edge tab.
- Initial internal rollout uses manual Chrome/Edge `Load unpacked` installation from `extension/dist` so a small employee pilot can start without waiting for store review or enterprise policy rollout.
- Scheduled execution uses Playwright/CDP because it is better than an extension background worker for time-based execution, page refresh, wait/retry behavior, screenshots, and failure diagnosis.
- Execution supports two browser target modes. `managedProfile` uses a dedicated ClickPilot browser profile and is recommended for unattended scheduled execution. `existingTab` uses the currently installed Chrome/Edge extension to find an already-open tab and click inside it; it is required for workflows that must use the user's currently open browser session.
- `existingTab` scheduled execution is best-effort. It requires the browser to be open, the extension to be installed and paired, a matching tab to exist, and the machine to remain awake. It is less reliable than `managedProfile` because the user can close the tab, change the page state, or leave the browser in a modal/prompt state.
- Browser action steps store element identity and an element-relative offset, not screen coordinates.
- Any CAPTCHA solving, ad clicking, anti-bot bypass, detection evasion, or security bypass behavior remains out of scope.

## Korean Reference Summary

이 계획은 기존 ClickPilot을 단순 화면 좌표 클릭 앱에서 브라우저 업무 자동화 앱으로 전환한다. 사용자는 사무직 직원 기준으로 개발자 도구나 CSS selector를 몰라도 된다. ClickPilot에서 `브라우저 버튼 선택`을 누르고, 평소 사용하는 Chrome 또는 Edge 탭에서 원하는 버튼을 직접 클릭하면 확장 프로그램이 해당 HTML 요소 정보를 저장한다.

예약 시간이 되면 ClickPilot은 작업 설정에 따라 두 방식 중 하나로 실행한다. 안정성이 중요한 작업은 Playwright/CDP 실행 엔진을 통해 전용 자동화 브라우저 프로필을 열고 실행한다. 사용자가 이미 열어둔 브라우저 세션을 반드시 써야 하는 작업은 Chrome/Edge 확장 프로그램이 기존 탭을 찾아 그 안에서 버튼을 클릭한다. 두 방식 모두 로그인 상태를 확인하고, 저장된 버튼이 나타날 때까지 기다렸다가 클릭하며, 실패하면 재시도하고 실패 사유와 스크린샷을 실행 로그에 남긴다.

Windows와 macOS 모두 설치 가능한 실행 프로그램으로 제공한다. 초기 회사 내부 파일럿은 Chrome/Edge 확장 프로그램을 `Load unpacked`로 수동 설치해서 가장 빠르게 사용을 시작한다. 조직 배포 정책이나 Chrome Web Store / Edge Add-ons 등록은 사용자가 늘어나거나 장기 운영으로 전환할 때 후속으로 진행한다. Safari는 이번 1차 구현 범위에서 제외한다.

기존 앱에서 부족했던 기본 UX도 함께 개선한다. 새 작업 생성, 좌표 fallback 캡처, 클릭 단계 개별 삭제, 스케줄 입력 필드, 생성된 작업 제거 기능을 명확한 테스트와 함께 구현한다.

생성된 작업은 두 방식으로 실행할 수 있어야 한다. 사용자는 작업 목록 또는 상세 화면에서 `즉시 실행`을 눌러 바로 실행할 수 있고, 활성화된 작업은 저장된 스케줄에 맞춰 자동 실행된다. 예약 실행은 앱이 완전히 종료되지 않고 tray/menu bar 프로세스로 살아 있을 때 보장한다. 기존 브라우저 탭 실행 모드는 Chrome/Edge가 열려 있고 대상 탭이 유지되어 있어야 한다.

## File Structure

Create or modify these files:

- `src/types.ts`: frontend `Step` union, browser target types, execution result types.
- `src/api.ts`: typed wrappers for new Tauri commands.
- `src/App.tsx`: top-level workflow state for capture, profile setup, task editor, run status, and logs.
- `src/App.test.tsx`: UI tests for browser step creation and execution result display.
- `src/components/TaskEditor.tsx`: task name, schedule, run profile, save flow.
- `src/components/StepEditor.tsx`: browser element step list, coordinate fallback step list, capture action.
- `src/components/ScheduleEditor.tsx`: editable schedule inputs for one-shot, daily, weekly, and repeat schedules.
- `src/components/BrowserCapturePanel.tsx`: extension pairing and capture status.
- `src/components/LoginCheckPanel.tsx`: automation profile login readiness.
- `src/components/ExecutionLogs.tsx`: screenshot links and structured failure reasons.
- `src/styles.css`: office-user-oriented capture, status, and log states.
- `src-tauri/src/models.rs`: Rust data model matching frontend step union.
- `src-tauri/src/validation.rs`: browser step validation and schedule safety rules.
- `src-tauri/src/storage.rs`: versioned JSON migration from coordinate-only tasks to mixed step tasks.
- `src-tauri/src/commands.rs`: new IPC commands for capture bridge, profile setup, execution, screenshot lookup.
- `src-tauri/src/browser_bridge.rs`: local localhost bridge for extension-to-app capture messages.
- `src-tauri/src/automation_runner.rs`: Rust wrapper that launches the Playwright sidecar and parses JSON results.
- `src-tauri/src/runner.rs`: dispatches browser steps through the sidecar and coordinate steps through existing native click engines.
- `src-tauri/src/existing_tab_runner.rs`: dispatches existing-tab browser execution requests through the extension bridge.
- `src-tauri/src/schedule.rs`: pre-run window support for browser jobs.
- `src-tauri/tauri.conf.json`: sidecar/resource bundle configuration.
- `automation-runner/package.json`: Playwright sidecar package.
- `automation-runner/src/index.ts`: sidecar CLI entrypoint.
- `automation-runner/src/protocol.ts`: JSON command/result protocol.
- `automation-runner/src/executeTask.ts`: Playwright task execution.
- `automation-runner/src/selector.ts`: selector candidate resolution and fallback scoring.
- `automation-runner/src/loginCheck.ts`: login status check helpers.
- `automation-runner/src/screenshot.ts`: screenshot path handling.
- `extension/manifest.json`: Chrome/Edge extension manifest.
- `extension/src/background.ts`: extension lifecycle and app bridge connection.
- `extension/src/content.ts`: selection overlay, DOM element capture, and existing-tab click execution.
- `extension/src/selector.ts`: selector candidate generation.
- `extension/src/popup.html`: pairing and status UI.
- `extension/src/popup.ts`: popup pairing/status behavior.
- `extension/vite.config.ts`: extension build config.
- `docs/manual-smoke-tests.md`: Windows/macOS desktop app, Chrome, and Edge smoke tests.
- `README.md`: install, extension pairing, profile login, packaging, and support notes.

## Data Model

Use this frontend shape in `src/types.ts`:

```ts
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

export type AutomationStep = BrowserElementStep | ScreenCoordinateStep;

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
```

Use matching Rust enums in `src-tauri/src/models.rs` with `#[serde(tag = "kind", rename_all = "camelCase")]` for `AutomationStep`.

## Task 1: Add Browser Step Data Model

**Files:**
- Modify: `src/types.ts`
- Modify: `src-tauri/src/models.rs`
- Modify: `src/App.test.tsx`
- Modify: `src-tauri/src/models.rs` tests

- [ ] **Step 1: Add a frontend failing test for browser step rendering**

Add this assertion to a new test in `src/App.test.tsx`:

```ts
it("shows a saved browser element step with its URL and text hint", async () => {
  apiMocks.listTasks.mockResolvedValue([
    {
      id: "task-browser-1",
      name: "오전 신청",
      enabled: true,
      schedule: { type: "daily", timeOfDay: "09:00" },
      runTarget: {
        mode: "managedProfile",
        browser: "chrome",
        profileId: "default",
        preopenSeconds: 30,
      },
      steps: [
        {
          kind: "browserElement",
          urlPattern: "https://example.com/apply*",
          selectorCandidates: [{ strategy: "css", value: "button.apply", confidence: 90 }],
          textHint: "신청하기",
          framePath: [],
          clickOffsetRatio: { x: 0.5, y: 0.5 },
          wait: { timeoutMs: 15000, pollIntervalMs: 100, refreshBeforeWait: true },
          retry: { maxAttempts: 3, retryDelayMs: 250 },
          delayAfterMs: 500,
        },
      ],
      safety: { countdownSeconds: 0, stopHotkey: "Ctrl+Alt+S" },
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z",
    },
  ]);

  render(<App />);

  expect(await screen.findByText("오전 신청")).toBeInTheDocument();
  expect(await screen.findByText("https://example.com/apply*")).toBeInTheDocument();
  expect(await screen.findByText("신청하기")).toBeInTheDocument();
});
```

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because the current step model only supports coordinate steps.

- [ ] **Step 2: Replace frontend click step type with a union**

In `src/types.ts`, replace the existing `ClickStep` type with `AutomationStep`, `BrowserElementStep`, and `ScreenCoordinateStep` from the Data Model section. Keep `MouseButton`, `Schedule`, `Safety`, `ExecutionLog`, and existing statuses.

Run:

```bash
npm run lint
```

Expected: FAIL at every component still reading `step.x` directly.

- [ ] **Step 3: Add matching Rust model union**

In `src-tauri/src/models.rs`, change `AutomationTask.steps` to `Vec<AutomationStep>` and define:

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AutomationStep {
    BrowserElement(BrowserElementStep),
    ScreenCoordinate(ScreenCoordinateStep),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserElementStep {
    pub url_pattern: String,
    pub selector_candidates: Vec<SelectorCandidate>,
    pub text_hint: Option<String>,
    pub frame_path: Vec<FrameTarget>,
    pub click_offset_ratio: OffsetRatio,
    pub wait: BrowserWaitPolicy,
    pub retry: BrowserRetryPolicy,
    pub delay_after_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCoordinateStep {
    pub x: i32,
    pub y: i32,
    pub button: MouseButton,
    pub click_count: u8,
    pub delay_after_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectorCandidate {
    pub strategy: SelectorStrategy,
    pub value: String,
    pub confidence: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SelectorStrategy {
    Css,
    Text,
    Role,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameTarget {
    pub url_pattern: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffsetRatio {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWaitPolicy {
    pub timeout_ms: u64,
    pub poll_interval_ms: u64,
    pub refresh_before_wait: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRetryPolicy {
    pub max_attempts: u8,
    pub retry_delay_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum BrowserRunTarget {
    ManagedProfile {
        browser: BrowserKind,
        profile_id: String,
        preopen_seconds: u32,
        login_check_url: Option<String>,
        login_success_selector: Option<String>,
    },
    ExistingTab {
        browser: ExistingTabBrowserKind,
        preopen_seconds: u32,
        tab_url_pattern: String,
        require_active_tab: bool,
        login_check_url: Option<String>,
        login_success_selector: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BrowserKind {
    Chrome,
    Edge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExistingTabBrowserKind {
    Chrome,
    Edge,
    Any,
}
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml models
```

Expected: FAIL until existing model tests are updated to use `kind: "screenCoordinate"`.

- [ ] **Step 4: Update existing coordinate fixtures**

Change existing task fixtures so each old coordinate step becomes:

```json
{
  "kind": "screenCoordinate",
  "x": 363,
  "y": 554,
  "button": "left",
  "clickCount": 1,
  "delayAfterMs": 800
}
```

Add this `runTarget` to task fixtures:

```json
{
  "mode": "managedProfile",
  "browser": "chrome",
  "profileId": "default",
  "preopenSeconds": 30
}
```

Run:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: tests that do not depend on the old step shape pass.

## Task 2: Validate Browser Tasks

**Files:**
- Modify: `src-tauri/src/validation.rs`
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Add Rust validation tests**

Add tests covering:

```rust
#[test]
fn browser_step_requires_url_pattern() {
    let mut task = browser_task_fixture();
    if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
        step.url_pattern.clear();
    }

    let error = validate_task(&task).unwrap_err();

    assert_eq!(error.code, "browser_url_required");
}

#[test]
fn browser_step_requires_selector_candidate() {
    let mut task = browser_task_fixture();
    if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
        step.selector_candidates.clear();
    }

    let error = validate_task(&task).unwrap_err();

    assert_eq!(error.code, "browser_selector_required");
}

#[test]
fn browser_step_rejects_zero_poll_interval() {
    let mut task = browser_task_fixture();
    if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
        step.wait.poll_interval_ms = 0;
    }

    let error = validate_task(&task).unwrap_err();

    assert_eq!(error.code, "browser_poll_interval_invalid");
}
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml validation
```

Expected: FAIL because validation does not inspect browser steps yet.

- [ ] **Step 2: Implement validation rules**

Add these rules:

- `urlPattern` must start with `http://` or `https://`.
- `selectorCandidates` must contain at least one candidate.
- `clickOffsetRatio.x` and `clickOffsetRatio.y` must be between `0.0` and `1.0`.
- `wait.timeoutMs` must be between `1000` and `120000`.
- `wait.pollIntervalMs` must be between `50` and `5000`.
- `retry.maxAttempts` must be between `1` and `10`.
- `runTarget.preopenSeconds` must be between `0` and `300`.
- `runTarget.mode = "existingTab"` must include `tabUrlPattern` starting with `http://` or `https://`.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml validation
```

Expected: PASS.

## Task 3: Build Chrome/Edge Element Capture Extension

**Files:**
- Create: `extension/package.json`
- Create: `extension/manifest.json`
- Create: `extension/src/content.ts`
- Create: `extension/src/selector.ts`
- Create: `extension/src/background.ts`
- Create: `extension/src/popup.html`
- Create: `extension/src/popup.ts`
- Create: `extension/vite.config.ts`

- [ ] **Step 1: Add extension package**

Create `extension/package.json`:

```json
{
  "name": "clickpilot-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest"
  },
  "devDependencies": {}
}
```

Run:

```bash
cd extension && npm install
```

Expected: `extension/package-lock.json` is created.

- [ ] **Step 2: Add Manifest V3 permissions**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "ClickPilot Button Picker",
  "version": "0.1.0",
  "description": "Select browser buttons for ClickPilot scheduled automation.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["<all_urls>", "http://127.0.0.1:27183/*"],
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup.html",
    "default_title": "ClickPilot"
  }
}
```

Run:

```bash
cd extension && npm run build
```

Expected: build emits `extension/dist`.

- [ ] **Step 3: Implement selector generation**

Create `extension/src/selector.ts` with functions that return candidates in this order:

```ts
export type SelectorCandidate = {
  strategy: "css" | "text" | "role";
  value: string;
  confidence: number;
};

export function buildSelectorCandidates(element: Element): SelectorCandidate[] {
  const candidates: SelectorCandidate[] = [];
  const id = element.getAttribute("id");
  const ariaLabel = element.getAttribute("aria-label");
  const text = normalizedText(element);

  if (id) {
    candidates.push({ strategy: "css", value: `#${cssEscape(id)}`, confidence: 95 });
  }

  if (ariaLabel) {
    candidates.push({
      strategy: "css",
      value: `[aria-label="${cssString(ariaLabel)}"]`,
      confidence: 88,
    });
    candidates.push({ strategy: "role", value: ariaLabel, confidence: 80 });
  }

  if (text) {
    candidates.push({ strategy: "text", value: text, confidence: 75 });
  }

  candidates.push({ strategy: "css", value: cssPath(element), confidence: 60 });

  return candidates;
}

export function normalizedText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cssPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return parts.join(" > ");
}
```

Run:

```bash
cd extension && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Implement selection overlay**

In `extension/src/content.ts`, implement capture mode:

```ts
import { buildSelectorCandidates, normalizedText } from "./selector";

let captureEnabled = false;
let highlighted: HTMLElement | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CLICKPILOT_START_CAPTURE") {
    captureEnabled = true;
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
  }
});

function onMouseMove(event: MouseEvent) {
  if (!captureEnabled) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (highlighted) highlighted.style.outline = "";
  highlighted = target;
  highlighted.style.outline = "2px solid #0066cc";
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
      x: rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5,
      y: rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5,
    },
  };

  captureEnabled = false;
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClick, true);
  if (highlighted) highlighted.style.outline = "";
  highlighted = null;

  chrome.runtime.sendMessage({ type: "CLICKPILOT_CAPTURED_ELEMENT", payload });
}
```

Run:

```bash
cd extension && npm run build
```

Expected: PASS.

## Task 4: Add Extension Pairing And Local Capture Bridge

**Files:**
- Create: `src-tauri/src/browser_bridge.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `extension/src/background.ts`
- Modify: `extension/src/popup.ts`
- Modify: `src/api.ts`
- Create: `src/components/BrowserCapturePanel.tsx`

- [ ] **Step 1: Add bridge status commands**

Add IPC commands:

```rust
#[tauri::command]
pub fn browser_bridge_status(state: State<AppState>) -> BrowserBridgeStatus {
    state.browser_bridge.status()
}

#[tauri::command]
pub fn start_browser_capture(state: State<AppState>) -> Result<BrowserCaptureSession, AppError> {
    state.browser_bridge.start_capture()
}
```

Expected returned shape:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBridgeStatus {
    pub port: u16,
    pub paired: bool,
    pub capture_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCaptureSession {
    pub port: u16,
    pub pairing_token: String,
}
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: compile fails until `AppState` owns `browser_bridge`.

- [ ] **Step 2: Implement localhost bridge**

Implement `src-tauri/src/browser_bridge.rs` as a small localhost server bound to `127.0.0.1:27183`. Required endpoints:

- `GET /status`: returns bridge status.
- `POST /pair`: accepts `pairingToken`.
- `POST /capture`: accepts captured element payload and stores it as the pending capture result.

Security rules:

- Reject non-localhost requests.
- Require the current pairing token for `POST /pair` and `POST /capture`.
- Expire capture sessions after 2 minutes.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml browser_bridge
```

Expected: PASS with tests for token required, expired token rejected, and captured payload stored.

- [ ] **Step 3: Send captured elements from extension to bridge**

In `extension/src/background.ts`, handle `CLICKPILOT_CAPTURED_ELEMENT`:

```ts
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "CLICKPILOT_CAPTURED_ELEMENT") return;

  const { port, pairingToken } = await chrome.storage.local.get(["port", "pairingToken"]);
  await fetch(`http://127.0.0.1:${port}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ClickPilot-Token": pairingToken,
    },
    body: JSON.stringify(message.payload),
  });
});
```

Run:

```bash
cd extension && npm run build
```

Expected: PASS.

- [ ] **Step 4: Add capture panel UI**

Create `src/components/BrowserCapturePanel.tsx` with:

- `브라우저 버튼 선택` button.
- Pairing status line.
- Chrome/Edge `Load unpacked` manual extension install guidance for the initial internal pilot.
- Capture result preview showing URL and text hint.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS after tests are updated for the new panel labels.

- [ ] **Step 5: Add existing-tab execution bridge endpoints**

Extend `src-tauri/src/browser_bridge.rs` with an execution request queue for the extension:

- `POST /existing-tab/execute`: Tauri enqueues an existing-tab execution request for a task.
- `GET /existing-tab/next`: extension polls for the next request using the pairing token.
- `POST /existing-tab/result`: extension posts success/failure, clicked step count, failure reason, and optional screenshot path.

Required request shape:

```ts
type ExistingTabExecutionRequest = {
  executionId: string;
  taskId: string;
  taskName: string;
  browser: "chrome" | "edge" | "any";
  tabUrlPattern: string;
  requireActiveTab: boolean;
  loginCheckUrl?: string;
  loginSuccessSelector?: string;
  steps: BrowserElementStep[];
};
```

Required result shape:

```ts
type ExistingTabExecutionResult =
  | {
      executionId: string;
      status: "success";
      clickedSteps: number;
      screenshotDataUrl?: string;
    }
  | {
      executionId: string;
      status: "failed";
      reason:
        | "extensionNotPaired"
        | "browserNotOpen"
        | "matchingTabNotFound"
        | "loginCheckFailed"
        | "elementNotFound"
        | "multipleElements"
        | "clickFailed";
      message: string;
      clickedSteps: number;
      screenshotDataUrl?: string;
    };
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml browser_bridge
```

Expected: PASS with tests for queued request delivery, token rejection, result storage, and timeout.

- [ ] **Step 6: Add extension-side existing-tab execution**

In `extension/src/background.ts`, poll `GET /existing-tab/next` while paired. When a request arrives:

- Find tabs whose URL matches `tabUrlPattern`.
- If `requireActiveTab` is true, only use the active tab in the current window.
- Send `CLICKPILOT_EXECUTE_STEPS` to the matching tab content script.
- Capture a visible-tab screenshot with `chrome.tabs.captureVisibleTab` after success or failure.
- Post the result to `POST /existing-tab/result`.

In `extension/src/content.ts`, handle `CLICKPILOT_EXECUTE_STEPS`:

- Resolve selector candidates in confidence order.
- Scroll the element into view.
- Click at `clickOffsetRatio`.
- Wait/retry according to the step policy.
- Return structured failure reasons instead of throwing raw errors.

Run:

```bash
cd extension && npm run build
```

Expected: PASS.

## Task 5: Add Playwright/CDP Sidecar Runner

**Files:**
- Create: `automation-runner/package.json`
- Create: `automation-runner/tsconfig.json`
- Create: `automation-runner/src/protocol.ts`
- Create: `automation-runner/src/index.ts`
- Create: `automation-runner/src/executeTask.ts`
- Create: `automation-runner/src/selector.ts`
- Create: `automation-runner/src/loginCheck.ts`
- Create: `automation-runner/src/screenshot.ts`

- [ ] **Step 1: Create runner package**

Create `automation-runner/package.json`:

```json
{
  "name": "clickpilot-automation-runner",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "package:mac": "pkg dist/index.js --targets node20-macos-arm64,node20-macos-x64 --out-path dist-sidecar",
    "package:win": "pkg dist/index.js --targets node20-win-x64 --out-path dist-sidecar"
  },
  "dependencies": {
    "playwright-core": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "pkg": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Run:

```bash
cd automation-runner && npm install
```

Expected: package lock is created.

- [ ] **Step 2: Define runner protocol**

Create `automation-runner/src/protocol.ts`:

```ts
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
      reason:
        | "browserNotFound"
        | "loginCheckFailed"
        | "navigationFailed"
        | "elementNotFound"
        | "multipleElements"
        | "clickFailed";
      message: string;
      screenshotPath?: string;
      clickedSteps: number;
    };
```

Run:

```bash
cd automation-runner && npm run lint
```

Expected: PASS after `tsconfig.json` is added.

- [ ] **Step 3: Implement selector resolution**

In `automation-runner/src/selector.ts`, implement selector resolution:

```ts
import type { Locator, Page } from "playwright-core";
import type { SelectorCandidate } from "./protocol";

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
```

Run:

```bash
cd automation-runner && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Implement execution**

In `automation-runner/src/executeTask.ts`, implement:

- Launch persistent context with `chromium.launchPersistentContext(profileDir, { channel })`.
- Use `channel: "chrome"` for Chrome and `channel: "msedge"` for Edge.
- Navigate to the first step URL base extracted from `urlPattern`.
- Run optional login check.
- For each step, refresh if configured, wait for locator, scroll into view, click at element-relative offset, and delay.
- Save success or failure screenshot.

Core click logic:

```ts
const box = await locator.boundingBox();
if (!box) throw new Error("elementNotFound");

await page.mouse.click(
  box.x + box.width * step.clickOffsetRatio.x,
  box.y + box.height * step.clickOffsetRatio.y,
);
```

Run:

```bash
cd automation-runner && npm run build
```

Expected: PASS.

- [ ] **Step 5: Implement JSON stdin/stdout entrypoint**

In `automation-runner/src/index.ts`, read one JSON request from stdin and write one JSON result to stdout:

```ts
import { executeTask } from "./executeTask";
import type { RunnerRequest } from "./protocol";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const input = await readStdin();
const request = JSON.parse(input) as RunnerRequest;
const result = await executeTask(request);
process.stdout.write(JSON.stringify(result));
```

Run:

```bash
cd automation-runner && npm run build
```

Expected: PASS.

## Task 6: Invoke Sidecar From Tauri

**Files:**
- Create: `src-tauri/src/automation_runner.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add Rust sidecar protocol types**

Create `src-tauri/src/automation_runner.rs` with Rust structs matching `RunnerRequest` and `RunnerResult`.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml automation_runner
```

Expected: compile succeeds after module is registered.

- [ ] **Step 2: Implement sidecar invocation**

Implement a function:

```rust
pub fn run_browser_steps(request: RunnerRequest) -> Result<RunnerResult, AppError>
```

Behavior:

- Serialize request to JSON.
- Start the platform-specific sidecar from Tauri resources.
- Write JSON to stdin.
- Read stdout.
- Parse `RunnerResult`.
- Convert non-zero exit status to `AppError` code `automation_runner_failed`.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml automation_runner
```

Expected: PASS with a test using a fake sidecar path that echoes a known JSON result.

- [ ] **Step 3: Register sidecar resources**

Update `src-tauri/tauri.conf.json` bundle resources to include:

```json
{
  "bundle": {
    "resources": [
      "../automation-runner/dist-sidecar/clickpilot-automation-runner-*"
    ]
  }
}
```

Run:

```bash
npm run build
```

Expected: frontend build remains green. Full bundle verification happens in Task 12.

## Task 7: Dispatch Mixed Step Tasks

**Files:**
- Modify: `src-tauri/src/runner.rs`
- Modify: `src-tauri/src/platform/mod.rs`
- Modify: `src-tauri/src/platform/mock.rs`
- Modify: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/existing_tab_runner.rs`

- [ ] **Step 1: Add runner tests for mixed steps**

Add Rust tests:

```rust
#[test]
fn runner_dispatches_browser_steps_before_coordinate_fallback() {
    let task = mixed_task_fixture();
    let result = run_task_with_mocks(&task);

    assert_eq!(result.browser_step_count, 1);
    assert_eq!(result.coordinate_click_count, 1);
}

#[test]
fn runner_stops_before_browser_step_when_stop_requested() {
    let task = browser_task_fixture();
    let stop = StopState::default();
    stop.request_stop();

    let error = run_task_with_stop(&task, &stop).unwrap_err();

    assert_eq!(error.code, "execution_stopped");
}

#[test]
fn runner_dispatches_existing_tab_browser_steps_through_extension_bridge() {
    let task = existing_tab_browser_task_fixture();
    let result = run_task_with_mocks(&task);

    assert_eq!(result.existing_tab_step_count, 1);
    assert_eq!(result.managed_profile_step_count, 0);
}
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml runner
```

Expected: FAIL until runner supports `AutomationStep`.

- [ ] **Step 2: Update runner dispatch**

Change the runner so:

- Consecutive `browserElement` steps for `runTarget.mode = "managedProfile"` are sent as one Playwright sidecar request.
- Consecutive `browserElement` steps for `runTarget.mode = "existingTab"` are sent through `existing_tab_runner.rs` to the extension bridge.
- `screenCoordinate` steps are executed with the existing OS click engine.
- Stop state is checked before each step group and during delays.
- Result screenshots are appended to execution logs.
- Existing-tab execution fails with `extension_not_paired` when the extension is not paired and with `matching_tab_not_found` when no matching tab exists.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml runner
```

Expected: PASS.

## Task 8: Preserve And Improve Core Task Management UX

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/TaskEditor.tsx`
- Modify: `src/components/StepEditor.tsx`
- Modify: `src/components/ScheduleEditor.tsx`
- Modify: `src/api.ts`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/storage.rs`

- [ ] **Step 1: Add UI tests for the required office-user task workflow**

Add tests in `src/App.test.tsx` that verify:

```ts
async function addCoordinateStep(position: { x: number; y: number }) {
  apiMocks.capturePosition.mockResolvedValueOnce(position);
  await userEvent.click(screen.getByRole("button", { name: "2초 뒤 좌표 캡처" }));
  await vi.advanceTimersByTimeAsync(2000);
  await screen.findByText(`x ${position.x} · y ${position.y}`);
}

function savedTaskFixture(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: "task-1",
    name: "저장된 작업",
    enabled: true,
    schedule: { type: "daily", timeOfDay: "09:00" },
    runTarget: {
      mode: "managedProfile",
      browser: "chrome",
      profileId: "default",
      preopenSeconds: 30,
    },
    steps: [
      {
        kind: "screenCoordinate",
        x: 100,
        y: 120,
        button: "left",
        clickCount: 1,
        delayAfterMs: 500,
      },
    ],
    safety: { countdownSeconds: 0, stopHotkey: "Ctrl+Alt+S" },
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    ...overrides,
  };
}

it("captures a coordinate fallback step after 2 seconds and shows a completion message", async () => {
  vi.useFakeTimers();
  apiMocks.capturePosition.mockResolvedValue({ x: 363, y: 554 });

  render(<App />);

  await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));
  await userEvent.click(screen.getByRole("button", { name: "2초 뒤 좌표 캡처" }));

  await vi.advanceTimersByTimeAsync(2000);

  expect(await screen.findByText("좌표 캡처가 완료되었습니다.")).toBeInTheDocument();
  expect(await screen.findByText("x 363 · y 554")).toBeInTheDocument();

  vi.useRealTimers();
});

it("deletes one configured click step without deleting the task draft", async () => {
  render(<App />);

  await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));
  await addCoordinateStep({ x: 100, y: 120 });
  await addCoordinateStep({ x: 200, y: 220 });

  await userEvent.click(screen.getByRole("button", { name: "단계 삭제 x 100 y 120" }));

  expect(screen.queryByText("x 100 · y 120")).not.toBeInTheDocument();
  expect(screen.getByText("x 200 · y 220")).toBeInTheDocument();
});

it("shows editable schedule input fields", async () => {
  render(<App />);

  await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

  expect(screen.getByLabelText("스케줄 유형")).toBeInTheDocument();
  expect(screen.getByLabelText("실행 시간")).toBeInTheDocument();
  expect(screen.getByLabelText("실행 브라우저 방식")).toBeInTheDocument();
});

it("removes an existing saved task", async () => {
  apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "삭제 대상" })]);
  apiMocks.deleteTask.mockResolvedValue(undefined);

  render(<App />);

  await userEvent.click(await screen.findByRole("button", { name: "작업 삭제 삭제 대상" }));

  expect(apiMocks.deleteTask).toHaveBeenCalledWith("task-1");
  expect(await screen.findByText("작업이 삭제되었습니다.")).toBeInTheDocument();
});

it("runs a saved task immediately", async () => {
  apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "즉시 실행 대상" })]);
  apiMocks.startTaskNow.mockResolvedValue({ taskId: "task-1", status: "started" });

  render(<App />);

  await userEvent.click(await screen.findByRole("button", { name: "즉시 실행 즉시 실행 대상" }));

  expect(apiMocks.startTaskNow).toHaveBeenCalledWith("task-1");
  expect(await screen.findByText("작업 실행을 시작했습니다.")).toBeInTheDocument();
});

it("shows the next scheduled run for an enabled saved task", async () => {
  apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "예약 실행 대상" })]);

  render(<App />);

  expect(await screen.findByText("예약 실행 대상")).toBeInTheDocument();
  expect(await screen.findByText("다음 실행")).toBeInTheDocument();
  expect(await screen.findByText("09:00")).toBeInTheDocument();
});
```

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL until the UI exposes the new labels and deletion controls.

- [ ] **Step 2: Change coordinate fallback capture to 2 seconds**

Update coordinate fallback capture behavior:

- Button label: `2초 뒤 좌표 캡처`.
- Countdown duration: 2000ms.
- Completion toast/message: `좌표 캡처가 완료되었습니다.`
- Captured coordinate step kind: `screenCoordinate`.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: the 2 second capture test passes.

- [ ] **Step 3: Add per-step deletion**

In `StepEditor`, render a delete button for every configured step:

- Browser step accessible label: `단계 삭제 브라우저 ${textHintOrUrl}`.
- Coordinate step accessible label: `단계 삭제 x ${x} y ${y}`.

Delete behavior:

- Removes only the selected step.
- Leaves the task draft open.
- Revalidates save/run state after deletion.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: step deletion test passes.

- [ ] **Step 4: Add editable schedule fields**

In `ScheduleEditor`, expose fields:

- `스케줄 유형`: select with `oneShot`, `daily`, `weekly`, `repeatInterval`.
- `실행 일시`: datetime input for one-shot.
- `실행 시간`: time input for daily and weekly.
- `요일`: checkbox group for weekly.
- `반복 간격(ms)`: number input for repeat interval.
- `최대 실행 횟수`: optional number input for repeat interval.
- `종료 일시`: optional datetime input for repeat interval.

In `TaskEditor`, expose the browser execution target field:

- `실행 브라우저 방식`: select with `전용 자동화 브라우저` and `기존에 열려 있는 브라우저 탭`.
- For `전용 자동화 브라우저`, show browser select and profile setup controls.
- For `기존에 열려 있는 브라우저 탭`, show `대상 탭 URL 패턴` and `현재 활성 탭만 사용` controls.

Run:

```bash
npm test -- src/App.test.tsx
npm run lint
```

Expected: schedule input tests and TypeScript compile pass.

- [ ] **Step 5: Add saved task deletion**

Expose a delete action on saved tasks:

- Accessible label: `작업 삭제 ${task.name}`.
- Confirmation copy: `이 작업을 삭제하시겠습니까?`.
- Success message: `작업이 삭제되었습니다.`
- On success, refresh the task list and clear the selected task when it was deleted.

Tauri IPC already has `delete_task(id: string) -> void`; keep that command and ensure `src/api.ts` exposes:

```ts
export function deleteTask(id: string) {
  return invoke<void>("delete_task", { id });
}
```

Run:

```bash
npm test -- src/App.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml storage commands
```

Expected: task deletion tests pass and persisted task removal remains covered by Rust tests.

- [ ] **Step 6: Add immediate run action**

Expose immediate run actions:

- Task list button accessible label: `즉시 실행 ${task.name}`.
- Detail panel button accessible label: `즉시 실행`.
- On click, call `start_task_now(id)`.
- Success message: `작업 실행을 시작했습니다.`
- Failure messages must surface structured Rust errors from browser runner, coordinate runner, validation, or login check.

Keep `src/api.ts` wrapper:

```ts
export function startTaskNow(id: string) {
  return invoke<ExecutionStartResult>("start_task_now", { id });
}
```

Run:

```bash
npm test -- src/App.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml commands runner
```

Expected: immediate run tests pass.

- [ ] **Step 7: Show scheduled run state for saved tasks**

For enabled tasks with a valid schedule:

- Show `다음 실행`.
- Show the next run time derived by Rust scheduling logic.
- Show `예약 비활성` when `enabled` is false.
- Show `앱이 실행 중일 때 예약 실행됩니다` in the scheduling/help area.

Run:

```bash
npm test -- src/App.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml schedule
```

Expected: scheduled run state tests pass.

## Task 9: Add Login Setup And Login Check UX

**Files:**
- Create: `src/components/LoginCheckPanel.tsx`
- Modify: `src/components/TaskEditor.tsx`
- Modify: `src/api.ts`
- Modify: `src-tauri/src/commands.rs`
- Modify: `automation-runner/src/loginCheck.ts`

- [ ] **Step 1: Add UI test for login readiness**

Add a test that expects:

- `실행 전 로그인 확인` panel is visible for browser tasks.
- `로그인 확인 열기` button calls `open_browser_profile`.
- A failed login check renders `로그인이 필요합니다`.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL until UI and commands exist.

- [ ] **Step 2: Add Tauri commands**

Add:

```rust
#[tauri::command]
pub fn open_browser_profile(target: ManagedBrowserProfileTarget) -> Result<(), AppError>

#[tauri::command]
pub fn check_browser_login(target: BrowserRunTarget) -> Result<LoginCheckResult, AppError>
```

`open_browser_profile` launches the Playwright sidecar in profile-open mode for `managedProfile` targets. `check_browser_login` uses Playwright/CDP for `managedProfile` and the extension bridge for `existingTab`.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml commands
```

Expected: PASS after command handlers compile.

- [ ] **Step 3: Add login check panel**

Create `LoginCheckPanel` with these states:

- `확인 전`: shows `실행 전 로그인 확인`.
- `확인 중`: shows a progress indicator.
- `성공`: shows `로그인 확인 완료`.
- `실패`: shows `로그인이 필요합니다` and `로그인 페이지 열기`.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

## Task 10: Add Scheduling Preopen And Button Wait Defaults

**Files:**
- Modify: `src-tauri/src/schedule.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/components/ScheduleEditor.tsx`
- Modify: `src/components/SafetyPanel.tsx`

- [ ] **Step 1: Add schedule tests**

Add tests:

```rust
#[test]
fn browser_task_preopen_time_is_before_run_time() {
    let run_at = "2026-05-19T09:00:00+09:00";
    let preopen_at = compute_preopen_time(run_at, 30).unwrap();

    assert_eq!(preopen_at.to_rfc3339(), "2026-05-19T08:59:30+09:00");
}

#[test]
fn preopen_seconds_is_capped_by_validation() {
    let mut task = browser_task_fixture();
    task.run_profile.preopen_seconds = 301;

    let error = validate_task(&task).unwrap_err();

    assert_eq!(error.code, "browser_preopen_invalid");
}
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml schedule validation
```

Expected: FAIL until preopen logic is added.

- [ ] **Step 2: Implement preopen scheduling**

Scheduler behavior:

- At `runAt - preopenSeconds`, `managedProfile` tasks open the automation profile and navigate to first step URL.
- At `runAt - preopenSeconds`, `existingTab` tasks ping the extension bridge, verify that a matching tab exists, and log a preflight warning if the tab is missing.
- At exact scheduled run time, start waiting/clicking.
- If the app starts after preopen time but before run time, preopen immediately.
- If the app starts after run time for a one-shot task, mark it `missed`.
- Scheduled execution applies only to saved tasks where `enabled` is true.
- Scheduled execution continues while the app is alive in the tray/menu bar and does not require the main window to stay open.
- Existing-tab scheduled execution requires Chrome/Edge, the paired extension, and the matching tab to remain open until execution time.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml schedule
```

Expected: PASS.

## Task 11: Add Execution Logs And Screenshots

**Files:**
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/storage.rs`
- Modify: `src/components/ExecutionLogs.tsx`
- Modify: `src/api.ts`

- [ ] **Step 1: Extend execution log model**

Add:

```ts
type ExecutionLog = {
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
```

Mirror this in Rust.

Run:

```bash
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml models
```

Expected: compile errors until log rendering is updated.

- [ ] **Step 2: Render screenshot links**

In `ExecutionLogs`, render:

- `스크린샷 보기` when `screenshotPath` is present.
- `실패 사유` when `failureReason` is present.
- `버튼을 찾지 못했습니다`, `로그인이 필요합니다`, or `브라우저를 찾지 못했습니다` from structured failure codes.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS with screenshot and failure reason tests.

## Task 12: Package Windows And macOS Executables

**Files:**
- Modify: `package.json`
- Modify: `automation-runner/package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Modify: `docs/manual-smoke-tests.md`

- [ ] **Step 1: Add root packaging scripts**

Add scripts to root `package.json`:

```json
{
  "scripts": {
    "build:extension": "npm --prefix extension run build",
    "build:runner": "npm --prefix automation-runner run build",
    "package:runner:mac": "npm --prefix automation-runner run package:mac",
    "package:runner:win": "npm --prefix automation-runner run package:win",
    "build:desktop": "npm run build && npm run tauri build",
    "build:all:mac": "npm run build:extension && npm run build:runner && npm run package:runner:mac && npm run build:desktop",
    "build:all:win": "npm run build:extension && npm run build:runner && npm run package:runner:win && npm run build:desktop"
  }
}
```

Run on macOS:

```bash
npm run build:all:mac
```

Expected: a macOS Tauri bundle is produced and contains the sidecar resource.

- [ ] **Step 2: Add distribution notes**

Update `README.md` with:

- Initial internal pilot uses manual Chrome/Edge `Load unpacked` installation with `extension/dist`.
- Manual install steps: open `chrome://extensions` or `edge://extensions`, enable developer mode, click `Load unpacked`, select `extension/dist`, then confirm ClickPilot pairing.
- Manual `Load unpacked` installs do not auto-update; users must keep the `extension/dist` folder in place and reinstall or reload it when a new build is delivered.
- Published extension listings or managed enterprise policy deployment are follow-up options for wider or longer-term rollout.
- Desktop app runs on Windows and macOS through Tauri bundles.
- Chrome or Edge must be installed on the user's machine.
- First-time setup requires opening the ClickPilot automation profile and logging into target sites.
- Existing-tab execution requires the extension to stay paired and the target Chrome/Edge tab to remain open.
- Managed-profile execution is recommended for unattended scheduled jobs because ClickPilot can open and control the browser profile itself.

- [ ] **Step 3: Add smoke test checklist**

Update `docs/manual-smoke-tests.md` with:

- macOS install and launch.
- Windows install and launch.
- Create a new task from the command center.
- Capture a coordinate fallback step with `2초 뒤 좌표 캡처` and confirm the completion message.
- Delete one configured click step and confirm other steps remain.
- Edit schedule input fields and save the task.
- Run a saved task immediately and confirm execution starts.
- Save an enabled task with a near-future schedule and confirm it runs at the scheduled time.
- Delete a saved task and confirm it disappears from the task list.
- Chrome extension `Load unpacked` install and pairing.
- Edge extension `Load unpacked` install and pairing.
- Capture a button from an existing logged-in tab.
- Execute against an already-open existing Chrome tab.
- Execute against an already-open existing Edge tab.
- Open automation profile and confirm login.
- Schedule a task one minute in the future.
- Confirm preopen occurs before run time.
- Confirm button wait/click succeeds.
- Confirm failure screenshot is saved when selector is invalid.

## Task 13: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run frontend verification**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Run Rust verification**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests pass.

- [ ] **Step 3: Run extension verification**

Run:

```bash
npm --prefix extension run lint
npm --prefix extension run build
```

Expected: extension build emits `extension/dist`.

- [ ] **Step 4: Run runner verification**

Run:

```bash
npm --prefix automation-runner run lint
npm --prefix automation-runner run build
```

Expected: runner build emits `automation-runner/dist`.

- [ ] **Step 5: Run manual smoke tests**

Run the checklist in `docs/manual-smoke-tests.md` on:

- macOS with Chrome.
- macOS with Edge.
- Windows with Chrome.
- Windows with Edge.

Expected: capture, immediate execution, login setup, scheduled execution, retry, screenshot logging, stop hotkey, tray/menu bar behavior, and installer launch all pass.

## Self-Review Notes

- Spec coverage: captures the approved direction of Extension for button selection plus Playwright/CDP for scheduled execution, with Chrome/Edge first and Windows/macOS packaged apps.
- Scope: Safari is intentionally excluded from this implementation plan to keep the first browser automation version shippable.
- Data consistency: frontend and Rust both use `AutomationStep` with `kind: "browserElement"` and `kind: "screenCoordinate"`.
- Baseline UX coverage: includes the previously missing new-task improvements for 2 second coordinate capture, capture completion message, per-step deletion, editable schedule fields, saved task deletion, immediate execution, and scheduled execution visibility.
- Packaging risk: Playwright/CDP runner is isolated as a sidecar so the Tauri app remains a normal Windows/macOS executable. Initial extension distribution is intentionally manual through Chrome/Edge `Load unpacked`; a managed policy or store-based path is still needed before broader production rollout.
