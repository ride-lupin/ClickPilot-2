use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use chrono::{DateTime, Datelike, FixedOffset, Local, Timelike};

use crate::{
    browser_bridge::BrowserBridge,
    commands::{self, AppError},
    models::{AutomationTask, Schedule},
    storage::Storage,
};

#[derive(Default)]
pub struct SchedulerState {
    fired_keys: HashSet<String>,
    repeat_run_counts: HashMap<String, u32>,
}

pub fn start_scheduler(storage: Arc<Mutex<Storage>>, bridge: BrowserBridge) {
    thread::spawn(move || {
        let mut state = SchedulerState::default();
        loop {
            if let Ok(storage) = storage.lock() {
                let now = Local::now().fixed_offset();
                if let Err(error) = run_due_tasks(&storage, &bridge, now, &mut state) {
                    eprintln!("scheduled task check failed: {error}");
                }
            }
            thread::sleep(Duration::from_secs(1));
        }
    });
}

pub fn run_due_tasks(
    storage: &Storage,
    bridge: &BrowserBridge,
    now: DateTime<FixedOffset>,
    state: &mut SchedulerState,
) -> Result<usize, AppError> {
    let mut started = 0;
    for task in storage
        .list_tasks()?
        .into_iter()
        .filter(|task| task.enabled)
    {
        let Some(key) = due_key(&task, now, state) else {
            continue;
        };
        if state.fired_keys.contains(&key) {
            continue;
        }
        commands::start_task_now(storage, bridge, task.id.clone())?;
        if matches!(task.schedule, Schedule::RepeatInterval { .. }) {
            *state.repeat_run_counts.entry(task.id.clone()).or_default() += 1;
        }
        state.fired_keys.insert(key);
        started += 1;
    }
    Ok(started)
}

fn due_key(
    task: &AutomationTask,
    now: DateTime<FixedOffset>,
    state: &SchedulerState,
) -> Option<String> {
    match &task.schedule {
        Schedule::Daily { time_of_day } => minute_matches(time_of_day, now)
            .then(|| format!("{}:daily:{}", task.id, minute_key(now))),
        Schedule::Weekly { days, time_of_day } => {
            let weekday = korean_weekday(now);
            (days.iter().any(|day| day == weekday) && minute_matches(time_of_day, now))
                .then(|| format!("{}:weekly:{}:{}", task.id, weekday, minute_key(now)))
        }
        Schedule::OneShot { run_at } => {
            let run_at = DateTime::parse_from_rfc3339(run_at).ok()?;
            (now >= run_at).then(|| format!("{}:one-shot:{}", task.id, run_at.to_rfc3339()))
        }
        Schedule::RepeatInterval {
            interval_ms,
            max_runs,
            end_at,
        } => {
            if *interval_ms == 0 {
                return None;
            }
            if let Some(end_at) = end_at {
                let end_at = DateTime::parse_from_rfc3339(end_at).ok()?;
                if now > end_at {
                    return None;
                }
            }
            let run_count = state.repeat_run_counts.get(&task.id).copied().unwrap_or(0);
            if max_runs.is_some_and(|max_runs| run_count >= max_runs) {
                return None;
            }
            let interval_seconds = ((*interval_ms + 999) / 1000).max(1) as i64;
            Some(format!(
                "{}:repeat:{}",
                task.id,
                now.timestamp() / interval_seconds
            ))
        }
    }
}

fn minute_matches(time_of_day: &str, now: DateTime<FixedOffset>) -> bool {
    let Some((hour, minute)) = parse_time_of_day(time_of_day) else {
        return false;
    };
    now.hour() == hour && now.minute() == minute
}

fn parse_time_of_day(value: &str) -> Option<(u32, u32)> {
    let mut parts = value.split(':');
    let hour = parts.next()?.parse::<u32>().ok()?;
    let minute = parts.next()?.parse::<u32>().ok()?;
    if parts.next().is_some() || hour > 23 || minute > 59 {
        return None;
    }
    Some((hour, minute))
}

fn minute_key(now: DateTime<FixedOffset>) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}",
        now.year(),
        now.month(),
        now.day(),
        now.hour(),
        now.minute()
    )
}

fn korean_weekday(now: DateTime<FixedOffset>) -> &'static str {
    match now.weekday() {
        chrono::Weekday::Mon => "월",
        chrono::Weekday::Tue => "화",
        chrono::Weekday::Wed => "수",
        chrono::Weekday::Thu => "목",
        chrono::Weekday::Fri => "금",
        chrono::Weekday::Sat => "토",
        chrono::Weekday::Sun => "일",
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;
    use tempfile::tempdir;

    use crate::{
        browser_bridge::BrowserBridge,
        models::{
            AutomationStep, AutomationTask, BrowserElementStep, BrowserRetryPolicy,
            BrowserRunTarget, BrowserWaitPolicy, ExistingTabBrowserKind, FrameTarget, OffsetRatio,
            Safety, Schedule, SelectorCandidate, SelectorStrategy,
        },
        scheduler::{run_due_tasks, SchedulerState},
        storage::Storage,
    };

    fn existing_tab_task(schedule: Schedule) -> AutomationTask {
        AutomationTask {
            id: "task-scheduled".into(),
            name: "예약 작업".into(),
            enabled: true,
            schedule,
            steps: vec![AutomationStep::BrowserElement(BrowserElementStep {
                url_pattern: "https://admin.kgmexcenter.com/admin/notice".into(),
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
                tab_url_pattern: "https://admin.kgmexcenter.com/admin/notice".into(),
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
    fn run_due_tasks_enqueues_daily_task_once_per_matching_minute() {
        let dir = tempdir().unwrap();
        let storage = Storage::new(dir.path().into());
        storage
            .save_task(existing_tab_task(Schedule::Daily {
                time_of_day: "12:59".into(),
            }))
            .unwrap();
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));
        let now = DateTime::parse_from_rfc3339("2026-05-19T12:59:15+09:00").unwrap();
        let mut state = SchedulerState::default();

        assert_eq!(
            run_due_tasks(&storage, &bridge, now, &mut state).unwrap(),
            1
        );
        assert_eq!(
            run_due_tasks(&storage, &bridge, now, &mut state).unwrap(),
            0
        );
        assert!(bridge.next_existing_tab(&session.pairing_token).is_some());
        assert!(bridge.next_existing_tab(&session.pairing_token).is_none());
    }
}
