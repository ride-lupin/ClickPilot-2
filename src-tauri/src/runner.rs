use crate::models::{AutomationStep, AutomationTask, BrowserRunTarget};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunSummary {
    pub managed_profile_step_count: usize,
    pub existing_tab_step_count: usize,
    pub coordinate_click_count: usize,
}

pub fn summarize_run(task: &AutomationTask) -> RunSummary {
    let browser_steps = task
        .steps
        .iter()
        .filter(|step| matches!(step, AutomationStep::BrowserElement(_)))
        .count();
    let coordinate_click_count = task
        .steps
        .iter()
        .filter(|step| matches!(step, AutomationStep::ScreenCoordinate(_)))
        .count();

    match task.run_target {
        BrowserRunTarget::ManagedProfile { .. } => RunSummary {
            managed_profile_step_count: browser_steps,
            existing_tab_step_count: 0,
            coordinate_click_count,
        },
        BrowserRunTarget::ExistingTab { .. } => RunSummary {
            managed_profile_step_count: 0,
            existing_tab_step_count: browser_steps,
            coordinate_click_count,
        },
    }
}
