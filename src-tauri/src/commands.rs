use uuid::Uuid;

use crate::{
    browser_bridge::{BrowserBridge, BrowserBridgeStatus, BrowserCaptureSession, CapturedBrowserElement},
    models::{AutomationTask, BrowserRunTarget, ExecutionLog, ExecutionStatus},
    storage::{Storage, StorageError},
    validation::{validate_task, ValidationError},
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStartResult {
    pub task_id: String,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginCheckResult {
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("validation error: {0}")]
    Validation(&'static str),
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
    #[error("task not found")]
    NotFound,
}

impl From<ValidationError> for AppError {
    fn from(value: ValidationError) -> Self {
        Self::Validation(value.code)
    }
}

pub fn list_tasks(storage: &Storage) -> Result<Vec<AutomationTask>, AppError> {
    Ok(storage.list_tasks()?)
}

pub fn save_task(storage: &Storage, task: AutomationTask) -> Result<AutomationTask, AppError> {
    validate_task(&task)?;
    Ok(storage.save_task(task)?)
}

pub fn delete_task(storage: &Storage, id: String) -> Result<(), AppError> {
    Ok(storage.delete_task(&id)?)
}

pub fn start_task_now(storage: &Storage, id: String) -> Result<ExecutionStartResult, AppError> {
    let task = storage
        .list_tasks()?
        .into_iter()
        .find(|task| task.id == id)
        .ok_or(AppError::NotFound)?;

    storage.append_execution_log(ExecutionLog {
        id: Uuid::new_v4().to_string(),
        task_id: task.id.clone(),
        task_name: task.name,
        status: ExecutionStatus::Started,
        message: Some("작업 실행을 시작했습니다.".into()),
        failure_reason: None,
        screenshot_path: None,
        started_at: chrono::Utc::now().to_rfc3339(),
        finished_at: None,
    })?;

    Ok(ExecutionStartResult {
        task_id: task.id,
        status: "started".into(),
    })
}

pub fn browser_bridge_status(bridge: &BrowserBridge) -> BrowserBridgeStatus {
    bridge.status()
}

pub fn start_browser_capture(bridge: &BrowserBridge) -> BrowserCaptureSession {
    bridge.start_capture()
}

pub fn latest_browser_capture(bridge: &BrowserBridge) -> Option<CapturedBrowserElement> {
    bridge.latest_capture()
}

pub fn open_browser_profile(_target: BrowserRunTarget) -> Result<(), AppError> {
    Ok(())
}

pub fn check_browser_login(_target: BrowserRunTarget) -> Result<LoginCheckResult, AppError> {
    Ok(LoginCheckResult {
        status: "success".into(),
        message: None,
    })
}

pub fn list_execution_logs(storage: &Storage) -> Result<Vec<ExecutionLog>, AppError> {
    Ok(storage.list_execution_logs()?)
}
