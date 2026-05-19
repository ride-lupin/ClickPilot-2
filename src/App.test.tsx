import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
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

describe("ClickPilot task workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.listTasks.mockResolvedValue([]);
    apiMocks.listExecutionLogs.mockResolvedValue([]);
    apiMocks.browserBridgeStatus.mockResolvedValue({ port: 27183, paired: false, captureActive: false });
    apiMocks.requestBrowserCapture.mockResolvedValue({ port: 27183, paired: true, captureActive: true });
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

  it("deletes one configured click step without deleting the task draft", async () => {
    apiMocks.listTasks.mockResolvedValue([
      savedTaskFixture({
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
          {
            kind: "browserElement",
            urlPattern: "https://example.com/buy*",
            selectorCandidates: [{ strategy: "css", value: "button.buy", confidence: 90 }],
            textHint: "구매 관리",
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

    await userEvent.click(await screen.findByText("저장된 작업"));
    await userEvent.click(screen.getByRole("button", { name: "단계 삭제 브라우저 신청하기" }));

    const editor = screen.getByLabelText("작업 편집");
    expect(within(editor).queryByText("신청하기")).not.toBeInTheDocument();
    expect(within(editor).getByText("구매 관리")).toBeInTheDocument();
    expect(within(editor).getByText("현재 저장 안 됨")).toBeInTheDocument();
  });

  it("shows editable schedule input fields", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    expect(screen.getByLabelText("스케줄 유형")).toBeInTheDocument();
    expect(screen.getByLabelText("실행 시간")).toBeInTheDocument();
    expect(screen.getByLabelText("실행 브라우저 방식")).toBeInTheDocument();
  });

  it("refreshes the pairing token separately from browser button selection", async () => {
    apiMocks.startBrowserCapture.mockResolvedValue({ port: 27183, pairingToken: "pair-token-123" });
    apiMocks.getLatestBrowserCapture
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        url: "https://example.com/apply",
        selectorCandidates: [{ strategy: "css", value: "button.apply", confidence: 90 }],
        textHint: "신청하기",
        framePath: [],
        clickOffsetRatio: { x: 0.5, y: 0.5 },
      });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));
    await userEvent.click(screen.getByRole("button", { name: "토큰 갱신" }));

    expect(await screen.findByDisplayValue("pair-token-123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("27183")).toBeInTheDocument();
    expect(screen.getByText(/초기 연결 승인용 token이며, 연결 후에는 앱을 종료하거나 연결 해제할 때까지 유지됩니다/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "브라우저 버튼 선택" }));

    expect(apiMocks.startBrowserCapture).toHaveBeenCalledTimes(1);
    expect(apiMocks.requestBrowserCapture).toHaveBeenCalledTimes(1);
  });

  it("shows save feedback for unsaved, saved, and failed task changes", async () => {
    apiMocks.saveTask.mockImplementation(async (task) => savedTaskFixture({ ...task, id: "task-saved" }));

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));
    expect(screen.getByText("현재 저장 안 됨")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("저장되었습니다.")).toBeInTheDocument();

    apiMocks.saveTask.mockRejectedValueOnce(new Error("validation error"));
    await userEvent.clear(screen.getByLabelText("작업 이름"));
    await userEvent.type(screen.getByLabelText("작업 이름"), "저장 실패 작업");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("저장 실패: validation error")).toBeInTheDocument();
  });

  it("does not show coordinate capture controls", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    expect(screen.queryByRole("button", { name: "2초 뒤 좌표 캡처" })).not.toBeInTheDocument();
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

  it("does not duplicate the immediate run action inside the editor", async () => {
    apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "카드 실행 대상" })]);

    render(<App />);

    await userEvent.click(await screen.findByText("카드 실행 대상"));
    const editor = screen.getByLabelText("작업 편집");

    expect(within(editor).queryByRole("button", { name: "예약과 상관없이 지금 실행" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "즉시 실행 카드 실행 대상" })).toBeInTheDocument();
  });

  it("shows the next scheduled run for an enabled saved task", async () => {
    apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "예약 실행 대상" })]);

    render(<App />);

    expect(await screen.findByText("예약 실행 대상")).toBeInTheDocument();
    expect(await screen.findByText("다음 실행")).toBeInTheDocument();
    expect(await screen.findByText("09:00")).toBeInTheDocument();
  });

  it("shows login readiness and execution logs", async () => {
    const screenshotDocument = { write: vi.fn(), close: vi.fn() };
    const openSpy = vi.spyOn(window, "open").mockReturnValue({ document: screenshotDocument } as unknown as Window);
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
    expect(screen.getByText(/시작: 2026년 05월 19일/)).toBeInTheDocument();
    expect(screen.getByText(/완료: 2026년 05월 19일/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "스크린샷 보기" }));

    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(screenshotDocument.write).toHaveBeenCalledWith(expect.stringContaining("/tmp/clickpilot/failure.png"));
    openSpy.mockRestore();
  });
});
