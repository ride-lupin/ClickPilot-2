# ClickPilot

ClickPilot is a Windows/macOS desktop app for office-user browser automation. It lets a user create a task, choose a Chrome/Edge page button visually, keep a coordinate fallback step when needed, schedule the task, verify login before execution, and inspect execution logs with screenshots.

## Stack

- Tauri 2 desktop shell
- React + TypeScript + Vite frontend
- Rust models, validation, storage, scheduling, and runner contracts
- Chrome/Edge Manifest V3 extension for element selection and existing-tab execution
- Playwright Core sidecar runner for managed browser profile execution

## Development

```bash
npm install
npm --prefix extension install
npm --prefix automation-runner install
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm --prefix extension run build
npm --prefix automation-runner run build
```

This repository path currently contains `#`, so the root and extension Vite scripts run from a temporary safe path and copy build outputs back into the repository.

## Extension Setup

The initial internal pilot uses manual Chrome/Edge `Load unpacked` installation.
See `docs/extension-installation-guide.ko.md` for the Korean operator guide.

1. Build the extension with `npm --prefix extension run build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click `Load unpacked`.
5. Select `extension/dist`.
6. Open the extension popup and enter the ClickPilot bridge port and pairing token.
7. Confirm pairing in ClickPilot, then use `브라우저 버튼 선택` on a real work site.

Manual `Load unpacked` installs do not auto-update. Users must keep the `extension/dist` folder in place and reload or reinstall it when a new build is delivered. Chrome Web Store private listing, Edge Add-ons hidden listing, or managed enterprise extension deployment are follow-up options for broader rollout.

## Execution Modes

- `전용 자동화 브라우저`: ClickPilot opens a managed Chrome/Edge profile and runs browser steps through the Playwright sidecar. This is recommended for unattended scheduled jobs.
- `기존에 열려 있는 브라우저 탭`: The extension finds a matching already-open Chrome/Edge tab and clicks inside it. This requires the browser, tab, and extension pairing to remain active.

Chrome or Edge must be installed on the user's machine. First-time setup requires opening the ClickPilot automation profile and logging into target sites.

## Packaging

```bash
npm run build:all:mac
npm run build:all:win
```

The desktop bundle includes the automation runner sidecar from `automation-runner/dist-sidecar`. Use `docs/manual-smoke-tests.md` before distributing a pilot build.
