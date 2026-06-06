"""client.py — thin PA REST API client the sub-agent runtime uses for brain context + LLM.

Direct HTTP only (httpx), no SDK — symmetric with the Node tier's "direct fetch only" rule.
The runtime reads zone-scoped brain context through the PA REST API v1 (Dev GTM Wave 1) and
runs inference through the user's selected provider via the same API, so BYO-LLM choice carries
into orchestrated runs. Every call is best-effort: a failure degrades the phase, never crashes
the run (the run still reports completion to the webhook).
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

_TIMEOUT = httpx.Timeout(30.0)


class PaApiClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def read_brain(self, business_id: str, zones: list[str]) -> str:
        """Pull zone-scoped brain context for OBSERVE. Returns '' on any failure."""
        try:
            with httpx.Client(timeout=_TIMEOUT) as http:
                res = http.get(
                    f"{self.base_url}/api/v1/brain",
                    params={"business_id": business_id, "zones": ",".join(zones)},
                    headers=self._headers(),
                )
                if res.status_code != 200:
                    return ""
                data = res.json()
                return data.get("context", "") if isinstance(data, dict) else ""
        except Exception:
            return ""

    def complete(self, business_id: str, system: str, prompt: str) -> tuple[str, int]:
        """Run one inference via the user's provider. Returns (text, token_cost). ('',0) on error."""
        try:
            with httpx.Client(timeout=_TIMEOUT) as http:
                res = http.post(
                    f"{self.base_url}/api/v1/llm/complete",
                    json={"business_id": business_id, "system": system, "prompt": prompt},
                    headers=self._headers(),
                )
                if res.status_code != 200:
                    return "", 0
                data = res.json()
                if not isinstance(data, dict):
                    return "", 0
                return str(data.get("text", "")), int(data.get("tokenCost", 0) or 0)
        except Exception:
            return "", 0


def post_webhook(
    url: str, secret: str, event: dict[str, Any], *, client: Optional[httpx.Client] = None
) -> bool:
    """POST a webhook event to PA with the shared runtime token. Best-effort; returns success."""
    headers = {"x-pa-runtime-token": secret, "Content-Type": "application/json"}
    try:
        if client is not None:
            res = client.post(url, json=event, headers=headers)
            return res.status_code < 300
        with httpx.Client(timeout=_TIMEOUT) as http:
            res = http.post(url, json=event, headers=headers)
            return res.status_code < 300
    except Exception:
        return False
