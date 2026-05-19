use uuid::Uuid;

use crate::{
    browser_bridge::{BrowserBridge, ExistingTabExecutionRequest},
    models::{AutomationTask, AutomationStep, BrowserRunTarget},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingTabRunReceipt {
    pub execution_id: String,
    pub browser_step_count: usize,
}

pub fn enqueue_existing_tab_run(bridge: &BrowserBridge, task: &AutomationTask) -> Option<ExistingTabRunReceipt> {
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
            AutomationStep::BrowserElement(step) => Some(step.clone()),
            AutomationStep::ScreenCoordinate(_) => None,
        })
        .collect::<Vec<_>>();

    let execution_id = Uuid::new_v4().to_string();
    bridge.enqueue_existing_tab(ExistingTabExecutionRequest {
        execution_id: execution_id.clone(),
        task_id: task.id.clone(),
        task_name: task.name.clone(),
        browser: format!("{:?}", browser).to_ascii_lowercase(),
        tab_url_pattern: tab_url_pattern.clone(),
        require_active_tab: *require_active_tab,
        login_check_url: login_check_url.clone(),
        login_success_selector: login_success_selector.clone(),
        steps: steps.clone(),
    });

    Some(ExistingTabRunReceipt {
        execution_id,
        browser_step_count: steps.len(),
    })
}
