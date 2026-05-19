use std::{path::PathBuf, sync::Mutex};

use clickpilot::{
    browser_bridge::{BrowserBridge, BrowserBridgeStatus, BrowserCaptureSession, CapturedBrowserElement},
    commands::{self, ExecutionStartResult, LoginCheckResult},
    models::{AutomationTask, BrowserRunTarget, ExecutionLog},
    storage::Storage,
};
use serde::Serialize;
use tauri::State;

struct AppState {
    storage: Mutex<Storage>,
    browser_bridge: BrowserBridge,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CapturedPosition {
    x: i32,
    y: i32,
}

#[tauri::command]
fn list_tasks(state: State<AppState>) -> Result<Vec<AutomationTask>, String> {
    commands::list_tasks(&state.storage.lock().unwrap()).map_err(error_message)
}

#[tauri::command]
fn save_task(state: State<AppState>, task: AutomationTask) -> Result<AutomationTask, String> {
    commands::save_task(&state.storage.lock().unwrap(), task).map_err(error_message)
}

#[tauri::command]
fn delete_task(state: State<AppState>, id: String) -> Result<(), String> {
    commands::delete_task(&state.storage.lock().unwrap(), id).map_err(error_message)
}

#[tauri::command]
fn start_task_now(state: State<AppState>, id: String) -> Result<ExecutionStartResult, String> {
    commands::start_task_now(&state.storage.lock().unwrap(), id).map_err(error_message)
}

#[tauri::command]
fn capture_position() -> CapturedPosition {
    CapturedPosition { x: 0, y: 0 }
}

#[tauri::command]
fn browser_bridge_status(state: State<AppState>) -> BrowserBridgeStatus {
    commands::browser_bridge_status(&state.browser_bridge)
}

#[tauri::command]
fn start_browser_capture(state: State<AppState>) -> BrowserCaptureSession {
    commands::start_browser_capture(&state.browser_bridge)
}

#[tauri::command]
fn latest_browser_capture(state: State<AppState>) -> Option<CapturedBrowserElement> {
    commands::latest_browser_capture(&state.browser_bridge)
}

#[tauri::command]
fn open_browser_profile(target: BrowserRunTarget) -> Result<(), String> {
    commands::open_browser_profile(target).map_err(error_message)
}

#[tauri::command]
fn check_browser_login(target: BrowserRunTarget) -> Result<LoginCheckResult, String> {
    commands::check_browser_login(target).map_err(error_message)
}

#[tauri::command]
fn list_execution_logs(state: State<AppState>) -> Result<Vec<ExecutionLog>, String> {
    commands::list_execution_logs(&state.storage.lock().unwrap()).map_err(error_message)
}

fn error_message(error: commands::AppError) -> String {
    error.to_string()
}

fn storage_root() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".clickpilot")
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            storage: Mutex::new(Storage::new(storage_root())),
            browser_bridge: BrowserBridge::new(27183),
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            save_task,
            delete_task,
            start_task_now,
            capture_position,
            browser_bridge_status,
            start_browser_capture,
            latest_browser_capture,
            open_browser_profile,
            check_browser_login,
            list_execution_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClickPilot");
}
