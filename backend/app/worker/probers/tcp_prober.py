import time
import socket
from app.worker.probers.base import ProbeResult


def check_tcp(
    host: str,
    port: int,
    timeout_seconds: int = 10
) -> ProbeResult:
    """
    Performs a raw TCP connection handshake probe to verify port availability and latency.
    """
    # Strip protocol prefix if user accidentally supplied it
    clean_host = host.replace("http://", "").replace("https://", "").split("/")[0]

    start_time = time.perf_counter()
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_seconds)
        
        # Connect to host:port
        sock.connect((clean_host, port))
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ProbeResult(
            is_success=True,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=None
        )

    except socket.timeout:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"TCP connection timed out after {timeout_seconds}s"
        )
    except ConnectionRefusedError:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"Connection refused on port {port}"
        )
    except socket.gaierror as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"DNS resolution failure for host '{clean_host}'"
        )
    except OSError as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ProbeResult(
            is_success=False,
            response_time_ms=elapsed_ms,
            status_code=None,
            error_message=f"TCP error: {str(e)[:150]}"
        )
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass
