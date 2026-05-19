import { invoke } from "@tauri-apps/api/core";
import type {
  AutomationTask,
  BrowserBridgeStatus,
  BrowserCaptureSession,
  BrowserRunTarget,
  CapturedBrowserElement,
  ExecutionLog,
  ExecutionStartResult,
  LoginCheckResult,
  ManagedBrowserProfileTarget,
} from "./types";

const taskStorageKey = "clickpilot.tasks";
const logStorageKey = "clickpilot.executionLogs";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function readTasks(): AutomationTask[] {
  return JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]") as AutomationTask[];
}

function writeTasks(tasks: AutomationTask[]) {
  window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
}

function readLogs(): ExecutionLog[] {
  return JSON.parse(window.localStorage.getItem(logStorageKey) ?? "[]") as ExecutionLog[];
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function call<T>(command: string, args?: Record<string, unknown>, fallback?: () => T | Promise<T>): Promise<T> {
  if (isTauriRuntime()) return invoke<T>(command, args);
  if (!fallback) throw new Error(`No browser fallback for ${command}`);
  return fallback();
}

export function listTasks() {
  return call<AutomationTask[]>("list_tasks", undefined, () => readTasks());
}

export function saveTask(task: AutomationTask) {
  return call<AutomationTask>("save_task", { task }, () => {
    const tasks = readTasks();
    const now = new Date().toISOString();
    const saved = {
      ...task,
      id: task.id || makeId("task"),
      createdAt: task.createdAt || now,
      updatedAt: now,
    };
    writeTasks([...tasks.filter((candidate) => candidate.id !== saved.id), saved]);
    return saved;
  });
}

export function deleteTask(id: string) {
  return call<void>("delete_task", { id }, () => {
    writeTasks(readTasks().filter((task) => task.id !== id));
  });
}

export function startTaskNow(id: string) {
  return call<ExecutionStartResult>("start_task_now", { id }, () => {
    const task = readTasks().find((candidate) => candidate.id === id);
    const logs = readLogs();
    if (task) {
      window.localStorage.setItem(
        logStorageKey,
        JSON.stringify([
          {
            id: makeId("log"),
            taskId: task.id,
            taskName: task.name,
            status: "started",
            startedAt: new Date().toISOString(),
          },
          ...logs,
        ]),
      );
    }
    return { taskId: id, status: "started" };
  });
}

export function capturePosition() {
  return call<{ x: number; y: number }>("capture_position", undefined, () => ({ x: 0, y: 0 }));
}

export function browserBridgeStatus() {
  return call<BrowserBridgeStatus>("browser_bridge_status", undefined, () => ({
    port: 27183,
    paired: false,
    captureActive: false,
  }));
}

export function startBrowserCapture() {
  return call<BrowserCaptureSession>("start_browser_capture", undefined, () => ({
    port: 27183,
    pairingToken: "local-dev",
  }));
}

export function getLatestBrowserCapture() {
  return call<CapturedBrowserElement | null>("latest_browser_capture", undefined, () => null);
}

export function openBrowserProfile(target: ManagedBrowserProfileTarget) {
  return call<void>("open_browser_profile", { target }, () => undefined);
}

export function checkBrowserLogin(target: BrowserRunTarget) {
  return call<LoginCheckResult>("check_browser_login", { target }, () => ({ status: "success" }));
}

export function listExecutionLogs() {
  return call<ExecutionLog[]>("list_execution_logs", undefined, () => readLogs());
}
