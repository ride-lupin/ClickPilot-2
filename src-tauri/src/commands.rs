use uuid::Uuid;

use crate::{
    browser_bridge::{
        BrowserBridge, BrowserBridgeStatus, BrowserCaptureSession, CapturedBrowserElement,
    },
    existing_tab_runner::enqueue_existing_tab_run,
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
    let mut task = task;
    if task.id.trim().is_empty() {
        task.id = format!("task-{}", Uuid::new_v4());
    }
    validate_task(&task)?;
    Ok(storage.save_task(task)?)
}

pub fn delete_task(storage: &Storage, id: String) -> Result<(), AppError> {
    Ok(storage.delete_task(&id)?)
}

pub fn start_task_now(
    storage: &Storage,
    bridge: &BrowserBridge,
    id: String,
) -> Result<ExecutionStartResult, AppError> {
    let task = storage
        .list_tasks()?
        .into_iter()
        .find(|task| task.id == id)
        .ok_or(AppError::NotFound)?;

    enqueue_existing_tab_run(bridge, &task);

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

pub fn start_browser_capture(
    storage: &Storage,
    bridge: &BrowserBridge,
) -> Result<BrowserCaptureSession, AppError> {
    let session = bridge.start_capture();
    storage.save_browser_pairing_token(session.pairing_token.clone())?;
    Ok(session)
}

pub fn request_browser_capture(bridge: &BrowserBridge) -> bool {
    bridge.request_capture()
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

pub fn clear_execution_logs(storage: &Storage) -> Result<(), AppError> {
    Ok(storage.clear_execution_logs()?)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::{
        browser_bridge::BrowserBridge,
        models::{
            AutomationStep, AutomationTask, BrowserElementStep, BrowserRetryPolicy,
            BrowserRunTarget, BrowserWaitPolicy, ExistingTabBrowserKind, FrameTarget, OffsetRatio,
            Safety, Schedule, SelectorCandidate, SelectorStrategy,
        },
        storage::Storage,
    };

    use super::start_task_now;

    fn existing_tab_task() -> AutomationTask {
        AutomationTask {
            id: "task-existing-tab".into(),
            name: "구매 관리".into(),
            enabled: true,
            schedule: Schedule::Daily {
                time_of_day: "12:59".into(),
            },
            steps: vec![AutomationStep::BrowserElement(BrowserElementStep {
                url_pattern: "https://admin.kgmexcenter.com/admin/notice".into(),
                selector_candidates: vec![SelectorCandidate {
                    strategy: SelectorStrategy::Css,
                    value: "button.buy".into(),
                    confidence: 90,
                }],
                text_hint: Some("구매 관리".into()),
                frame_path: Vec::<FrameTarget>::new(),
                click_offset_ratio: OffsetRatio { x: 0.5, y: 0.5 },
                wait: BrowserWaitPolicy {
                    timeout_ms: 15000,
                    poll_interval_ms: 100,
                    refresh_before_wait: false,
                },
                retry: BrowserRetryPolicy {
                    max_attempts: 3,
                    retry_delay_ms: 250,
                },
                delay_after_ms: 500,
            })],
            safety: Safety {
                countdown_seconds: 0,
                stop_hotkey: "Ctrl+Alt+S".into(),
            },
            run_target: BrowserRunTarget::ExistingTab {
                browser: ExistingTabBrowserKind::Chrome,
                preopen_seconds: 30,
                tab_url_pattern: "https://admin.kgmexcenter.com/admin/notice".into(),
                require_active_tab: false,
                login_check_url: None,
                login_success_selector: None,
            },
            fast_click: None,
            created_at: "2026-05-19T00:00:00.000Z".into(),
            updated_at: "2026-05-19T00:00:00.000Z".into(),
        }
    }

    #[test]
    fn start_task_now_enqueues_existing_tab_steps_for_extension_polling() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());
        storage.save_task(existing_tab_task()).unwrap();
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));

        start_task_now(&storage, &bridge, "task-existing-tab".into()).unwrap();

        let queued = bridge
            .next_existing_tab(&session.pairing_token)
            .expect("queued execution");
        assert_eq!(queued.task_id, "task-existing-tab");
        assert_eq!(queued.task_name, "구매 관리");
        assert_eq!(queued.steps.len(), 1);
        assert_eq!(storage.list_execution_logs().unwrap().len(), 1);
    }

    #[test]
    fn save_task_assigns_id_when_new_task_has_empty_id() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());
        let mut task = existing_tab_task();
        task.id.clear();

        let saved = super::save_task(&storage, task).unwrap();

        assert!(saved.id.starts_with("task-"));
        assert_eq!(storage.list_tasks().unwrap()[0].id, saved.id);
    }

    #[test]
    fn start_task_now_passes_enabled_fast_click_settings_to_extension() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());
        let mut task = existing_tab_task();
        task.fast_click = Some(crate::models::FastClickSettings {
            enabled: true,
            arm_before_ms: 5000,
            refresh_policy: crate::models::FastClickRefreshPolicy::OnceAtStart,
            refresh_interval_ms: 500,
            max_wait_ms: 10000,
            click_when: crate::models::FastClickCondition {
                visible: true,
                not_disabled: true,
                text_includes: None,
            },
        });
        storage.save_task(task).unwrap();
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));

        start_task_now(&storage, &bridge, "task-existing-tab".into()).unwrap();

        let queued = bridge
            .next_existing_tab(&session.pairing_token)
            .expect("queued execution");
        assert!(queued.fast_click.is_some());
        assert_eq!(queued.fast_click.unwrap().refresh_interval_ms, 500);
    }
}
