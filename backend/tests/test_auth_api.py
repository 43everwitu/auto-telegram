def test_login_success(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
