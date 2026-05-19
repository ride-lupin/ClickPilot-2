use std::{fs, path::PathBuf};

use uuid::Uuid;

use crate::{
    browser_bridge::ExistingTabExecutionResult,
    models::{AutomationTask, ExecutionLog, ExecutionStatus},
};

#[derive(Debug, Clone)]
pub struct Storage {
    root: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("storage io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("storage json error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredState {
    version: u32,
    tasks: Vec<AutomationTask>,
    execution_logs: Vec<ExecutionLog>,
}

impl Storage {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn list_tasks(&self) -> Result<Vec<AutomationTask>, StorageError> {
        Ok(self.read_state()?.tasks)
    }

    pub fn save_task(&self, task: AutomationTask) -> Result<AutomationTask, StorageError> {
        let mut state = self.read_state()?;
        let mut task = task;
        if task.id.trim().is_empty() {
            task.id = format!("task-{}", Uuid::new_v4());
        }
        state.tasks.retain(|candidate| candidate.id != task.id);
        state.tasks.push(task.clone());
        self.write_state(&state)?;
        Ok(task)
    }

    pub fn delete_task(&self, id: &str) -> Result<(), StorageError> {
        let mut state = self.read_state()?;
        state.tasks.retain(|candidate| candidate.id != id);
        self.write_state(&state)
    }

    pub fn list_execution_logs(&self) -> Result<Vec<ExecutionLog>, StorageError> {
        Ok(self.read_state()?.execution_logs)
    }

    pub fn append_execution_log(&self, log: ExecutionLog) -> Result<(), StorageError> {
        let mut state = self.read_state()?;
        state.execution_logs.insert(0, log);
        self.write_state(&state)
    }

    pub fn clear_execution_logs(&self) -> Result<(), StorageError> {
        let mut state = self.read_state()?;
        state.execution_logs.clear();
        self.write_state(&state)
    }

    pub fn append_existing_tab_result_log(
        &self,
        result: ExistingTabExecutionResult,
    ) -> Result<(), StorageError> {
        let status = if result.status == "success" {
            ExecutionStatus::Success
        } else {
            ExecutionStatus::Failed
        };
        self.append_execution_log(ExecutionLog {
            id: Uuid::new_v4().to_string(),
            task_id: result.task_id,
            task_name: result.task_name,
            status,
            message: result.message,
            failure_reason: result.reason,
            screenshot_path: result.screenshot_data_url,
            started_at: chrono::Utc::now().to_rfc3339(),
            finished_at: Some(chrono::Utc::now().to_rfc3339()),
        })
    }

    fn state_path(&self) -> PathBuf {
        self.root.join("clickpilot-state.json")
    }

    fn read_state(&self) -> Result<StoredState, StorageError> {
        let path = self.state_path();
        if !path.exists() {
            return Ok(StoredState {
                version: 1,
                ..StoredState::default()
            });
        }
        let mut state: StoredState = serde_json::from_slice(&fs::read(path)?)?;
        let changed = assign_missing_task_ids(&mut state.tasks);
        if changed {
            self.write_state(&state)?;
        }
        Ok(state)
    }

    fn write_state(&self, state: &StoredState) -> Result<(), StorageError> {
        fs::create_dir_all(&self.root)?;
        fs::write(self.state_path(), serde_json::to_vec_pretty(state)?)?;
        Ok(())
    }
}

fn assign_missing_task_ids(tasks: &mut [AutomationTask]) -> bool {
    let mut changed = false;
    for task in tasks {
        if task.id.trim().is_empty() {
            task.id = format!("task-{}", Uuid::new_v4());
            changed = true;
        }
    }
    changed
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::models::*;

    use super::*;

    fn task_fixture(id: &str) -> AutomationTask {
        AutomationTask {
            id: id.into(),
            name: "저장된 작업".into(),
            enabled: true,
            schedule: Schedule::Daily {
                time_of_day: "09:00".into(),
            },
            steps: vec![AutomationStep::ScreenCoordinate(ScreenCoordinateStep {
                x: 100,
                y: 120,
                button: MouseButton::Left,
                click_count: 1,
                delay_after_ms: 500,
            })],
            safety: Safety {
                countdown_seconds: 0,
                stop_hotkey: "Ctrl+Alt+S".into(),
            },
            run_target: BrowserRunTarget::ManagedProfile {
                browser: BrowserKind::Chrome,
                profile_id: "default".into(),
                preopen_seconds: 30,
                login_check_url: None,
                login_success_selector: None,
            },
            fast_click: None,
            created_at: "2026-05-19T00:00:00.000Z".into(),
            updated_at: "2026-05-19T00:00:00.000Z".into(),
        }
    }

    #[test]
    fn saves_and_deletes_tasks() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());

        storage.save_task(task_fixture("task-1")).unwrap();
        assert_eq!(storage.list_tasks().unwrap().len(), 1);

        storage.delete_task("task-1").unwrap();
        assert!(storage.list_tasks().unwrap().is_empty());
    }

    #[test]
    fn appends_existing_tab_result_log() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());

        storage
            .append_existing_tab_result_log(crate::browser_bridge::ExistingTabExecutionResult {
                execution_id: "execution-1".into(),
                task_id: "task-1".into(),
                task_name: "예약 작업".into(),
                status: "failed".into(),
                reason: Some("elementNotFound".into()),
                message: Some("No element matched.".into()),
                clicked_steps: 0,
                screenshot_data_url: Some("data:image/png;base64,abc".into()),
            })
            .unwrap();

        let logs = storage.list_execution_logs().unwrap();
        assert_eq!(logs[0].task_id, "task-1");
        assert_eq!(logs[0].status, ExecutionStatus::Failed);
        assert_eq!(logs[0].failure_reason.as_deref(), Some("elementNotFound"));
        assert_eq!(
            logs[0].screenshot_path.as_deref(),
            Some("data:image/png;base64,abc")
        );
        assert!(logs[0].finished_at.is_some());
    }

    #[test]
    fn clears_execution_logs_without_deleting_tasks() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());
        storage.save_task(task_fixture("task-1")).unwrap();
        storage
            .append_existing_tab_result_log(crate::browser_bridge::ExistingTabExecutionResult {
                execution_id: "execution-1".into(),
                task_id: "task-1".into(),
                task_name: "예약 작업".into(),
                status: "failed".into(),
                reason: Some("elementNotFound".into()),
                message: None,
                clicked_steps: 0,
                screenshot_data_url: None,
            })
            .unwrap();

        storage.clear_execution_logs().unwrap();

        assert!(storage.list_execution_logs().unwrap().is_empty());
        assert_eq!(storage.list_tasks().unwrap().len(), 1);
    }

    #[test]
    fn save_task_assigns_missing_id() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());

        let saved = storage.save_task(task_fixture("")).unwrap();

        assert!(saved.id.starts_with("task-"));
        assert_eq!(storage.list_tasks().unwrap()[0].id, saved.id);
    }
}
