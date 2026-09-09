from unittest.mock import AsyncMock, patch
from app.models import Account


def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_accounts_requires_auth(api_client):
    resp = api_client.get("/api/accounts")
    assert resp.status_code == 401


def test_list_accounts_empty(api_client):
    headers = _auth_header(api_client)
    resp = api_client.get("/api/accounts", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_session_string_login_creates_account(api_client):
    headers = _auth_header(api_client)
    fake_account = Account(id=1, phone="123", session_string="enc", telegram_premium=False, status="active")

    with patch(
        "app.routers.accounts.manager.login_with_session_string",
        new=AsyncMock(return_value=fake_account),
    ):
        resp = api_client.post(
            "/api/accounts/session-string", json={"session_string": "abc"}, headers=headers
        )
    assert resp.status_code == 200
    assert resp.json()["phone"] == "123"


def test_delete_account_not_found(api_client):
    headers = _auth_header(api_client)
    resp = api_client.delete("/api/accounts/999", headers=headers)
    assert resp.status_code == 404
