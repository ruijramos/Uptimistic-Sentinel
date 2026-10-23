from app.models.target import Target
from app.worker.probers.base import ProbeResult
from app.worker.probers.http_prober import check_http
from app.worker.probers.tcp_prober import check_tcp
from app.worker.probers.icmp_prober import check_icmp


def run_probe(target: Target) -> ProbeResult:
    """
    Dispatches the appropriate network prober based on the target protocol.
    """
    proto = target.protocol.upper()

    if proto in {"HTTP", "HTTPS"}:
        return check_http(
            url=target.host_or_url,
            timeout_seconds=target.timeout_seconds,
            options=target.protocol_options or {}
        )
    elif proto == "TCP":
        port = target.port or (443 if "https" in target.host_or_url else 80)
        return check_tcp(
            host=target.host_or_url,
            port=port,
            timeout_seconds=target.timeout_seconds
        )
    elif proto == "ICMP":
        return check_icmp(
            host=target.host_or_url,
            timeout_seconds=target.timeout_seconds
        )
    else:
        return ProbeResult(
            is_success=False,
            response_time_ms=0,
            status_code=None,
            error_message=f"Unsupported protocol: {proto}"
        )


__all__ = ["run_probe", "ProbeResult", "check_http", "check_tcp", "check_icmp"]
