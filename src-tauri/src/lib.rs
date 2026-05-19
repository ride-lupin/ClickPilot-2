pub mod models;
pub mod validation;
pub mod storage;
pub mod schedule;
pub mod runner;
pub mod browser_bridge;
pub mod automation_runner;
pub mod existing_tab_runner;
pub mod commands;

#[cfg(test)]
mod tests {
    use crate::models::*;
    use crate::validation::validate_task;

    fn browser_task_fixture() -> AutomationTask {
        AutomationTask {
            id: "task-browser-1".into(),
            name: "오전 신청".into(),
            enabled: true,
            schedule: Schedule::Daily {
                time_of_day: "09:00".into(),
            },
            steps: vec![AutomationStep::BrowserElement(BrowserElementStep {
                url_pattern: "https://example.com/apply*".into(),
                selector_candidates: vec![SelectorCandidate {
                    strategy: SelectorStrategy::Css,
                    value: "button.apply".into(),
                    confidence: 90,
                }],
                text_hint: Some("신청하기".into()),
                frame_path: vec![],
                click_offset_ratio: OffsetRatio { x: 0.5, y: 0.5 },
                wait: BrowserWaitPolicy {
                    timeout_ms: 15000,
                    poll_interval_ms: 100,
                    refresh_before_wait: true,
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
    fn browser_step_requires_url_pattern() {
        let mut task = browser_task_fixture();
        if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
            step.url_pattern.clear();
        }

        let error = validate_task(&task).unwrap_err();

        assert_eq!(error.code, "browser_url_required");
    }

    #[test]
    fn browser_step_requires_selector_candidate() {
        let mut task = browser_task_fixture();
        if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
            step.selector_candidates.clear();
        }

        let error = validate_task(&task).unwrap_err();

        assert_eq!(error.code, "browser_selector_required");
    }

    #[test]
    fn browser_step_rejects_zero_poll_interval() {
        let mut task = browser_task_fixture();
        if let AutomationStep::BrowserElement(step) = &mut task.steps[0] {
            step.wait.poll_interval_ms = 0;
        }

        let error = validate_task(&task).unwrap_err();

        assert_eq!(error.code, "browser_poll_interval_invalid");
    }
}
