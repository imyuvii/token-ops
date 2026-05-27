from __future__ import annotations

import json
from typing import Any
from urllib import request


class TokenOps:
    def __init__(self, base_url: str, api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def track(self, **payload: Any) -> dict[str, Any]:
        request_payload = {
            "timestamp": payload.get("timestamp"),
            "team": payload["team"],
            "user_id": payload["user_id"],
            "application": payload["application"],
            "environment": payload["environment"],
            "endpoint": payload["endpoint"],
            "provider": payload["provider"],
            "model": payload["model"],
            "prompt_name": payload["prompt_name"],
            "prompt_version": payload["prompt_version"],
            "prompt_text": payload["prompt_text"],
            "tokens_in": payload["tokens_in"],
            "tokens_out": payload["tokens_out"],
            "cost": payload["cost"],
            "latency_ms": payload["latency_ms"],
            "ttft_ms": payload["ttft_ms"],
            "stream_duration_ms": payload["stream_duration_ms"],
            "status": payload["status"],
            "cache_hit": payload.get("cache_hit", False),
            "error_type": payload.get("error_type"),
        }
        body = json.dumps(request_payload).encode("utf-8")
        api_request = request.Request(
            f"{self.base_url}/api/v1/events",
            data=body,
            headers={
                "Content-Type": "application/json",
                **({"x-tokenops-key": self.api_key} if self.api_key else {}),
            },
            method="POST",
        )
        with request.urlopen(api_request) as response:
            return json.loads(response.read().decode("utf-8"))
