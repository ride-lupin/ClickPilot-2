use crate::models::{AutomationStep, AutomationTask, BrowserRunTarget, FastClickRefreshPolicy};

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
    validate_fast_click(task)?;

    for step in &task.steps {
        match step {
            AutomationStep::BrowserElement(step) => {
                if !is_http_pattern(&step.url_pattern) {
                    return Err(error(
                        "browser_url_required",
                        "Browser step URL pattern must start with http:// or https://",
                    ));
                }
                if step.selector_candidates.is_empty() {
                    return Err(error(
                        "browser_selector_required",
                        "Browser step requires a selector candidate",
                    ));
                }
                if !(0.0..=1.0).contains(&step.click_offset_ratio.x)
                    || !(0.0..=1.0).contains(&step.click_offset_ratio.y)
                {
                    return Err(error(
                        "browser_click_offset_invalid",
                        "Click offset must be between 0.0 and 1.0",
                    ));
                }
                if !(1000..=120000).contains(&step.wait.timeout_ms) {
                    return Err(error(
                        "browser_wait_timeout_invalid",
                        "Wait timeout must be between 1000 and 120000ms",
                    ));
                }
                if !(50..=5000).contains(&step.wait.poll_interval_ms) {
                    return Err(error(
                        "browser_poll_interval_invalid",
                        "Poll interval must be between 50 and 5000ms",
                    ));
                }
                if !(1..=10).contains(&step.retry.max_attempts) {
                    return Err(error(
                        "browser_retry_attempts_invalid",
                        "Retry attempts must be between 1 and 10",
                    ));
                }
            }
            AutomationStep::BrowserRefresh(step) => {
                if let Some(url_pattern) = &step.url_pattern {
                    if !is_http_pattern(url_pattern) {
                        return Err(error(
                            "browser_refresh_url_invalid",
                            "Refresh step URL pattern must start with http:// or https://",
                        ));
                    }
                }
                validate_wait_policy(&step.wait)?;
            }
            AutomationStep::ScreenCoordinate(step) => {
                if step.click_count == 0 {
                    return Err(error(
                        "coordinate_click_count_invalid",
                        "Coordinate click count must be at least 1",
                    ));
                }
            }
        }
    }

    Ok(())
}

fn validate_fast_click(task: &AutomationTask) -> Result<(), ValidationError> {
    let Some(settings) = &task.fast_click else {
        return Ok(());
    };
    if !settings.enabled {
        return Ok(());
    }
    if !matches!(task.run_target, BrowserRunTarget::ExistingTab { .. }) {
        return Err(error(
            "fast_click_existing_tab_required",
            "Fast click mode requires an existing browser tab target",
        ));
    }
    if !(1000..=120000).contains(&settings.max_wait_ms) {
        return Err(error(
            "fast_click_max_wait_invalid",
            "Fast click max wait must be between 1000 and 120000ms",
        ));
    }
    if matches!(
        settings.refresh_policy,
        FastClickRefreshPolicy::RepeatAfterStart
    ) && !(500..=10000).contains(&settings.refresh_interval_ms)
    {
        return Err(error(
            "fast_click_refresh_interval_invalid",
            "Fast click refresh interval must be between 500 and 10000ms",
        ));
    }
    Ok(())
}

fn validate_wait_policy(wait: &crate::models::BrowserWaitPolicy) -> Result<(), ValidationError> {
    if !(1000..=120000).contains(&wait.timeout_ms) {
        return Err(error(
            "browser_wait_timeout_invalid",
            "Wait timeout must be between 1000 and 120000ms",
        ));
    }
    if !(50..=5000).contains(&wait.poll_interval_ms) {
        return Err(error(
            "browser_poll_interval_invalid",
            "Poll interval must be between 50 and 5000ms",
        ));
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
                return Err(error(
                    "browser_profile_required",
                    "Managed browser profile is required",
                ));
            }
            validate_preopen(*preopen_seconds)
        }
        BrowserRunTarget::ExistingTab {
            preopen_seconds,
            tab_url_pattern,
            ..
        } => {
            validate_preopen(*preopen_seconds)?;
            if !is_http_pattern(tab_url_pattern) && !is_domain_pattern(tab_url_pattern) {
                return Err(error(
                    "existing_tab_url_required",
                    "Existing tab target must be a domain or start with http:// or https://",
                ));
            }
            Ok(())
        }
    }
}

fn validate_preopen(preopen_seconds: u32) -> Result<(), ValidationError> {
    if preopen_seconds > 300 {
        return Err(error(
            "browser_preopen_invalid",
            "Preopen seconds must be between 0 and 300",
        ));
    }
    Ok(())
}

fn is_http_pattern(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn is_domain_pattern(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && !trimmed.contains("://")
        && !trimmed.contains(char::is_whitespace)
        && trimmed.contains('.')
}

fn error(code: &'static str, message: &'static str) -> ValidationError {
    ValidationError { code, message }
}
