use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::BrowserElementStep;

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
    pub steps: Vec<BrowserElementStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingTabExecutionResult {
    pub execution_id: String,
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
    token_expires_at: Option<Instant>,
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
                token_expires_at: None,
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
            capture_active: state.token_expires_at.is_some_and(|expires_at| expires_at > Instant::now()),
        }
    }

    pub fn start_capture(&self) -> BrowserCaptureSession {
        let mut state = self.inner.lock().unwrap();
        let token = Uuid::new_v4().to_string();
        state.token = Some(token.clone());
        state.token_expires_at = Some(Instant::now() + Duration::from_secs(120));
        BrowserCaptureSession {
            port: state.port,
            pairing_token: token,
        }
    }

    pub fn pair(&self, token: &str) -> bool {
        let mut state = self.inner.lock().unwrap();
        if token_is_current(&state, token) {
            state.paired = true;
            return true;
        }
        false
    }

    pub fn store_capture(&self, token: &str, capture: CapturedBrowserElement) -> bool {
        let mut state = self.inner.lock().unwrap();
        if !token_is_current(&state, token) {
            return false;
        }
        state.capture = Some(capture);
        true
    }

    pub fn latest_capture(&self) -> Option<CapturedBrowserElement> {
        self.inner.lock().unwrap().capture.clone()
    }

    pub fn enqueue_existing_tab(&self, request: ExistingTabExecutionRequest) {
        self.inner.lock().unwrap().queue.push_back(request);
    }

    pub fn next_existing_tab(&self, token: &str) -> Option<ExistingTabExecutionRequest> {
        let mut state = self.inner.lock().unwrap();
        if !token_is_current(&state, token) {
            return None;
        }
        state.queue.pop_front()
    }

    pub fn store_existing_tab_result(&self, token: &str, result: ExistingTabExecutionResult) -> bool {
        let mut state = self.inner.lock().unwrap();
        if !token_is_current(&state, token) {
            return false;
        }
        state.results.insert(result.execution_id.clone(), result);
        true
    }
}

fn token_is_current(state: &BridgeState, token: &str) -> bool {
    state.token.as_deref() == Some(token) && state.token_expires_at.is_some_and(|expires_at| expires_at > Instant::now())
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
}
