use chrono::{DateTime, FixedOffset, TimeDelta};

use crate::models::{AutomationTask, Schedule};

pub fn compute_preopen_time(
    run_at: &str,
    preopen_seconds: u32,
) -> Result<DateTime<FixedOffset>, chrono::ParseError> {
    let run_at = DateTime::parse_from_rfc3339(run_at)?;
    Ok(run_at - TimeDelta::seconds(preopen_seconds as i64))
}

pub fn next_run_label(task: &AutomationTask) -> String {
    if !task.enabled {
        return "예약 비활성".into();
    }

    match &task.schedule {
        Schedule::OneShot { run_at } => run_at.clone(),
        Schedule::Daily { time_of_day } | Schedule::Weekly { time_of_day, .. } => {
            time_of_day.clone()
        }
        Schedule::RepeatInterval { interval_ms, .. } => format!("{}초마다", interval_ms / 1000),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_task_preopen_time_is_before_run_time() {
        let run_at = "2026-05-19T09:00:00+09:00";
        let preopen_at = compute_preopen_time(run_at, 30).unwrap();

        assert_eq!(preopen_at.to_rfc3339(), "2026-05-19T08:59:30+09:00");
    }
}
