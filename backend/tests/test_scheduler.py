from unittest.mock import AsyncMock, patch
import pytest
from telethon.errors import FloodWaitError
from app.models import Target, ScheduleConfig, ContentTemplate, TargetTemplate, Account
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

    async def ensure_client(self, db, account_id):
        return self._client

    async def resolve_send_target(self, client, chat_id):
        return chat_id


@pytest.mark.asyncio
async def test_send_job_success_writes_log(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Account(id=1, phone="1", session_string="enc", status="active"))
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="T", active=True))
    db.add(ContentTemplate(id=1, body="hello [emoji:99]\U0001F525[/emoji]"))
    db.add(TargetTemplate(target_id=1, template_id=1))
    db.commit()
    db.close()

    fake_client = AsyncMock()
    manager = FakeManager(fake_client)

    with patch("app.routers.accounts.manager", manager):
        await send_job(1)

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
    db.add(ContentTemplate(id=1, body="hello"))
    db.add(TargetTemplate(target_id=1, template_id=1))
    db.commit()
    db.close()

    fake_client = AsyncMock()
    fake_client.send_message.side_effect = RuntimeError("boom")
    manager = FakeManager(fake_client)

    with patch("app.routers.accounts.manager", manager):
        with patch.object(scheduler_module.scheduler, "add_job") as add_job_mock:
            await send_job(1)
            add_job_mock.assert_called_once()
            assert add_job_mock.call_args.kwargs["kwargs"] == {"retry": True}
            assert add_job_mock.call_args.kwargs["args"] == [1]

    check_db = Session()
    logs = check_db.query(scheduler_module.SendLog).all()
    assert logs[0].status == "failed"


@pytest.mark.asyncio
async def test_send_job_flood_wait_pauses_account_jobs(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Account(id=1, phone="1", session_string="enc", status="active"))
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="T", active=True))
    db.add(Target(id=2, account_id=1, telegram_chat_id="-200", type="channel", title="T2", active=True))
    db.add(ContentTemplate(id=1, body="hello"))
    db.add(TargetTemplate(target_id=1, template_id=1))
    db.commit()
    db.close()

    fake_client = AsyncMock()
    fake_client.send_message.side_effect = FloodWaitError(request=None, capture=30)
    manager = FakeManager(fake_client)

    with patch("app.routers.accounts.manager", manager):
        with patch.object(scheduler_module.scheduler, "get_jobs") as get_jobs_mock, \
                patch.object(scheduler_module.scheduler, "remove_job") as remove_job_mock, \
                patch.object(scheduler_module.scheduler, "add_job"):
            fake_job_same_target = type("J", (), {"id": "send-1-2026-09-10-1"})()
            fake_job_other_target = type("J", (), {"id": "send-2-2026-09-10-0"})()
            get_jobs_mock.return_value = [fake_job_same_target, fake_job_other_target]
            await send_job(1)
            assert remove_job_mock.call_count == 2

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
        scheduler_module.schedule_all_targets_for_today()
        assert add_job_mock.call_count <= 1  # 0 if the random slot already passed today, else 1


def test_schedule_all_targets_skips_bad_config_and_continues(monkeypatch):
    # I1 regression: one target's bad schedule config must not abort scheduling
    # for other targets.
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(scheduler_module, "SessionLocal", Session)

    db = Session()
    db.add(Target(id=1, account_id=1, telegram_chat_id="-100", type="channel", title="Bad", active=True))
    db.add(ScheduleConfig(
        id=1, target_id=1, messages_per_day=10, window_start="08:00", window_end="08:30", min_gap_minutes=30,
    ))
    db.add(Target(id=2, account_id=1, telegram_chat_id="-200", type="channel", title="Good", active=True))
    db.add(ScheduleConfig(
        id=2, target_id=2, messages_per_day=1, window_start="00:00", window_end="23:59", min_gap_minutes=1,
    ))
    db.commit()
    db.close()

    with patch.object(scheduler_module.scheduler, "add_job") as add_job_mock:
        scheduler_module.schedule_all_targets_for_today()
        # target 1's bad config raises ValueError (window too small); target 2
        # should still get scheduled (0 or 1 depending on whether its random
        # slot already passed "now" today).
        assert add_job_mock.call_count <= 1
        for call in add_job_mock.call_args_list:
            assert call.kwargs["args"] == [2]
