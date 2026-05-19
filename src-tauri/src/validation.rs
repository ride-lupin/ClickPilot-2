use crate::models::{AutomationStep, AutomationTask, BrowserRunTarget};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    pub code: &'static str,
    pub message: &'static str,
}

pub fn validate_task(task: &AutomationTask) -> Result<(), ValidationError> {
    if task.name.trim().is_empty() {
        return Err(error("task_name_required", "Task name is required"));
    }

    if task.steps.is_empty() {
        return Err(error("task_step_required", "At least one step is required"));
    }

    validate_run_target(&task.run_target)?;

    for step in &task.steps {
        match step {
            AutomationStep::BrowserElement(step) => {
                if !is_http_pattern(&step.url_pattern) {
                    return Err(error("browser_url_required", "Browser step URL pattern must start with http:// or https://"));
                }
                if step.selector_candidates.is_empty() {
                    return Err(error("browser_selector_required", "Browser step requires a selector candidate"));
                }
                if !(0.0..=1.0).contains(&step.click_offset_ratio.x) || !(0.0..=1.0).contains(&step.click_offset_ratio.y) {
                    return Err(error("browser_click_offset_invalid", "Click offset must be between 0.0 and 1.0"));
                }
                if !(1000..=120000).contains(&step.wait.timeout_ms) {
                    return Err(error("browser_wait_timeout_invalid", "Wait timeout must be between 1000 and 120000ms"));
                }
                if !(50..=5000).contains(&step.wait.poll_interval_ms) {
                    return Err(error("browser_poll_interval_invalid", "Poll interval must be between 50 and 5000ms"));
                }
                if !(1..=10).contains(&step.retry.max_attempts) {
                    return Err(error("browser_retry_attempts_invalid", "Retry attempts must be between 1 and 10"));
                }
            }
            AutomationStep::ScreenCoordinate(step) => {
                if step.click_count == 0 {
                    return Err(error("coordinate_click_count_invalid", "Coordinate click count must be at least 1"));
                }
            }
        }
    }

    Ok(())
}

fn validate_run_target(target: &BrowserRunTarget) -> Result<(), ValidationError> {
    match target {
        BrowserRunTarget::ManagedProfile {
            preopen_seconds,
            profile_id,
            ..
        } => {
            if profile_id.trim().is_empty() {
                return Err(error("browser_profile_required", "Managed browser profile is required"));
            }
            validate_preopen(*preopen_seconds)
        }
        BrowserRunTarget::ExistingTab {
            preopen_seconds,
            tab_url_pattern,
            ..
        } => {
            validate_preopen(*preopen_seconds)?;
            if !is_http_pattern(tab_url_pattern) {
                return Err(error("existing_tab_url_required", "Existing tab URL pattern must start with http:// or https://"));
            }
            Ok(())
        }
    }
}

fn validate_preopen(preopen_seconds: u32) -> Result<(), ValidationError> {
    if preopen_seconds > 300 {
        return Err(error("browser_preopen_invalid", "Preopen seconds must be between 0 and 300"));
    }
    Ok(())
}

fn is_http_pattern(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn error(code: &'static str, message: &'static str) -> ValidationError {
    ValidationError { code, message }
}
