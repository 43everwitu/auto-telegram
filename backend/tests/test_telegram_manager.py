from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from app.telegram_manager import TelegramAccountManager


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
