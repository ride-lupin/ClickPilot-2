# Fast Click Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional fast click mode for existing browser tabs and make existingTab the default task target.

**Architecture:** Store optional `fastClick` settings on each task. The desktop app passes those settings through the existing bridge queue, and the browser extension switches to a low-latency execution path when enabled.

**Tech Stack:** React, TypeScript, Tauri Rust, Chrome extension APIs, Vitest, Cargo tests.

---

### Task 1: Task Model and UI Defaults

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TaskEditor.tsx`
- Modify: `src/App.test.tsx`

- [ ] Add `FastClickSettings` to the frontend task type.
- [ ] Change new task defaults to `existingTab`.
- [ ] Disable managed profile selection in the task editor.
- [ ] Add fast click mode controls.
- [ ] Add UI tests for the default target, disabled managed option, and refresh policy controls.

### Task 2: Rust Model and Bridge Payload

**Files:**
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/browser_bridge.rs`
- Modify: `src-tauri/src/existing_tab_runner.rs`
- Modify: `src-tauri/src/validation.rs`

- [ ] Add `FastClickSettings` to `AutomationTask`.
- [ ] Validate fast click only for `existingTab`.
- [ ] Pass fast click settings through `ExistingTabExecutionRequest`.
- [ ] Add Rust tests for serialization, validation, and queued payloads.

### Task 3: Extension Fast Click Execution

**Files:**
- Modify: `extension/src/execution.ts`
- Modify: `extension/src/background.ts`
- Modify: `extension/src/content.ts`
- Modify: `extension/src/execution.test.ts`

- [ ] Add fast click request types.
- [ ] Implement background refresh handling before fast click arm.
- [ ] Add a content-script message that monitors one browser element step and clicks without visual marker delay.
- [ ] Add tests for once-at-start refresh and fast-click message routing.

### Task 4: Verification

**Commands:**
- `npm test -- src/App.test.tsx extension/src/execution.test.ts`
- `npm run lint`
- `npm --prefix extension run lint`
- `cargo test --manifest-path src-tauri/Cargo.toml`

