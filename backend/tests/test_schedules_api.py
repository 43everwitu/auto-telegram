def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_upsert_creates_then_updates(api_client):
    headers = _auth_header(api_client)
    payload = {
        "target_id": 1, "messages_per_day": 3, "window_start": "08:00",
        "window_end": "22:00", "min_gap_minutes": 30,
    }
    resp1 = api_client.put("/api/schedules/1", json=payload, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["messages_per_day"] == 3

    payload["messages_per_day"] = 5
    resp2 = api_client.put("/api/schedules/1", json=payload, headers=headers)
    assert resp2.json()["messages_per_day"] == 5

    list_resp = api_client.get("/api/schedules", headers=headers)
    assert len(list_resp.json()) == 1  # updated, not duplicated


def test_delete_schedule(api_client):
    headers = _auth_header(api_client)
    payload = {
        "target_id": 2, "messages_per_day": 2, "window_start": "09:00",
        "window_end": "20:00", "min_gap_minutes": 60,
    }
    api_client.put("/api/schedules/2", json=payload, headers=headers)
    resp = api_client.delete("/api/schedules/2", headers=headers)
    assert resp.status_code == 200
    assert api_client.get("/api/schedules", headers=headers).json() == []
