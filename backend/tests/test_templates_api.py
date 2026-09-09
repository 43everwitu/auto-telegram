def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_create_shared_template(api_client):
    headers = _auth_header(api_client)
    resp = api_client.post("/api/templates", json={"body": "hello", "is_override": False}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["target_id"] is None


def test_create_override_template(api_client):
    headers = _auth_header(api_client)
    resp = api_client.post(
        "/api/templates", json={"body": "hi target", "is_override": True, "target_id": 5}, headers=headers
    )
    assert resp.json()["target_id"] == 5


def test_delete_template(api_client):
    headers = _auth_header(api_client)
    template_id = api_client.post(
        "/api/templates", json={"body": "hello", "is_override": False}, headers=headers
    ).json()["id"]
    resp = api_client.delete(f"/api/templates/{template_id}", headers=headers)
    assert resp.status_code == 200
