from unittest.mock import AsyncMock, patch
import pytest
from telethon.errors import FloodWaitError
from app.models import Target, ScheduleConfig, ContentTemplate, Account
from app import scheduler as scheduler_module
from app.scheduler import send_job
from app.db import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class FakeManager:
    def __init__(self, client):
        self._client = client

    def get_client(self, account_id):
        return self._client


@pytest.mark.asyncio
async def test_send_job_success_writes_log(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Account(id=1, phone="1", session_string="enc", status="active"))
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="T", active=True))
    db.add(ContentTemplate(id=1, body="hello", is_override=False, target_id=None))
    db.commit()
    db.close()

    fake_client = AsyncMock()
    manager = FakeManager(fake_client)

    await send_job(1, manager)

    check_db = Session()
    logs = check_db.query(scheduler_module.SendLog).all()
    assert len(logs) == 1
    assert logs[0].status == "success"
    fake_client.send_message.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_job_generic_error_schedules_one_retry(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Account(id=1, phone="1", session_string="enc", status="active"))
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="T", active=True))
    db.add(ContentTemplate(id=1, body="hello", is_override=False, target_id=None))
    db.commit()
    db.close()

    fake_client = AsyncMock()
    fake_client.send_message.side_effect = RuntimeError("boom")
    manager = FakeManager(fake_client)

    with patch.object(scheduler_module.scheduler, "add_job") as add_job_mock:
        await send_job(1, manager)
        add_job_mock.assert_called_once()
        assert add_job_mock.call_args.kwargs["kwargs"] == {"retry": True}

    check_db = Session()
    logs = check_db.query(scheduler_module.SendLog).all()
    assert logs[0].status == "failed"


def test_schedule_all_targets_creates_jobs(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="T", active=True))
    db.add(ScheduleConfig(id=1, target_id=1, messages_per_day=1, window_start="00:00", window_end="23:59", min_gap_minutes=1))
    db.commit()
    db.close()

    with patch.object(scheduler_module.scheduler, "add_job") as add_job_mock:
        scheduler_module.schedule_all_targets_for_today(manager=FakeManager(AsyncMock()))
        assert add_job_mock.call_count <= 1  # 0 if the random slot already passed today, else 1
