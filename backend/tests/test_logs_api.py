from datetime import datetime
from app.models import SendLog


def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _seed_logs(api_client):
    from app.main import app
    from app.db import get_db

    override = app.dependency_overrides[get_db]
    db = next(override())
    db.add(SendLog(target_id=1, template_id=1, sent_at=datetime.utcnow(), status="success"))
    db.add(SendLog(target_id=1, template_id=1, sent_at=datetime.utcnow(), status="failed", error_message="x"))
    db.commit()


def test_list_logs(api_client):
    headers = _auth_header(api_client)
    _seed_logs(api_client)
    resp = api_client.get("/api/logs", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_stats(api_client):
    headers = _auth_header(api_client)
    _seed_logs(api_client)
    resp = api_client.get("/api/logs/stats", headers=headers)
    assert resp.json()["1"] == {"success": 1, "failed": 1}
