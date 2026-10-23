from unittest.mock import patch, MagicMock
from app.models.target import Target
from app.worker.probers import run_probe, check_http, check_tcp, check_icmp


def test_http_prober_success():
    """Test HTTP prober with mock 200 response."""
    with patch("requests.request") as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.iter_content.return_value = [b"ok"]
        mock_req.return_value = mock_response

        target = Target(
            name="Web Service",
            protocol="HTTP",
            host_or_url="http://service.corp",
            timeout_seconds=5,
            protocol_options={"expected_status_codes": [200]}
        )
        result = run_probe(target)
        assert result.is_success is True
        assert result.status_code == 200
        assert result.error_message is None


def test_http_prober_unexpected_status():
    """Test HTTP prober when endpoint returns unexpected code."""
    with patch("requests.request") as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 502
        mock_response.iter_content.return_value = [b"Bad Gateway"]
        mock_req.return_value = mock_response

        target = Target(
            name="Web Service",
            protocol="HTTP",
            host_or_url="http://service.corp",
            timeout_seconds=5,
            protocol_options={"expected_status_codes": [200, 204]}
        )
        result = run_probe(target)
        assert result.is_success is False
        assert result.status_code == 502
        assert "502" in result.error_message


def test_tcp_prober_success():
    """Test TCP prober when socket connects."""
    with patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock_cls.return_value = mock_sock

        target = Target(
            name="Redis Cache",
            protocol="TCP",
            host_or_url="redis.corp",
            port=6379,
            timeout_seconds=3
        )
        result = run_probe(target)
        assert result.is_success is True
        assert result.error_message is None


def test_icmp_prober_success():
    """Test ICMP prober with simulated ping success."""
    with patch("subprocess.run") as mock_run:
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.stdout = "Reply from 192.168.1.1: bytes=32 time=14ms TTL=64"
        mock_run.return_value = mock_proc

        target = Target(
            name="Gateway Router",
            protocol="ICMP",
            host_or_url="192.168.1.1",
            timeout_seconds=2
        )
        result = run_probe(target)
        assert result.is_success is True
        assert result.response_time_ms == 14
