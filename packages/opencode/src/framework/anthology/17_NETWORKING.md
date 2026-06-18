# Anthology: Networking

> **Subject:** Networking - network operations, protocols, and connectivity in TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Networking Mastery

### 17.1 Async HTTP Client

```rust
// Use reqwest with tokio
pub struct NetworkClient {
    client: reqwest::Client,
    base_url: Option<String>,
    timeout: Duration,
}

impl NetworkClient {
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, NetworkError> {
        let url = self.resolve_url(path);
        let response = self.client.get(&url)
            .timeout(self.timeout)
            .send()
            .await?;
        Ok(response.json().await?)
    }

    pub async fn post<T: DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> Result<T, NetworkError> {
        let url = self.resolve_url(path);
        let response = self.client.post(&url)
            .json(body)
            .timeout(self.timeout)
            .send()
            .await?;
        Ok(response.json().await?)
    }
}
```

### 17.2 WebSocket Management

```rust
pub struct WebSocketManager {
    connections: HashMap<String, WebSocketConnection>,
}

pub struct WebSocketConnection {
    pub url: String,
    pub sender: mpsc::Sender<WebSocketMessage>,
    pub receiver: mpsc::Receiver<WebSocketMessage>,
    pub status: ConnectionStatus,
}

impl WebSocketManager {
    pub async fn connect(&mut self, url: &str) -> Result<String, NetworkError> {
        let (ws, _) = connect_async(url).await?;
        
        let (tx, rx) = mpsc::channel(100);
        let id = format!("ws_{}", self.connections.len());
        
        self.connections.insert(id.clone(), WebSocketConnection {
            url: url.to_string(),
            sender: tx,
            receiver: rx,
            status: ConnectionStatus::Connected,
        });
        
        // Spawn reader task
        let connection_id = id.clone();
        let rx_clone = self.connections[&connection_id].receiver.clone();
        tokio::spawn(async move {
            Self::websocket_reader(connection_id, ws, rx_clone).await;
        });
        
        Ok(id)
    }
}
```

### 17.3 Connection Resilience

```rust
pub struct ResilientClient {
    inner: NetworkClient,
    retry_policy: RetryPolicy,
    circuit_breaker: CircuitBreaker,
}

pub struct RetryPolicy {
    max_retries: u32,
    initial_delay: Duration,
    max_delay: Duration,
    backoff_factor: f32,
}

pub struct CircuitBreaker {
    failure_threshold: u32,
    recovery_timeout: Duration,
    failure_count: AtomicU32,
    last_failure: AtomicU64,
    state: AtomicU8,  // 0 = Closed, 1 = Open, 2 = Half-Open
}

impl ResilientClient {
    pub async fn get_with_retry<T: DeserializeOwned>(&self, path: &str) -> Result<T, NetworkError> {
        let mut last_error = None;
        
        for attempt in 0..self.retry_policy.max_retries {
            if !self.circuit_breaker.allow_request() {
                return Err(NetworkError::CircuitOpen);
            }
            
            match self.inner.get(path).await {
                Ok(data) => {
                    self.circuit_breaker.record_success();
                    return Ok(data);
                }
                Err(e) => {
                    last_error = Some(e);
                    self.circuit_breaker.record_failure();
                    let delay = self.retry_policy.delay_for_attempt(attempt);
                    sleep(delay).await;
                }
            }
        }
        
        Err(last_error.unwrap_or(NetworkError::MaxRetriesExceeded))
    }
}
```

### 17.4 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Blocking network | UI freeze | Use async I/O |
| No timeout | Hangs indefinitely | Set connection timeout |
| No retry logic | Fails on transient errors | Implement exponential backoff |
| Ignoring failures | Silent errors | Log all failures |

---

# PART 2: NOVEL CONCEPTS REPORT

## Networking: Untapped Opportunities

### Concept 1: Predictive Prefetching

**Idea:** **Prefetch likely-needed resources** before user requests them.

```rust
pub struct PredictivePrefetcher {
    history: Vec<(String, Context)>,
    model: MarkovModel,
}

impl PredictivePrefetcher {
    pub fn predict(&self, context: &Context) -> Vec<String> {
        self.model
            .predict_next(&context)
            .into_iter()
            .take(3)
            .collect()
    }
}
```

**Novel because:** TUIs only load on demand. Prefetching = faster response.

**Complexity:** Medium
**Value:** Medium (speed improvement)

---

**End of Networking Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Network-Aware TUI Constraints

Network operations must not block the render path. Textual's `call_later` and `self.run_worker()` provide async off-main-thread execution. Bubbletea's `Cmd.perform(async_work, Msg)` is the Erlange-idiomatic equivalent. The rule: all I/O happens in worker threads or async tasks; the main thread only processes messages from a queue. For streamed output (SSE, WebSockets, logs): flow socket reads into the same event surface as stdin via a task queue. Prefer bounded/progressed results for slow requests: show a spinner or progress bar, not a frozen screen. The minimal primitive set: a single `NetworkClient` with timeout + retry, one task queue abstraction, and a failure taxonomy (`Timeout`, `ConnectionRefused`, `HttpError { code }`, `ParseError`) that the UI can render meaningfully.


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Provider Context Injection in Canopy

Canopy's `update_provider_cache` Tauri command accepts provider config from the frontend and caches it for PTY spawn:

```rust
let settings = ProviderSettings {
  provider: Provider::Direct | Bedrock | Vertex,
  aws_region, aws_profile,
  aws_access_key_id: read_secret("aws_access_key_id"),
  aws_secret_access_key: read_secret("aws_secret_access_key"),
  aws_session_token: read_secret("aws_session_token"),
  gcp_project_id, gcp_region,
  model_override,
};
*provider_settings.lock() = Ok(Some(settings));
```

**Provider-specific env at spawn:**
```rust
if is_claude_session {
  if let Some(ref settings) = *state.provider_settings.lock() {
    match settings.provider {
      Provider::Bedrock => {
        cmd.env("CLAUDE_CODE_USE_BEDROCK", "1");
        settings.aws_region.map(|v| cmd.env("AWS_REGION", v));
        settings.aws_profile.map(|v| cmd.env("AWS_PROFILE", v));
      }
      Provider::Vertex => {
        cmd.env("CLAUDE_CODE_USE_VERTEX", "1");
        settings.gcp_project_id.map(|v| cmd.env("CLOUD_ML_PROJECT_ID", v));
      }
      _ => {}
    }
    if let Some(ref m) = settings.model_override { if !m.is_empty() { cmd.env("ANTHROPIC_MODEL", m); } }
  }
}
```

**Production gaps:** No retry on spawn failure, no health-check after spawn, no timeout on PTY read loop.

---
