import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("adds a refresh step to the draft", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));
    await userEvent.click(screen.getByRole("button", { name: "새로고침 단계 추가" }));

    const editor = screen.getByLabelText("작업 편집");
    expect(within(editor).getByText("새로고침")).toBeInTheDocument();
    expect(within(editor).getByText("현재 탭 다시 로드")).toBeInTheDocument();
    expect(within(editor).getByText("현재 저장 안 됨")).toBeInTheDocument();
  });

  it("shows editable schedule input fields", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    expect(screen.getByLabelText("스케줄 유형")).toBeInTheDocument();
    expect(screen.getByLabelText("실행 시간")).toBeInTheDocument();
    expect(screen.getByLabelText("실행 브라우저 방식")).toBeInTheDocument();
  });

  it("defaults new tasks to existing browser tabs and disables managed profile selection", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    const runTarget = screen.getByLabelText("실행 브라우저 방식");
    expect(runTarget).toHaveValue("existingTab");
    expect(screen.getByRole("option", { name: "전용 자동화 브라우저" })).toBeDisabled();
    expect(screen.getByLabelText("대상 탭 도메인")).toHaveValue("");
  });

  it("shows fast click controls only when the option is enabled", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "새 작업" }));

    expect(screen.queryByLabelText("새로고침 방식")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("선착순 모드 사용"));

    expect(screen.getByLabelText("새로고침 방식")).toHaveValue("onceAtStart");
    expect(screen.queryByRole("option", { name: "시작 시간 이후 반복 새로고침" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("최대 대기 시간(ms)")).toHaveValue(10000);
    expect(screen.queryByLabelText("반복 새로고침 간격(ms)")).not.toBeInTheDocument();
  });

  it("refreshes the pairing token separately from browser button selection", async () => {
    apiMocks.startBrowserCapture.mockResolvedValue({ port: 27183, pairingToken: "pair-token-123" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
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
    expect(screen.getByText(/Pairing token은 만료되지 않으며, 앱 재시작 후에도 같은 토큰으로 연결됩니다/)).toBeInTheDocument();

    await userEvent.click(screen.getByDisplayValue("pair-token-123"));

    expect(writeText).toHaveBeenCalledWith("pair-token-123");
    expect(await screen.findByText("Pairing token을 클립보드에 복사했습니다.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "브라우저 버튼 선택" }));

    expect(apiMocks.startBrowserCapture).toHaveBeenCalledTimes(1);
    expect(apiMocks.requestBrowserCapture).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText("대상 탭 도메인")).toHaveValue("example.com"));
  });

  it("keeps token controls global and places browser selection in the click steps section", async () => {
    apiMocks.startBrowserCapture.mockResolvedValue({ port: 27183, pairingToken: "global-token-123" });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "토큰 갱신" }));

    expect(await screen.findByDisplayValue("global-token-123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("27183")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "새 작업" }));
    const editor = screen.getByLabelText("작업 편집");
    const stepSection = within(editor).getByRole("heading", { name: "클릭 단계" }).closest("section");

    expect(within(editor).queryByRole("button", { name: "토큰 갱신" })).not.toBeInTheDocument();
    expect(stepSection).not.toBeNull();
    expect(within(stepSection!).getByRole("button", { name: "브라우저 버튼 선택" })).toBeInTheDocument();
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

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "작업 삭제 삭제 대상" }));

    expect(apiMocks.deleteTask).toHaveBeenCalledWith("task-1");
    expect(await screen.findByText("작업이 삭제되었습니다.")).toBeInTheDocument();
  });

  it("selects a saved task by clicking anywhere on its card body", async () => {
    apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "카드 전체 선택" })]);

    render(<App />);

    const card = (await screen.findByText("카드 전체 선택")).closest("li");
    expect(card).not.toBeNull();
    await userEvent.click(within(card!).getByText("09:00"));

    expect(screen.getByLabelText("작업 편집")).toBeInTheDocument();
    expect(screen.getByDisplayValue("카드 전체 선택")).toBeInTheDocument();
  });

  it("does not select the task card when deleting from the card action", async () => {
    apiMocks.listTasks.mockResolvedValue([savedTaskFixture({ id: "task-1", name: "삭제만 수행" })]);
    apiMocks.deleteTask.mockResolvedValue(undefined);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "작업 삭제 삭제만 수행" }));

    expect(apiMocks.deleteTask).toHaveBeenCalledWith("task-1");
    expect(screen.queryByLabelText("작업 편집")).not.toBeInTheDocument();
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

  it("shows execution logs without screenshot action", async () => {
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

    expect(screen.queryByText("실행 전 로그인 확인")).not.toBeInTheDocument();
    expect(await screen.findByText(/버튼을 찾지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText(/시작: 2026년 05월 19일/)).toBeInTheDocument();
    expect(screen.getByText(/완료: 2026년 05월 19일/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "스크린샷 보기" })).not.toBeInTheDocument();
  });

  it("clears all execution logs from the logs panel action", async () => {
    apiMocks.listExecutionLogs.mockResolvedValue([
      {
        id: "log-1",
        taskId: "task-1",
        taskName: "오전 신청",
        status: "failed",
        failureReason: "elementNotFound",
        startedAt: "2026-05-19T00:00:00.000Z",
      },
    ]);
    apiMocks.clearExecutionLogs.mockResolvedValue(undefined);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "로그 전체 삭제" }));

    expect(apiMocks.clearExecutionLogs).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("실행 로그를 모두 삭제했습니다.")).toBeInTheDocument();
  });
});
