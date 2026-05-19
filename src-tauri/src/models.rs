use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTask {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub schedule: Schedule,
    pub steps: Vec<AutomationStep>,
    pub safety: Safety,
    pub run_target: BrowserRunTarget,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLog {
    pub id: String,
    pub task_id: String,
    pub task_name: String,
    pub status: ExecutionStatus,
    pub message: Option<String>,
    pub failure_reason: Option<String>,
    pub screenshot_path: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionStatus {
    Started,
    Success,
    Stopped,
    Missed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Schedule {
    OneShot {
        #[serde(alias = "run_at")]
        run_at: String,
    },
    Daily {
        #[serde(alias = "time_of_day")]
        time_of_day: String,
    },
    Weekly {
        days: Vec<String>,
        #[serde(alias = "time_of_day")]
        time_of_day: String,
    },
    RepeatInterval {
        #[serde(alias = "interval_ms")]
        interval_ms: u64,
        #[serde(alias = "max_runs")]
        max_runs: Option<u32>,
        #[serde(alias = "end_at")]
        end_at: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::Schedule;

    #[test]
    fn schedule_accepts_frontend_camel_case_fields() {
        let schedule: Schedule =
            serde_json::from_value(serde_json::json!({ "type": "daily", "timeOfDay": "12:47" }))
                .unwrap();

        assert_eq!(
            schedule,
            Schedule::Daily {
                time_of_day: "12:47".into()
            }
        );
    }

    #[test]
    fn schedule_accepts_legacy_snake_case_fields() {
        let schedule: Schedule =
            serde_json::from_value(serde_json::json!({ "type": "daily", "time_of_day": "09:00" }))
                .unwrap();

        assert_eq!(
            schedule,
            Schedule::Daily {
                time_of_day: "09:00".into()
            }
        );
    }

    #[test]
    fn schedule_serializes_frontend_camel_case_fields() {
        let schedule = Schedule::Daily {
            time_of_day: "12:47".into(),
        };

        assert_eq!(
            serde_json::to_value(schedule).unwrap(),
            serde_json::json!({ "type": "daily", "timeOfDay": "12:47" })
        );
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Safety {
    pub countdown_seconds: u32,
    pub stop_hotkey: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AutomationStep {
    BrowserElement(BrowserElementStep),
    ScreenCoordinate(ScreenCoordinateStep),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserElementStep {
    pub url_pattern: String,
    pub selector_candidates: Vec<SelectorCandidate>,
    pub text_hint: Option<String>,
    pub frame_path: Vec<FrameTarget>,
    pub click_offset_ratio: OffsetRatio,
    pub wait: BrowserWaitPolicy,
    pub retry: BrowserRetryPolicy,
    pub delay_after_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCoordinateStep {
    pub x: i32,
    pub y: i32,
    pub button: MouseButton,
    pub click_count: u8,
    pub delay_after_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectorCandidate {
    pub strategy: SelectorStrategy,
    pub value: String,
    pub confidence: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SelectorStrategy {
    Css,
    Text,
    Role,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameTarget {
    pub url_pattern: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffsetRatio {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWaitPolicy {
    pub timeout_ms: u64,
    pub poll_interval_ms: u64,
    pub refresh_before_wait: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRetryPolicy {
    pub max_attempts: u8,
    pub retry_delay_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "mode",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum BrowserRunTarget {
    ManagedProfile {
        browser: BrowserKind,
        profile_id: String,
        preopen_seconds: u32,
        login_check_url: Option<String>,
        login_success_selector: Option<String>,
    },
    ExistingTab {
        browser: ExistingTabBrowserKind,
        preopen_seconds: u32,
        tab_url_pattern: String,
        require_active_tab: bool,
        login_check_url: Option<String>,
        login_success_selector: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BrowserKind {
    Chrome,
    Edge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExistingTabBrowserKind {
    Chrome,
    Edge,
    Any,
}
