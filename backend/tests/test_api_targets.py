import json


def test_create_and_get_target(client):
    """Test creating an HTTP target and retrieving it."""
    payload = {
        "name": "Internal Portal",
        "protocol": "HTTPS",
        "host_or_url": "https://internal.corp",
        "interval_seconds": 60,
        "timeout_seconds": 5,
        "consecutive_failure_threshold": 3,
        "is_active": True,
        "protocol_options": {
            "verify_ssl": False,
            "expected_status_codes": [200, 302]
        }
    }
    res = client.post("/api/targets", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert "target" in data
    target_id = data["target"]["id"]
    assert data["target"]["name"] == "Internal Portal"
    assert data["target"]["protocol"] == "HTTPS"
    assert data["target"]["current_state"] == "UP"

    # Fetch by ID
    get_res = client.get(f"/api/targets/{target_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["target"]["id"] == target_id


def test_create_tcp_target_validation(client):
    """Test validation rules for TCP target without port."""
    payload = {
        "name": "Database Server",
        "protocol": "TCP",
        "host_or_url": "db.internal.corp",
        # port missing
    }
    res = client.post("/api/targets", json=payload)
    assert res.status_code == 422
    assert "port" in str(res.get_json())

    # Valid TCP payload
    payload["port"] = 5432
    valid_res = client.post("/api/targets", json=payload)
    assert valid_res.status_code == 201
    assert valid_res.get_json()["target"]["port"] == 5432


def test_pause_and_resume_target(client):
    """Test pausing and resuming a target."""
    payload = {
        "name": "Service A",
        "protocol": "HTTP",
        "host_or_url": "http://service-a.local",
    }
    create_res = client.post("/api/targets", json=payload)
    target_id = create_res.get_json()["target"]["id"]

    # Pause
    pause_res = client.post(f"/api/targets/{target_id}/pause")
    assert pause_res.status_code == 200
    assert pause_res.get_json()["target"]["is_active"] is False

    # Resume
    resume_res = client.post(f"/api/targets/{target_id}/resume")
    assert resume_res.status_code == 200
    assert resume_res.get_json()["target"]["is_active"] is True


def test_delete_target(client):
    """Test deleting a target."""
    payload = {
        "name": "Temporary Target",
        "protocol": "HTTP",
        "host_or_url": "http://temp.local",
    }
    create_res = client.post("/api/targets", json=payload)
    target_id = create_res.get_json()["target"]["id"]

    del_res = client.delete(f"/api/targets/{target_id}")
    assert del_res.status_code == 200

    # Ensure 404 on subsequent get
    assert client.get(f"/api/targets/{target_id}").status_code == 404
