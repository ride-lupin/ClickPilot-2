use uuid::Uuid;

use crate::{
    browser_bridge::{BrowserBridge, ExistingTabExecutionRequest},
    models::{AutomationStep, AutomationTask, BrowserRunTarget},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingTabRunReceipt {
    pub execution_id: String,
    pub browser_step_count: usize,
}

pub fn enqueue_existing_tab_run(
    bridge: &BrowserBridge,
    task: &AutomationTask,
) -> Option<ExistingTabRunReceipt> {
    let BrowserRunTarget::ExistingTab {
        browser,
        tab_url_pattern,
        require_active_tab,
        login_check_url,
        login_success_selector,
        ..
    } = &task.run_target
    else {
        return None;
    };

    let steps = task
        .steps
        .iter()
        .filter_map(|step| match step {
            AutomationStep::BrowserElement(_) | AutomationStep::BrowserRefresh(_) => {
                Some(step.clone())
            }
            AutomationStep::ScreenCoordinate(_) => None,
        })
        .collect::<Vec<_>>();

    let execution_id = Uuid::new_v4().to_string();
    bridge.enqueue_existing_tab(ExistingTabExecutionRequest {
        execution_id: execution_id.clone(),
        task_id: task.id.clone(),
        task_name: task.name.clone(),
        browser: format!("{:?}", browser).to_ascii_lowercase(),
        tab_url_pattern: extension_tab_url_pattern(tab_url_pattern),
        require_active_tab: *require_active_tab,
        login_check_url: login_check_url.clone(),
        login_success_selector: login_success_selector.clone(),
        fast_click: task.fast_click.clone().filter(|settings| settings.enabled),
        steps: steps.clone(),
    });

    Some(ExistingTabRunReceipt {
        execution_id,
        browser_step_count: steps.len(),
    })
}

fn extension_tab_url_pattern(tab_url_pattern: &str) -> String {
    let trimmed = tab_url_pattern.trim();
    if trimmed.contains("://") || trimmed.contains('*') {
        return trimmed.to_string();
    }

    format!("*://{}/*", trimmed.trim_end_matches('/'))
}

#[cfg(test)]
mod tests {
    use crate::{
        browser_bridge::BrowserBridge,
        models::{
            AutomationStep, AutomationTask, BrowserElementStep, BrowserRetryPolicy,
            BrowserRunTarget, BrowserWaitPolicy, ExistingTabBrowserKind, FrameTarget, OffsetRatio,
            Safety, Schedule, SelectorCandidate, SelectorStrategy,
        },
    };

    use super::enqueue_existing_tab_run;

    fn existing_tab_task(tab_url_pattern: &str) -> AutomationTask {
        AutomationTask {
            id: "task-existing-tab".into(),
            name: "구매 관리".into(),
            enabled: true,
            schedule: Schedule::Daily {
                time_of_day: "12:59".into(),
            },
            steps: vec![AutomationStep::BrowserElement(BrowserElementStep {
                url_pattern: "https://ride-office.kr/apply".into(),
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
                tab_url_pattern: tab_url_pattern.into(),
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
    fn domain_target_is_sent_as_extension_compatible_url_pattern() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));

        enqueue_existing_tab_run(&bridge, &existing_tab_task("ride-office.kr"));

        let queued = bridge
            .next_existing_tab(&session.pairing_token)
            .expect("queued execution");
        assert_eq!(queued.tab_url_pattern, "*://ride-office.kr/*");
    }

    #[test]
    fn explicit_url_target_is_sent_unchanged() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));

        enqueue_existing_tab_run(&bridge, &existing_tab_task("https://ride-office.kr/"));

        let queued = bridge
            .next_existing_tab(&session.pairing_token)
            .expect("queued execution");
        assert_eq!(queued.tab_url_pattern, "https://ride-office.kr/");
    }
}
