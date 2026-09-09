def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_create_and_list_target(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "My Channel"}
    create_resp = api_client.post("/api/targets", json=payload, headers=headers)
    assert create_resp.status_code == 200
    target_id = create_resp.json()["id"]

    list_resp = api_client.get("/api/targets", headers=headers)
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == target_id
    assert list_resp.json()[0]["active"] is True


def test_toggle_active(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "group", "title": "My Group"}
    target_id = api_client.post("/api/targets", json=payload, headers=headers).json()["id"]

    resp = api_client.patch(f"/api/targets/{target_id}/active?active=false", headers=headers)
    assert resp.json()["active"] is False


def test_delete_target(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "T"}
    target_id = api_client.post("/api/targets", json=payload, headers=headers).json()["id"]

    del_resp = api_client.delete(f"/api/targets/{target_id}", headers=headers)
    assert del_resp.status_code == 200
    assert api_client.get("/api/targets", headers=headers).json() == []
