from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from app.telegram_manager import TelegramAccountManager
from app.models import Account
from app.crypto import encrypt_session


@pytest.mark.asyncio
async def test_login_with_session_string_persists_account(db_session):
    fake_me = MagicMock(phone="1234567890", premium=True)
    fake_client = AsyncMock()
    fake_client.get_me.return_value = fake_me
    fake_client.session = MagicMock()
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client), \
            patch("app.telegram_manager.StringSession"):
        manager = TelegramAccountManager()
        account = await manager.login_with_session_string(db_session, "existing-session")

    assert account.id is not None
    assert account.phone == "1234567890"
    assert account.telegram_premium is True
    assert account.session_string != "raw-session-string"  # stored encrypted


@pytest.mark.asyncio
async def test_login_with_session_string_rejects_invalid_session(db_session):
    fake_client = AsyncMock()
    fake_client.get_me.return_value = None

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client), \
            patch("app.telegram_manager.StringSession"):
        manager = TelegramAccountManager()
        with pytest.raises(ValueError):
            await manager.login_with_session_string(db_session, "bad-session")


@pytest.mark.asyncio
async def test_get_client_returns_client_used_at_login(db_session):
    fake_me = MagicMock(phone="1234567890", premium=False)
    fake_client = AsyncMock()
    fake_client.get_me.return_value = fake_me
    fake_client.session = MagicMock()
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client), \
            patch("app.telegram_manager.StringSession"):
        manager = TelegramAccountManager()
        account = await manager.login_with_session_string(db_session, "existing-session")

    assert manager.get_client(account.id) is fake_client


@pytest.mark.asyncio
async def test_ensure_client_returns_cached_client(db_session):
    manager = TelegramAccountManager()
    cached_client = AsyncMock()
    manager._active_clients[1] = cached_client

    result = await manager.ensure_client(db_session, 1)

    assert result is cached_client


@pytest.mark.asyncio
async def test_ensure_client_decrypts_and_connects_when_not_cached(db_session):
    account = Account(
        id=1, phone="1234567890", session_string=encrypt_session("raw-session-string"), status="active",
    )
    db_session.add(account)
    db_session.commit()

    fake_client = AsyncMock()
    with patch("app.telegram_manager.TelegramClient", return_value=fake_client) as client_cls, \
            patch("app.telegram_manager.StringSession") as string_session_cls:
        manager = TelegramAccountManager()
        result = await manager.ensure_client(db_session, account.id)

    string_session_cls.assert_called_once_with("raw-session-string")
    client_cls.assert_called_once()
    fake_client.connect.assert_awaited_once()
    assert result is fake_client
    assert manager._active_clients[account.id] is fake_client


@pytest.mark.asyncio
async def test_ensure_client_raises_for_missing_account(db_session):
    manager = TelegramAccountManager()
    with pytest.raises(ValueError):
        await manager.ensure_client(db_session, 999)


@pytest.mark.asyncio
async def test_start_otp_login_returns_phone_code_hash(db_session):
    fake_sent = MagicMock(phone_code_hash="hash-123")
    fake_client = AsyncMock()
    fake_client.send_code_request.return_value = fake_sent

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
        manager = TelegramAccountManager()
        result = await manager.start_otp_login("+841234567")

    assert result == "hash-123"
    fake_client.connect.assert_awaited()


@pytest.mark.asyncio
async def test_confirm_otp_login_persists_account(db_session):
    fake_me = MagicMock(phone="841234567", premium=False)
    fake_client = AsyncMock()
    fake_client.send_code_request.return_value = MagicMock(phone_code_hash="hash-123")
    fake_client.get_me.return_value = fake_me
    fake_client.session = MagicMock()
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
        manager = TelegramAccountManager()
        await manager.start_otp_login("+841234567")
        account = await manager.confirm_otp_login(db_session, "+841234567", "12345")

    fake_client.sign_in.assert_awaited_with(phone="+841234567", code="12345")
    assert account.phone == "841234567"
