import { CalendarClock, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  browserBridgeStatus,
  capturePosition,
  checkBrowserLogin,
  deleteTask,
  getLatestBrowserCapture,
  listExecutionLogs,
  listTasks,
  openBrowserProfile,
  saveTask,
  startBrowserCapture,
  startTaskNow,
} from "./api";
import { ExecutionLogs } from "./components/ExecutionLogs";
import { TaskEditor } from "./components/TaskEditor";
import type {
  AutomationTask,
  BrowserBridgeStatus,
  CapturedBrowserElement,
  ExecutionLog,
  ScreenCoordinateStep,
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

export default function App() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [draft, setDraft] = useState<AutomationTask | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BrowserBridgeStatus | null>(null);
  const [latestCapture, setLatestCapture] = useState<CapturedBrowserElement | null>(null);
  const [message, setMessage] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");

  async function refresh() {
    const [loadedTasks, loadedLogs, status] = await Promise.all([listTasks(), listExecutionLogs(), browserBridgeStatus()]);
    setTasks(loadedTasks);
    setLogs(loadedLogs);
    setBridgeStatus(status);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedTask = useMemo(() => draft?.id ? tasks.find((task) => task.id === draft.id) : null, [draft?.id, tasks]);

  async function handleSave() {
    if (!draft) return;
    const saved = await saveTask(draft);
    setDraft(saved);
    setMessage("작업이 저장되었습니다.");
    await refresh();
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
    await startBrowserCapture();
    const capture = await getLatestBrowserCapture();
    if (!capture) {
      setMessage("확장 프로그램에서 버튼을 선택하면 여기에 표시됩니다.");
      return;
    }
    setLatestCapture(capture);
    if (draft) setDraft({ ...draft, steps: [...draft.steps, toBrowserStep(capture)] });
  }

  async function handleCaptureCoordinate() {
    window.setTimeout(async () => {
      const position = await capturePosition();
      const step: ScreenCoordinateStep = {
        kind: "screenCoordinate",
        x: position.x,
        y: position.y,
        button: "left",
        clickCount: 1,
        delayAfterMs: 500,
      };
      setDraft((current) => (current ? { ...current, steps: [...current.steps, step] } : current));
      setCaptureMessage("좌표 캡처가 완료되었습니다.");
    }, 2000);
  }

  function deleteDraftStep(index: number) {
    setDraft((current) => (current ? { ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) } : current));
  }

  return (
    <main className="app-shell">
      <aside className="task-list-panel">
        <div className="brand-block">
          <span>ClickPilot</span>
          <h1>브라우저 업무 자동화</h1>
        </div>
        <button type="button" className="primary-button full-width" onClick={() => setDraft(newTask())}>
          <Plus size={16} />
          새 작업
        </button>
        {message && <p className="status-message">{message}</p>}
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={selectedTask?.id === task.id ? "selected" : undefined}>
              <button type="button" className="task-select" onClick={() => setDraft(task)}>
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
              latestCapture={latestCapture}
              captureMessage={captureMessage}
              onChange={setDraft}
              onSave={() => void handleSave()}
              onStartBrowserCapture={() => void handleStartBrowserCapture()}
              onCaptureCoordinate={() => void handleCaptureCoordinate()}
              onDeleteStep={deleteDraftStep}
              onOpenProfile={openBrowserProfile}
              onCheckLogin={checkBrowserLogin}
            />
            {draft.id && (
              <button type="button" className="secondary-button detail-run-button" aria-label="즉시 실행" onClick={() => void handleRun(draft)}>
                <Play size={16} />
                즉시 실행
              </button>
            )}
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
