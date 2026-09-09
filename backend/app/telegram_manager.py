import os
from telethon import TelegramClient
from telethon.sessions import StringSession
from sqlalchemy.orm import Session
from app.models import Account
from app.crypto import encrypt_session

API_ID = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]


class TelegramAccountManager:
    def __init__(self):
        self._active_clients: dict[int, TelegramClient] = {}
        self._pending_clients: dict[str, TelegramClient] = {}

    async def login_with_session_string(self, db: Session, session_string: str) -> Account:
        client = TelegramClient(StringSession(session_string), API_ID, API_HASH)
        await client.connect()
        me = await client.get_me()
        if me is None:
            raise ValueError("Invalid or expired session string")
        return await self._persist_account(db, client, me.phone)

    async def _persist_account(self, db: Session, client: TelegramClient, phone: str) -> Account:
        me = await client.get_me()
        raw_session = client.session.save()
        account = Account(
            phone=phone,
            session_string=encrypt_session(raw_session),
            telegram_premium=bool(getattr(me, "premium", False)),
            status="active",
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        self._active_clients[account.id] = client
        return account

    def get_client(self, account_id: int) -> TelegramClient:
        return self._active_clients[account_id]

    async def start_otp_login(self, phone: str) -> str:
        client = TelegramClient(StringSession(), API_ID, API_HASH)
        await client.connect()
        sent = await client.send_code_request(phone)
        self._pending_clients[phone] = client
        return sent.phone_code_hash

    async def confirm_otp_login(
        self, db: Session, phone: str, code: str, password: str | None = None
    ) -> Account:
        client = self._pending_clients.pop(phone)
        try:
            await client.sign_in(phone=phone, code=code)
        except Exception as e:
            if password and "password" in type(e).__name__.lower():
                await client.sign_in(password=password)
            else:
                raise
        me = await client.get_me()
        return await self._persist_account(db, client, me.phone)
