# Fast Click Mode Design

## Goal

Add an optional first-come click mode for existing browser tabs. The mode waits for a saved browser element to become clickable and clicks immediately after the configured task run starts.

## Decisions

- Existing browser tab is the default run target for new tasks.
- Managed automation browser remains in the type system for compatibility, but the editor disables it.
- Fast click mode is optional and off by default.
- Fast click mode only runs against `existingTab`.
- Refresh behavior is configurable in the UI.
- The first version does not attempt CAPTCHA solving, queue bypass, security bypass, or anti-bot evasion.

## User Flow

1. User opens the target page in Chrome or Edge and logs in.
2. User captures the target button with ClickPilot.
3. User enables fast click mode on the task.
4. User chooses refresh behavior: no refresh, one refresh at start, or repeated refresh.
5. The scheduled run enqueues an existing-tab request.
6. The extension finds the matching existing tab.
7. The extension optionally refreshes, then monitors the first browser element step.
8. When the element is visible and not disabled, the extension dispatches the click sequence without marker delay.
9. The result log records the fast-click outcome.

## Constraints

- Fast click mode uses the saved task schedule as its start gate.
- The first implementation starts monitoring when the app scheduler enqueues the task. It does not add a separate pre-arm scheduler path.
- Repeated refresh must use a conservative lower bound to avoid self-inflicted loading churn.
- Normal mode behavior must remain available for existing saved tasks.

