import os
import re
from telethon import TelegramClient, utils
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from telethon.tl.types import Channel, Chat
from sqlalchemy.orm import Session
from app.models import Account
from app.crypto import encrypt_session, decrypt_session
from app.premium_emoji import tag_custom_emoji

API_ID = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]

WEB_TELEGRAM_ID_RE = re.compile(r"web\.telegram\.org/\w+/#(-?\d+)(?:_(\d+))?")
BARE_ID_RE = re.compile(r"^(-?\d+)(?:_(\d+))?$")
MESSAGE_LINK_RE = re.compile(r"t\.me/(c/)?([^/\s?]+)/(?:\d+/)?(\d+)")


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

    async def ensure_client(self, db: Session, account_id: int) -> TelegramClient:
        if account_id in self._active_clients:
            return self._active_clients[account_id]
        account = db.get(Account, account_id)
        if account is None:
            raise ValueError(f"Account {account_id} not found")
        decrypted = decrypt_session(account.session_string)
        client = TelegramClient(StringSession(decrypted), API_ID, API_HASH)
        await client.connect()
        self._active_clients[account_id] = client
        return client

    async def start_otp_login(self, phone: str) -> str:
        client = TelegramClient(StringSession(), API_ID, API_HASH)
        await client.connect()
        sent = await client.send_code_request(phone)
        self._pending_clients[phone] = client
        return sent.phone_code_hash

    async def confirm_otp_login(
        self, db: Session, phone: str, code: str, password: str | None = None
    ) -> Account:
        try:
            client = self._pending_clients[phone]
        except KeyError:
            raise ValueError("No pending login for this phone number, request a new code")

        try:
            await client.sign_in(phone=phone, code=code)
        except SessionPasswordNeededError:
            if not password:
                raise ValueError("Two-factor password required")
            await client.sign_in(password=password)

        me = await client.get_me()
        account = await self._persist_account(db, client, me.phone)
        del self._pending_clients[phone]
        return account

    async def resolve_chat(self, db: Session, account_id: int, link: str) -> tuple[str, str, str, int | None]:
        client = await self.ensure_client(db, account_id)
        raw = link.strip()

        numeric_id: int | None = None
        topic_id: int | None = None
        m = WEB_TELEGRAM_ID_RE.search(raw) or BARE_ID_RE.match(raw)
        if m:
            numeric_id = int(m.group(1))
            if m.group(2):
                topic_id = int(m.group(2))

        if numeric_id is not None:
            entity = await self._find_dialog_entity(client, numeric_id)
            if entity is None:
                raise ValueError(
                    f"Could not find a chat with ID {numeric_id} among this account's chats. "
                    "Make sure this account has already joined it."
                )
        else:
            try:
                entity = await client.get_entity(raw)
            except Exception as e:
                raise ValueError(
                    f"Could not resolve '{link}': {e}. "
                    "Make sure the link/username is correct and this account has already "
                    "joined the group or channel."
                )

        if not isinstance(entity, (Channel, Chat)):
            raise ValueError(f"'{link}' is not a group or channel")

        if isinstance(entity, Channel) and entity.broadcast:
            chat_type = "channel"
        else:
            chat_type = "group"

        chat_id = str(utils.get_peer_id(entity))
        title = getattr(entity, "title", "") or link
        return chat_id, chat_type, title, topic_id

    async def _find_dialog_entity(self, client: TelegramClient, peer_id: int):
        async for dialog in client.iter_dialogs():
            if utils.get_peer_id(dialog.entity) == peer_id:
                return dialog.entity
        return None

    async def resolve_send_target(self, client: TelegramClient, chat_id: str):
        """Resolve a stored telegram_chat_id into something client.send_message accepts.

        Stored chat IDs are raw numeric peer IDs (e.g. "-1001715471462"). Telethon can only
        resolve those from its access-hash cache, which is empty on every fresh process start
        (StringSession doesn't persist it) even though the account is a member of the chat.
        Fall back to scanning dialogs — the same trick used when the chat was first looked up.
        """
        value: int | str = int(chat_id) if chat_id.lstrip("-").isdigit() else chat_id
        try:
            return await client.get_input_entity(value)
        except ValueError:
            if isinstance(value, int):
                entity = await self._find_dialog_entity(client, value)
                if entity is not None:
                    return entity
            raise

    async def import_template_from_message(self, db: Session, account_id: int, link: str) -> str:
        """Fetch a real Telegram message's text with its custom (Premium) emoji intact, tagged
        as [emoji:ID]fallback[/emoji] markup ready to save as a template body. Plain copy-paste
        from a Telegram client loses the custom-emoji document IDs — this reads them straight
        from the message's entities instead."""
        client = await self.ensure_client(db, account_id)
        m = MESSAGE_LINK_RE.search(link.strip())
        if not m:
            raise ValueError(
                "Invalid Telegram message link. Expected something like "
                "https://t.me/channel/123 or https://t.me/c/1234567890/123"
            )
        is_private, chat_part, msg_id = m.group(1), m.group(2), int(m.group(3))

        if is_private:
            peer_id = int(f"-100{chat_part}")
            entity = await self._find_dialog_entity(client, peer_id)
            if entity is None:
                raise ValueError(
                    "Could not find that private chat among this account's chats — "
                    "make sure this account is a member."
                )
        else:
            try:
                entity = await client.get_entity(chat_part)
            except Exception as e:
                raise ValueError(f"Could not resolve chat '{chat_part}': {e}")

        msg = await client.get_messages(entity, ids=msg_id)
        if msg is None or not msg.message:
            raise ValueError("Message not found, or it has no text")

        return tag_custom_emoji(msg.message, msg.entities or [])
