import time
import requests
from typing import List, Dict, Any
from app.worker.probers.base import ProbeResult


def check_http(
    url: str,
    timeout_seconds: int = 10,
    options: Dict[str, Any] = None
) -> ProbeResult:
    """
    Performs an HTTP/HTTPS probe with custom status code validation,
    SSL verification toggle, and latency measurement.
    """
    opts = options or {}
    method = opts.get("method", "GET").upper()
    headers = opts.get("headers", {})
    verify_ssl = opts.get("verify_ssl", True)
    follow_redirects = opts.get("follow_redirects", True)
    expected_codes: List[int] = opts.get("expected_status_codes", [200, 201, 202, 204, 301, 302])

    if not headers.get("User-Agent"):
        headers["User-Agent"] = "Uptimistic-Sentinel/1.0 (+https://github.com/sentinel)"

    start_time = time.perf_counter()
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            timeout=timeout_seconds,
            verify=verify_ssl,
            allow_redirects=follow_redirects,
            stream=True  # Avoid downloading massive payloads
        )
        # Read minimal chunk to measure complete TTFB/response
        for _ in response.iter_content(chunk_size=1024):
            break

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        status_code = response.status_code

        if status_code in expected_codes:
            return ProbeResult(
                is_success=True,
                response_time_ms=elapsed_ms,
                status_code=status_code,
                error_message=None
            )
        else:
            return ProbeResult(
                is_success=False,
                response_time_ms=elapsed_ms,
                status_code=status_code,
                error_message=f"Received HTTP {status_code} (expected {expected_codes})"
            )

    except requests.exceptions.SSLError as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"SSL certificate verification failed: {e.__class__.__name__}"
        )
    except requests.exceptions.Timeout:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"Connection timed out after {timeout_seconds}s"
        )
    except requests.exceptions.ConnectionError as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message="Connection refused or host unreachable"
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"HTTP probe error: {str(e)[:150]}"
        )
