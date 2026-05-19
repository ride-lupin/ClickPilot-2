use std::{fs, path::PathBuf};

use crate::models::{AutomationTask, ExecutionLog};

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
        Ok(serde_json::from_slice(&fs::read(path)?)?)
    }

    fn write_state(&self, state: &StoredState) -> Result<(), StorageError> {
        fs::create_dir_all(&self.root)?;
        fs::write(self.state_path(), serde_json::to_vec_pretty(state)?)?;
        Ok(())
    }
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
}
