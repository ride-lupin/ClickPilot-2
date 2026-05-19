use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{Arc, Mutex},
    thread,
};

use crate::browser_bridge::{BrowserBridge, CapturedBrowserElement, ExistingTabExecutionResult};
use crate::storage::Storage;

pub fn start_browser_bridge_server(bridge: BrowserBridge, storage: Arc<Mutex<Storage>>) {
    let port = bridge.status().port;
    thread::spawn(move || {
        let listener = match TcpListener::bind(("127.0.0.1", port)) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("failed to start browser bridge on 127.0.0.1:{port}: {error}");
                return;
            }
        };

        for stream in listener.incoming().flatten() {
            let bridge = bridge.clone();
            let storage = storage.clone();
            thread::spawn(move || handle_connection(stream, bridge, storage));
        }
    });
}

fn handle_connection(mut stream: TcpStream, bridge: BrowserBridge, storage: Arc<Mutex<Storage>>) {
    let request = match read_request(&mut stream) {
        Some(request) => request,
        None => {
            let _ = write_response(&mut stream, 400, "text/plain", "bad request");
            return;
        }
    };

    if request.method == "OPTIONS" {
        let _ = write_response(&mut stream, 204, "text/plain", "");
        return;
    }

    let token = request.header("x-clickpilot-token").unwrap_or_default();
    let response = match (request.method.as_str(), request.path.as_str()) {
        ("POST", "/pair") if bridge.pair(token) => {
            HttpResponse::json(200, r#"{"paired":true}"#.into())
        }
        ("POST", "/pair") => HttpResponse::text(401, "invalid pairing token".into()),
        ("GET", "/pair/status") if bridge.is_paired(token) => {
            HttpResponse::json(200, r#"{"paired":true}"#.into())
        }
        ("GET", "/pair/status") => HttpResponse::json(200, r#"{"paired":false}"#.into()),
        ("GET", "/capture/request") if bridge.take_capture_request(token) => {
            HttpResponse::json(200, r#"{"startCapture":true}"#.into())
        }
        ("GET", "/capture/request") => HttpResponse::empty(204),
        ("POST", "/capture") => {
            match serde_json::from_slice::<CapturedBrowserElement>(&request.body) {
                Ok(capture) => {
                    if bridge.store_capture(token, capture) {
                        HttpResponse::json(200, r#"{"captured":true}"#.into())
                    } else {
                        HttpResponse::text(401, "invalid pairing token".into())
                    }
                }
                Err(_) => HttpResponse::text(400, "invalid capture payload".into()),
            }
        }
        ("GET", "/existing-tab/next") => match bridge.next_existing_tab(token) {
            Some(request) => HttpResponse::json(
                200,
                serde_json::to_string(&request).unwrap_or_else(|_| "{}".into()),
            ),
            None => HttpResponse::empty(204),
        },
        ("POST", "/existing-tab/result") => {
            match serde_json::from_slice::<ExistingTabExecutionResult>(&request.body) {
                Ok(result) => {
                    if bridge.store_existing_tab_result(token, result.clone()) {
                        match storage
                            .lock()
                            .unwrap()
                            .append_existing_tab_result_log(result)
                        {
                            Ok(()) => HttpResponse::json(200, r#"{"stored":true}"#.into()),
                            Err(_) => HttpResponse::text(500, "failed to store result log".into()),
                        }
                    } else {
                        HttpResponse::text(401, "invalid pairing token".into())
                    }
                }
                Err(_) => HttpResponse::text(400, "invalid result payload".into()),
            }
        }
        _ => HttpResponse::text(404, "not found".into()),
    };

    let _ = write_response(
        &mut stream,
        response.status,
        response.content_type,
        &response.body,
    );
}

struct HttpRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl HttpRequest {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(candidate, _)| candidate.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

struct HttpResponse {
    status: u16,
    content_type: &'static str,
    body: String,
}

impl HttpResponse {
    fn empty(status: u16) -> Self {
        Self {
            status,
            content_type: "text/plain",
            body: String::new(),
        }
    }

    fn text(status: u16, body: String) -> Self {
        Self {
            status,
            content_type: "text/plain",
            body,
        }
    }

    fn json(status: u16, body: String) -> Self {
        Self {
            status,
            content_type: "application/json",
            body,
        }
    }
}

fn read_request(stream: &mut TcpStream) -> Option<HttpRequest> {
    let mut buffer = Vec::new();
    let mut chunk = [0; 4096];
    loop {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if header_end(&buffer).is_some() {
            break;
        }
    }

    let split = header_end(&buffer)?;
    let header_text = String::from_utf8_lossy(&buffer[..split]);
    let mut lines = header_text.lines();
    let mut request_line = lines.next()?.split_whitespace();
    let method = request_line.next()?.to_string();
    let path = request_line.next()?.split('?').next()?.to_string();
    let headers = lines
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_string(), value.trim().to_string()))
        })
        .collect::<Vec<_>>();

    let content_length = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.parse::<usize>().ok())
        .unwrap_or(0);
    let body_start = split + 4;
    let mut body = buffer[body_start..].to_vec();
    while body.len() < content_length {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }
    body.truncate(content_length);

    Some(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &str,
) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "OK",
    };
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type, X-ClickPilot-Token\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
}
