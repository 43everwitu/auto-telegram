def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_create_and_list_template(api_client):
    headers = _auth_header(api_client)
    resp = api_client.post("/api/templates", json={"body": "hello"}, headers=headers)
    assert resp.status_code == 200
    template_id = resp.json()["id"]

    list_resp = api_client.get("/api/templates", headers=headers)
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == template_id
    assert list_resp.json()[0]["body"] == "hello"


def test_update_template(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post("/api/templates", json={"body": "hello"}, headers=headers).json()["id"]

    resp = api_client.put(f"/api/templates/{template_id}", json={"body": "updated"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["body"] == "updated"


def test_delete_template(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post("/api/templates", json={"body": "hello"}, headers=headers).json()["id"]

    resp = api_client.delete(f"/api/templates/{template_id}", headers=headers)
    assert resp.status_code == 200
    assert api_client.get("/api/templates", headers=headers).json() == []


def test_assign_template_to_target_and_list(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post("/api/templates", json={"body": "hello"}, headers=headers).json()["id"]
    target_payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "T"}
    target_id = api_client.post("/api/targets", json=target_payload, headers=headers).json()["id"]

    resp = api_client.post(
        f"/api/targets/{target_id}/templates", json={"template_id": template_id}, headers=headers
    )
    assert resp.status_code == 200

    list_resp = api_client.get(f"/api/targets/{target_id}/templates", headers=headers)
    assert [t["id"] for t in list_resp.json()] == [template_id]


def test_same_template_can_be_assigned_to_multiple_targets(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post("/api/templates", json={"body": "hello"}, headers=headers).json()["id"]
    target_payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "T"}
    target_a = api_client.post("/api/targets", json=target_payload, headers=headers).json()["id"]
    target_b = api_client.post("/api/targets", json=target_payload, headers=headers).json()["id"]

    api_client.post(f"/api/targets/{target_a}/templates", json={"template_id": template_id}, headers=headers)
    api_client.post(f"/api/targets/{target_b}/templates", json={"template_id": template_id}, headers=headers)

    assert len(api_client.get(f"/api/targets/{target_a}/templates", headers=headers).json()) == 1
    assert len(api_client.get(f"/api/targets/{target_b}/templates", headers=headers).json()) == 1


def test_unassign_template_from_target(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post("/api/templates", json={"body": "hello"}, headers=headers).json()["id"]
    target_payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "T"}
    target_id = api_client.post("/api/targets", json=target_payload, headers=headers).json()["id"]
    api_client.post(f"/api/targets/{target_id}/templates", json={"template_id": template_id}, headers=headers)

    resp = api_client.delete(f"/api/targets/{target_id}/templates/{template_id}", headers=headers)
    assert resp.status_code == 200
    assert api_client.get(f"/api/targets/{target_id}/templates", headers=headers).json() == []
