import threading
import time

import httpx

from app import config
from app.llm.breaker import CircuitBreaker, CircuitOpen

RETRY_STATUS = {429, 500, 502, 503, 504}
ATTEMPTS = 3
DEFAULT_BASE = {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com/v1",
    "mistral": "https://api.mistral.ai/v1",
}
MAX_RETRY_WAIT = 10.0


class LLMUnavailable(Exception):
    pass


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(self, breaker=None):
        self.breaker = breaker or CircuitBreaker()
        self.forced_down = False
        self._lock = threading.Lock()
        self._last_call = 0.0

    @property
    def configured(self):
        return bool(config.LLM_API_KEY and config.LLM_MODEL)

    def status(self):
        return {
            "configured": self.configured,
            "breaker": self.breaker.state,
            "forced_down": self.forced_down,
        }

    def complete(self, system, user, temperature=0.0, max_tokens=600):
        if self.forced_down or not self.configured:
            raise LLMUnavailable("llm is not available")
        try:
            self.breaker.before()
        except CircuitOpen:
            raise LLMUnavailable("circuit breaker is open")

        try:
            text = self._request_with_retries(system, user, temperature, max_tokens)
        except Exception as err:
            self.breaker.failure()
            raise LLMError(str(err)) from err
        self.breaker.success()
        return text

    def _throttle(self):
        with self._lock:
            wait = self._last_call + config.LLM_MIN_INTERVAL_SEC - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()

    def _request_with_retries(self, system, user, temperature, max_tokens):
        last = None
        for attempt in range(ATTEMPTS):
            delay = 0.5 * 2**attempt
            self._throttle()
            try:
                return self._request(system, user, temperature, max_tokens)
            except httpx.HTTPStatusError as err:
                if err.response.status_code not in RETRY_STATUS:
                    raise
                last = err
                try:
                    delay = max(delay, float(err.response.headers.get("retry-after", 0)))
                except ValueError:
                    pass
            except httpx.TransportError as err:
                last = err
            time.sleep(min(delay, MAX_RETRY_WAIT))
        raise last

    def _request(self, system, user, temperature, max_tokens):
        base = (config.LLM_BASE_URL or DEFAULT_BASE.get(config.LLM_PROVIDER, "")).rstrip("/")
        extra = {"temperature": temperature} if config.LLM_SEND_TEMPERATURE else {}

        if config.LLM_PROVIDER == "anthropic":
            response = httpx.post(
                f"{base}/v1/messages",
                headers={
                    "x-api-key": config.LLM_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": config.LLM_MODEL,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                    **extra,
                },
                timeout=config.LLM_TIMEOUT_SEC,
            )
            response.raise_for_status()
            return "".join(b.get("text", "") for b in response.json()["content"])

        if config.LLM_JSON_MODE:
            extra["response_format"] = {"type": "json_object"}

        response = httpx.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
            json={
                "model": config.LLM_MODEL,
                "max_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **extra,
            },
            timeout=config.LLM_TIMEOUT_SEC,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
