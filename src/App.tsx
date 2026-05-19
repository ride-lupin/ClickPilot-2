import { CalendarClock, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  browserBridgeStatus,
  checkBrowserLogin,
  deleteTask,
  getLatestBrowserCapture,
  listExecutionLogs,
  listTasks,
  openBrowserProfile,
  requestBrowserCapture,
  saveTask,
  startBrowserCapture,
  startTaskNow,
} from "./api";
import { ExecutionLogs } from "./components/ExecutionLogs";
import { TaskEditor } from "./components/TaskEditor";
import type {
  AutomationTask,
  BrowserBridgeStatus,
  BrowserCaptureSession,
  CapturedBrowserElement,
  ExecutionLog,
} from "./types";

function newTask(): AutomationTask {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "새 작업",
    enabled: true,
    schedule: { type: "daily", timeOfDay: "09:00" },
    runTarget: { mode: "managedProfile", browser: "chrome", profileId: "default", preopenSeconds: 30 },
    steps: [],
    safety: { countdownSeconds: 0, stopHotkey: "Ctrl+Alt+S" },
    createdAt: now,
    updatedAt: now,
  };
}

function nextRunLabel(task: AutomationTask) {
  if (!task.enabled) return "예약 비활성";
  if (task.schedule.type === "daily" || task.schedule.type === "weekly") return task.schedule.timeOfDay;
  if (task.schedule.type === "oneShot") return task.schedule.runAt;
  return `${Math.round(task.schedule.intervalMs / 1000)}초마다`;
}

function toBrowserStep(capture: CapturedBrowserElement) {
  return {
    kind: "browserElement" as const,
    urlPattern: capture.url,
    selectorCandidates: capture.selectorCandidates,
    textHint: capture.textHint,
    framePath: capture.framePath,
    clickOffsetRatio: capture.clickOffsetRatio,
    wait: { timeoutMs: 15000, pollIntervalMs: 100, refreshBeforeWait: true },
    retry: { maxAttempts: 3, retryDelayMs: 250 },
    delayAfterMs: 500,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function App() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [draft, setDraft] = useState<AutomationTask | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BrowserBridgeStatus | null>(null);
  const [captureSession, setCaptureSession] = useState<BrowserCaptureSession | null>(null);
  const [message, setMessage] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "success" | "warning" | "error"; message: string } | null>(null);

  async function refresh() {
    const [loadedTasks, loadedLogs, status] = await Promise.all([listTasks(), listExecutionLogs(), browserBridgeStatus()]);
    setTasks(loadedTasks);
    setLogs(loadedLogs);
    setBridgeStatus(status);
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedTask = useMemo(() => draft?.id ? tasks.find((task) => task.id === draft.id) : null, [draft?.id, tasks]);

  async function handleSave() {
    if (!draft) return;
    try {
      const saved = await saveTask(draft);
      setDraft(saved);
      setSaveFeedback({ kind: "success", message: "저장되었습니다." });
      setMessage("작업이 저장되었습니다.");
      await refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setSaveFeedback({ kind: "error", message: `저장 실패: ${reason}` });
    }
  }

  async function handleDelete(task: AutomationTask) {
    const confirmed = window.confirm("이 작업을 삭제하시겠습니까?");
    if (!confirmed) return;
    await deleteTask(task.id);
    if (draft?.id === task.id) setDraft(null);
    setMessage("작업이 삭제되었습니다.");
    await refresh();
  }

  async function handleRun(task: AutomationTask) {
    await startTaskNow(task.id);
    setMessage("작업 실행을 시작했습니다.");
    await refresh();
  }

  async function handleStartBrowserCapture() {
    const session = await startBrowserCapture();
    setCaptureSession(session);
    setSaveFeedback((current) => current ?? { kind: "warning", message: "현재 저장 안 됨" });
    setMessage("새 pairing token을 발급했습니다. 10분 안에 확장프로그램에 저장한 뒤 브라우저 버튼 선택을 누르세요.");
    await refresh();
  }

  async function handleRequestBrowserCapture() {
    try {
      const status = await requestBrowserCapture();
      setBridgeStatus(status);
      setMessage("브라우저에서 선택할 버튼을 클릭하세요.");
    } catch {
      setMessage("먼저 토큰 갱신 후 확장프로그램에서 연결 저장을 완료하세요.");
      return;
    }
    let capture: CapturedBrowserElement | null = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      capture = await getLatestBrowserCapture();
      if (capture) break;
      await delay(1000);
    }
    if (!capture) {
      setMessage("선택된 버튼이 아직 없습니다. 확장프로그램 연결 상태를 확인한 뒤 다시 시도하세요.");
      return;
    }
    if (draft) {
      setDraft({ ...draft, steps: [...draft.steps, toBrowserStep(capture)] });
      setSaveFeedback({ kind: "warning", message: "현재 저장 안 됨" });
    }
  }

  function deleteDraftStep(index: number) {
    setDraft((current) => (current ? { ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) } : current));
    setSaveFeedback({ kind: "warning", message: "현재 저장 안 됨" });
  }

  function handleDraftChange(task: AutomationTask) {
    setDraft(task);
    setSaveFeedback({ kind: "warning", message: "현재 저장 안 됨" });
  }

  return (
    <main className="app-shell">
      <aside className="task-list-panel">
        <div className="brand-block">
          <span>ClickPilot</span>
          <h1>브라우저 업무 자동화</h1>
        </div>
        <button
          type="button"
          className="primary-button full-width"
          onClick={() => {
            setDraft(newTask());
            setSaveFeedback({ kind: "warning", message: "현재 저장 안 됨" });
          }}
        >
          <Plus size={16} />
          새 작업
        </button>
        {message && <p className="status-message">{message}</p>}
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={selectedTask?.id === task.id ? "selected" : undefined}>
              <button
                type="button"
                className="task-select"
                onClick={() => {
                  setDraft(task);
                  setSaveFeedback(null);
                }}
              >
                <strong>{task.name}</strong>
                <span>
                  <CalendarClock size={14} /> 다음 실행
                </span>
                <span>{nextRunLabel(task)}</span>
              </button>
              <div className="task-actions">
                <button type="button" className="icon-button" aria-label={`즉시 실행 ${task.name}`} onClick={() => void handleRun(task)}>
                  <Play size={15} />
                </button>
                <button type="button" className="icon-button" aria-label={`작업 삭제 ${task.name}`} onClick={() => void handleDelete(task)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="task-steps">
                {task.steps.map((step, index) =>
                  step.kind === "browserElement" ? (
                    <p key={index}>
                      <strong>{step.textHint || "브라우저 요소"}</strong>
                      <span>{step.urlPattern}</span>
                    </p>
                  ) : (
                    <p key={index}>x {step.x} · y {step.y}</p>
                  ),
                )}
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <section className="workspace">
        {draft ? (
          <>
            <TaskEditor
              draft={draft}
              bridgeStatus={bridgeStatus}
              captureSession={captureSession}
              saveFeedback={saveFeedback}
              onChange={handleDraftChange}
              onSave={() => void handleSave()}
              onRefreshPairingToken={() => void handleStartBrowserCapture()}
              onRequestBrowserCapture={() => void handleRequestBrowserCapture()}
              onDeleteStep={deleteDraftStep}
              onOpenProfile={openBrowserProfile}
              onCheckLogin={checkBrowserLogin}
            />
          </>
        ) : (
          <section className="empty-state">
            <h2>작업을 선택하거나 새 작업을 만드세요</h2>
            <p>브라우저 버튼 선택, 좌표 fallback, 스케줄, 로그인 확인을 한 작업 안에서 관리합니다.</p>
          </section>
        )}
        <ExecutionLogs logs={logs} />
      </section>
    </main>
  );
}
