import platform
import subprocess
import time
import re
from app.worker.probers.base import ProbeResult


def check_icmp(
    host: str,
    timeout_seconds: int = 5
) -> ProbeResult:
    """
    Performs an ICMP ping probe using system ping utility for maximum OS compatibility
    without requiring root raw socket permissions.
    """
    clean_host = host.replace("http://", "").replace("https://", "").split("/")[0].split(":")[0]

    is_windows = platform.system().lower() == "windows"
    timeout_ms = timeout_seconds * 1000

    if is_windows:
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), clean_host]
    else:
        cmd = ["ping", "-c", "1", "-W", str(timeout_seconds), clean_host]

    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds + 2
        )
        elapsed_total_ms = int((time.perf_counter() - start_time) * 1000)

        output = proc.stdout

        if proc.returncode == 0:
            # Extract latency from ping output
            # Windows: "time=12ms" or "time<1ms"
            # Linux: "time=12.3 ms"
            match = re.search(r"time[<=]?(\d+(?:\.\d+)?)\s*ms", output, re.IGNORECASE)
            if match:
                latency_ms = int(float(match.group(1)))
            else:
                latency_ms = max(1, elapsed_total_ms)

            return ProbeResult(
                is_success=True,
                response_time_ms=latency_ms,
                status_code=None,
                error_message=None
            )
        else:
            return ProbeResult(
                is_success=False,
                response_time_ms=elapsed_total_ms,
                status_code=None,
                error_message="Host unreachable or 100% packet loss"
            )

    except subprocess.TimeoutExpired:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"ICMP ping timed out after {timeout_seconds}s"
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"Ping command error: {str(e)[:150]}"
        )
