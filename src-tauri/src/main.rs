use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use clickpilot::{
    browser_bridge::{
        BrowserBridge, BrowserBridgeStatus, BrowserCaptureSession, CapturedBrowserElement,
    },
    browser_bridge_server::start_browser_bridge_server,
    commands::{self, ExecutionStartResult, LoginCheckResult},
    models::{AutomationTask, BrowserRunTarget, ExecutionLog},
    scheduler::start_scheduler,
    storage::Storage,
};
use serde::Serialize;
use tauri::State;

struct AppState {
    storage: Arc<Mutex<Storage>>,
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
    commands::start_task_now(&state.storage.lock().unwrap(), &state.browser_bridge, id)
        .map_err(error_message)
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
fn request_browser_capture(state: State<AppState>) -> Result<BrowserBridgeStatus, String> {
    if commands::request_browser_capture(&state.browser_bridge) {
        Ok(commands::browser_bridge_status(&state.browser_bridge))
    } else {
        Err("pairing token is missing or expired".into())
    }
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

#[tauri::command]
fn clear_execution_logs(state: State<AppState>) -> Result<(), String> {
    commands::clear_execution_logs(&state.storage.lock().unwrap()).map_err(error_message)
}

fn error_message(error: commands::AppError) -> String {
    error.to_string()
}

fn storage_root() -> PathBuf {
    storage_root_from_env(
        std::env::var_os("HOME").map(PathBuf::from),
        std::env::var_os("APPDATA").map(PathBuf::from),
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from),
    )
}

fn storage_root_from_env(
    home: Option<PathBuf>,
    appdata: Option<PathBuf>,
    xdg_data_home: Option<PathBuf>,
) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let _ = (&appdata, &xdg_data_home);
        return home
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
            .join("ClickPilot");
    }

    #[cfg(target_os = "windows")]
    {
        return appdata
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ClickPilot");
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        if let Some(xdg_data_home) = xdg_data_home {
            return xdg_data_home.join("clickpilot");
        }
        home.unwrap_or_else(|| PathBuf::from("."))
            .join(".local")
            .join("share")
            .join("clickpilot")
    }
}

fn main() {
    let browser_bridge = BrowserBridge::new(27183);
    let storage = Arc::new(Mutex::new(Storage::new(storage_root())));
    start_browser_bridge_server(browser_bridge.clone(), storage.clone());
    start_scheduler(storage.clone(), browser_bridge.clone());

    tauri::Builder::default()
        .manage(AppState {
            storage,
            browser_bridge,
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            save_task,
            delete_task,
            start_task_now,
            capture_position,
            browser_bridge_status,
            start_browser_capture,
            request_browser_capture,
            latest_browser_capture,
            open_browser_profile,
            check_browser_login,
            list_execution_logs,
            clear_execution_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClickPilot");
}

#[cfg(test)]
mod tests {
    use super::storage_root_from_env;
    use std::path::PathBuf;

    #[cfg(target_os = "macos")]
    #[test]
    fn storage_root_uses_macos_application_support() {
        assert_eq!(
            storage_root_from_env(Some(PathBuf::from("/Users/tester")), None, None),
            PathBuf::from("/Users/tester/Library/Application Support/ClickPilot")
        );
    }
}
