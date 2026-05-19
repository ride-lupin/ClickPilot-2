use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{AutomationStep, FastClickSettings};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserBridgeStatus {
    pub port: u16,
    pub paired: bool,
    pub capture_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCaptureSession {
    pub port: u16,
    pub pairing_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedBrowserElement {
    pub url: String,
    pub selector_candidates: Vec<crate::models::SelectorCandidate>,
    pub text_hint: Option<String>,
    pub frame_path: Vec<crate::models::FrameTarget>,
    pub click_offset_ratio: crate::models::OffsetRatio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingTabExecutionRequest {
    pub execution_id: String,
    pub task_id: String,
    pub task_name: String,
    pub browser: String,
    pub tab_url_pattern: String,
    pub require_active_tab: bool,
    pub login_check_url: Option<String>,
    pub login_success_selector: Option<String>,
    pub fast_click: Option<FastClickSettings>,
    pub steps: Vec<AutomationStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingTabExecutionResult {
    pub execution_id: String,
    pub task_id: String,
    pub task_name: String,
    pub status: String,
    pub reason: Option<String>,
    pub message: Option<String>,
    pub clicked_steps: u32,
    pub screenshot_data_url: Option<String>,
}

#[derive(Clone)]
pub struct BrowserBridge {
    inner: Arc<Mutex<BridgeState>>,
}

struct BridgeState {
    port: u16,
    paired: bool,
    token: Option<String>,
    capture_requested: bool,
    capture: Option<CapturedBrowserElement>,
    queue: VecDeque<ExistingTabExecutionRequest>,
    results: HashMap<String, ExistingTabExecutionResult>,
}

impl BrowserBridge {
    pub fn new(port: u16) -> Self {
        Self {
            inner: Arc::new(Mutex::new(BridgeState {
                port,
                paired: false,
                token: None,
                capture_requested: false,
                capture: None,
                queue: VecDeque::new(),
                results: HashMap::new(),
            })),
        }
    }

    pub fn new_with_pairing_token(port: u16, token: String) -> Self {
        Self {
            inner: Arc::new(Mutex::new(BridgeState {
                port,
                paired: true,
                token: Some(token),
                capture_requested: false,
                capture: None,
                queue: VecDeque::new(),
                results: HashMap::new(),
            })),
        }
    }

    pub fn status(&self) -> BrowserBridgeStatus {
        let state = self.inner.lock().unwrap();
        BrowserBridgeStatus {
            port: state.port,
            paired: state.paired,
            capture_active: state.paired,
        }
    }

    pub fn start_capture(&self) -> BrowserCaptureSession {
        let mut state = self.inner.lock().unwrap();
        let token = Uuid::new_v4().to_string();
        state.token = Some(token.clone());
        state.capture_requested = false;
        state.paired = false;
        BrowserCaptureSession {
            port: state.port,
            pairing_token: token,
        }
    }

    pub fn request_capture(&self) -> bool {
        let mut state = self.inner.lock().unwrap();
        if state.paired {
            state.capture_requested = true;
            state.capture = None;
            return true;
        }
        false
    }

    pub fn pair(&self, token: &str) -> bool {
        let mut state = self.inner.lock().unwrap();
        if token_is_current(&state, token) {
            state.paired = true;
            return true;
        }
        false
    }

    pub fn is_paired(&self, token: &str) -> bool {
        let state = self.inner.lock().unwrap();
        state.paired && token_is_current(&state, token)
    }

    pub fn store_capture(&self, token: &str, capture: CapturedBrowserElement) -> bool {
        let mut state = self.inner.lock().unwrap();
        if !state.paired || !token_is_current(&state, token) {
            return false;
        }
        state.capture = Some(capture);
        state.capture_requested = false;
        true
    }

    pub fn latest_capture(&self) -> Option<CapturedBrowserElement> {
        self.inner.lock().unwrap().capture.clone()
    }

    pub fn take_capture_request(&self, token: &str) -> bool {
        let state = self.inner.lock().unwrap();
        if !state.paired || !token_is_current(&state, token) || !state.capture_requested {
            return false;
        }
        true
    }

    pub fn enqueue_existing_tab(&self, request: ExistingTabExecutionRequest) {
        self.inner.lock().unwrap().queue.push_back(request);
    }

    pub fn next_existing_tab(&self, token: &str) -> Option<ExistingTabExecutionRequest> {
        let mut state = self.inner.lock().unwrap();
        if !state.paired || !token_is_current(&state, token) {
            return None;
        }
        state.queue.pop_front()
    }

    pub fn store_existing_tab_result(
        &self,
        token: &str,
        result: ExistingTabExecutionResult,
    ) -> bool {
        let mut state = self.inner.lock().unwrap();
        if !state.paired || !token_is_current(&state, token) {
            return false;
        }
        state.results.insert(result.execution_id.clone(), result);
        true
    }
}

fn token_is_current(state: &BridgeState, token: &str) -> bool {
    !token.trim().is_empty() && state.token.as_deref() == Some(token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_required_for_pairing() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();

        assert!(!bridge.pair("wrong"));
        assert!(bridge.pair(&session.pairing_token));
    }

    #[test]
    fn pairing_token_does_not_expire_before_pairing() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();

        assert!(bridge.pair(&session.pairing_token));
    }

    #[test]
    fn restored_pairing_token_starts_connected() {
        let bridge = BrowserBridge::new_with_pairing_token(27183, "saved-token".into());

        assert!(bridge.status().paired);
        assert!(bridge.is_paired("saved-token"));
        assert!(!bridge.is_paired("wrong-token"));
    }

    #[test]
    fn paired_capture_requests_do_not_require_reentering_token() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));

        assert!(bridge.status().paired);
        assert!(bridge.request_capture());
        assert!(bridge.take_capture_request(&session.pairing_token));
    }

    #[test]
    fn paired_existing_tab_execution_uses_saved_token_without_expiration() {
        let bridge = BrowserBridge::new(27183);
        let session = bridge.start_capture();
        assert!(bridge.pair(&session.pairing_token));
        bridge.enqueue_existing_tab(ExistingTabExecutionRequest {
            execution_id: "execution-1".into(),
            task_id: "task-1".into(),
            task_name: "Apply".into(),
            browser: "chrome".into(),
            tab_url_pattern: "https://example.com/*".into(),
            require_active_tab: false,
            login_check_url: None,
            login_success_selector: None,
            fast_click: None,
            steps: vec![],
        });

        assert_eq!(
            bridge
                .next_existing_tab(&session.pairing_token)
                .map(|request| request.execution_id),
            Some("execution-1".into())
        );
        assert!(bridge.store_existing_tab_result(
            &session.pairing_token,
            ExistingTabExecutionResult {
                execution_id: "execution-1".into(),
                task_id: "task-1".into(),
                task_name: "Apply".into(),
                status: "success".into(),
                reason: None,
                message: None,
                clicked_steps: 0,
                screenshot_data_url: None,
            }
        ));
    }
}
