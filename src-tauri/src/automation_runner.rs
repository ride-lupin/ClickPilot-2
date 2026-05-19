use std::{
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};

use serde::{Deserialize, Serialize};

use crate::models::{AutomationStep, BrowserKind};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerRequest {
    pub task_id: String,
    pub task_name: String,
    pub profile_dir: String,
    pub browser: BrowserKind,
    pub login_check_url: Option<String>,
    pub login_success_selector: Option<String>,
    pub steps: Vec<AutomationStep>,
    pub screenshot_dir: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum RunnerResult {
    Success {
        screenshot_path: String,
        clicked_steps: u32,
    },
    Failed {
        reason: String,
        message: String,
        screenshot_path: Option<String>,
        clicked_steps: u32,
    },
}

#[derive(Debug, thiserror::Error)]
pub enum AutomationRunnerError {
    #[error("runner io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("runner json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("automation runner failed")]
    Failed,
}

pub fn run_browser_steps_with_sidecar(
    sidecar_path: PathBuf,
    request: RunnerRequest,
) -> Result<RunnerResult, AutomationRunnerError> {
    let mut child = Command::new(sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    child
        .stdin
        .as_mut()
        .expect("sidecar stdin")
        .write_all(serde_json::to_vec(&request)?.as_slice())?;

    let output = child.wait_with_output()?;
    if !output.status.success() {
        return Err(AutomationRunnerError::Failed);
    }

    Ok(serde_json::from_slice(&output.stdout)?)
}
