import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AutomationTask } from "./types";
import * as api from "./api";

vi.mock("./api");

const apiMocks = vi.mocked(api);

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

async function addCoordinateStep(position: { x: number; y: number }) {
  apiMocks.capturePosition.mockResolvedValueOnce(position);
  fireEvent.click(screen.getByRole("button", { name: "2초 뒤 좌표 캡처" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText(`x ${position.x} · y ${position.y}`)).toBeInTheDocument();
}

describe("ClickPilot task workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.listTasks.mockResolvedValue([]);
    apiMocks.listExecutionLogs.mockResolvedValue([]);
    apiMocks.browserBridgeStatus.mockResolvedValue({ port: 27183, paired: false, captureActive: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a saved browser element step with its URL and text hint", async () => {
    apiMocks.listTasks.mockResolvedValue([
      savedTaskFixture({
        id: "task-browser-1",
        name: "오전 신청",
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
      }),
    ]);

    render(<App />);

    expect(await screen.findByText("오전 신청")).toBeInTheDocument();
    expect(await screen.findByText("https://example.com/apply*")).toBeInTheDocument();
    expect(await screen.findByText("신청하기")).toBeInTheDocument();
  });

  it("captures a coordinate fallback step after 2 seconds and shows a completion message", async () => {
    vi.useFakeTimers();
    apiMocks.capturePosition.mockResolvedValue({ x: 363, y: 554 });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "새 작업" }));
    fireEvent.click(screen.getByRole("button", { name: "2초 뒤 좌표 캡처" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("좌표 캡처가 완료되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("x 363 · y 554")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("deletes one configured click step without deleting the task draft", async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "새 작업" }));
    await addCoordinateStep({ x: 100, y: 120 });
    await addCoordinateStep({ x: 200, y: 220 });
    fireEvent.click(screen.getByRole("button", { name: "단계 삭제 x 100 y 120" }));

    expect(screen.queryByText("x 100 · y 120")).not.toBeInTheDocument();
    expect(screen.getByText("x 200 · y 220")).toBeInTheDocument();

    vi.useRealTimers();
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
    vi.spyOn(window, "confirm").mockReturnValue(true);

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

  it("shows login readiness and execution logs", async () => {
    apiMocks.listExecutionLogs.mockResolvedValue([
      {
        id: "log-1",
        taskId: "task-1",
        taskName: "오전 신청",
        status: "failed",
        failureReason: "elementNotFound",
        screenshotPath: "/tmp/clickpilot/failure.png",
        startedAt: "2026-05-19T00:00:00.000Z",
        finishedAt: "2026-05-19T00:00:01.000Z",
      },
    ]);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    expect(screen.getByText("실행 전 로그인 확인")).toBeInTheDocument();
    expect(await screen.findByText(/버튼을 찾지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText("스크린샷 보기")).toBeInTheDocument();
  });
});
