# Telegram Periodic Post Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dashboard + backend that lets an admin schedule periodic Telegram messages, sent via user accounts (Telethon), to channels/groups those accounts administer, with per-target content and randomized daily timing.

**Architecture:** Python FastAPI backend (async) with an in-process APScheduler (SQLAlchemy/SQLite jobstore) driving a pool of Telethon clients, one per Telegram account. A React (Vite + TS) SPA talks to the backend over a REST API protected by a single-admin JWT login.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, Telethon, APScheduler, PyJWT, bcrypt, pytest/pytest-asyncio/httpx (backend); Vite, React, TypeScript, react-router-dom, Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-09-09-telegram-periodic-post-design.md`

## Global Constraints

- Tool only sends to targets (channel/group) the Telegram account administers — no posting to targets the account doesn't manage.
- No Docker, no Celery/Redis — single process, SQLite, local/VPS deploy.
- Single admin dashboard user (no multi-user roles).
- Telegram account `session_string` must be stored encrypted at rest (Fernet).
- Custom (Telegram Premium) emoji only sent when the owning account has `telegram_premium = true`; otherwise fall back to plain emoji, never error.
- Two account-login paths: OTP (phone + code + optional 2FA password) and pasting an existing `session_string`.

---

## Task 1: Backend Scaffold, DB Models, Test Fixtures

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/models.py`
- Create: `backend/app/db.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Produces: `app.models.Base`, `app.models.Account`, `app.models.Target`, `app.models.ContentTemplate`, `app.models.ScheduleConfig`, `app.models.SendLog`; `app.db.init_db()`, `app.db.get_db()`, `app.db.engine`, `app.db.SessionLocal`, `app.db.DATABASE_URL`; test fixture `db_session` (in-memory SQLite `Session`).

- [ ] **Step 1: Write `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
sqlalchemy
telethon
apscheduler
cryptography
bcrypt
pyjwt
pydantic
python-dotenv
pytest
pytest-asyncio
httpx
```

- [ ] **Step 2: Write `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Write `backend/.env.example`**

```
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
SESSION_ENCRYPTION_KEY=
JWT_SECRET_KEY=
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
DATABASE_URL=sqlite:///./app.db
```

- [ ] **Step 4: Create `backend/app/__init__.py`** (empty file)

- [ ] **Step 5: Write the failing test** — `backend/tests/test_db.py`

```python
from sqlalchemy import inspect
from app.db import init_db, engine


def test_init_db_creates_all_tables():
    init_db()
    tables = set(inspect(engine).get_table_names())
    assert {"accounts", "targets", "content_templates", "schedule_configs", "send_logs"} <= tables
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && pytest tests/test_db.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.db'` or similar)

- [ ] **Step 7: Write `backend/app/models.py`**

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False, unique=True)
    session_string = Column(Text, nullable=False)
    telegram_premium = Column(Boolean, default=False)
    status = Column(String, default="active")  # active|banned|needs_login

    targets = relationship("Target", back_populates="account", cascade="all, delete-orphan")


class Target(Base):
    __tablename__ = "targets"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    telegram_chat_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # channel|group
    title = Column(String, nullable=False)
    active = Column(Boolean, default=True)

    account = relationship("Account", back_populates="targets")
    templates = relationship("ContentTemplate", back_populates="target", cascade="all, delete-orphan")
    schedule_config = relationship(
        "ScheduleConfig", back_populates="target", uselist=False, cascade="all, delete-orphan"
    )


class ContentTemplate(Base):
    __tablename__ = "content_templates"
    id = Column(Integer, primary_key=True)
    body = Column(Text, nullable=False)
    is_override = Column(Boolean, default=False)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=True)

    target = relationship("Target", back_populates="templates")


class ScheduleConfig(Base):
    __tablename__ = "schedule_configs"
    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, unique=True)
    messages_per_day = Column(Integer, nullable=False)
    window_start = Column(String, nullable=False)  # "HH:MM"
    window_end = Column(String, nullable=False)
    min_gap_minutes = Column(Integer, nullable=False)

    target = relationship("Target", back_populates="schedule_config")


class SendLog(Base):
    __tablename__ = "send_logs"
    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("content_templates.id"), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # success|failed
    error_message = Column(Text, nullable=True)
```

- [ ] **Step 8: Write `backend/app/db.py`**

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd backend && pytest tests/test_db.py -v`
Expected: PASS

- [ ] **Step 10: Write `backend/tests/__init__.py`** (empty file)

- [ ] **Step 11: Write `backend/tests/conftest.py`** — shared fixtures and test env vars used by every later task

```python
import os
import bcrypt
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

os.environ.setdefault("TELEGRAM_API_ID", "12345")
os.environ.setdefault("TELEGRAM_API_HASH", "test-hash")
os.environ.setdefault("SESSION_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault(
    "ADMIN_PASSWORD_HASH", bcrypt.hashpw(b"admin-pass", bcrypt.gensalt()).decode()
)


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```

- [ ] **Step 12: Run full backend test suite**

Run: `cd backend && pytest -v`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/.env.example backend/app/__init__.py backend/app/models.py backend/app/db.py backend/tests/
git commit -m "feat: backend scaffold, DB models, test fixtures"
```

---

## Task 2: Session String Encryption

**Files:**
- Create: `backend/app/crypto.py`
- Test: `backend/tests/test_crypto.py`

**Interfaces:**
- Consumes: `os.environ["SESSION_ENCRYPTION_KEY"]` (set by `conftest.py` in tests).
- Produces: `app.crypto.encrypt_session(raw: str) -> str`, `app.crypto.decrypt_session(token: str) -> str`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_crypto.py`

```python
from app.crypto import encrypt_session, decrypt_session


def test_encrypt_decrypt_roundtrip():
    raw = "example-telethon-session-string"
    token = encrypt_session(raw)
    assert token != raw
    assert decrypt_session(token) == raw
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_crypto.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.crypto'`)

- [ ] **Step 3: Write `backend/app/crypto.py`**

```python
import os
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    key = os.environ["SESSION_ENCRYPTION_KEY"]
    return Fernet(key.encode())


def encrypt_session(raw: str) -> str:
    return _get_fernet().encrypt(raw.encode()).decode()


def decrypt_session(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_crypto.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/crypto.py backend/tests/test_crypto.py
git commit -m "feat: encrypt/decrypt Telegram session strings"
```

---

## Task 3: Daily Schedule Time Generator

**Files:**
- Create: `backend/app/schedule_gen.py`
- Test: `backend/tests/test_schedule_gen.py`

**Interfaces:**
- Produces: `app.schedule_gen.generate_daily_times(x: int, window_start: str, window_end: str, min_gap_minutes: int, day: date) -> list[datetime]`. Raises `ValueError` if the window is too small to fit `x` slots with the required gap.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_schedule_gen.py`

```python
from datetime import date, datetime, time
import pytest
from app.schedule_gen import generate_daily_times


def test_generates_correct_count():
    times = generate_daily_times(3, "08:00", "22:00", 30, date(2026, 9, 10))
    assert len(times) == 3


def test_respects_window():
    day = date(2026, 9, 10)
    start = datetime.combine(day, time(8, 0))
    end = datetime.combine(day, time(22, 0))
    times = generate_daily_times(5, "08:00", "22:00", 10, day)
    assert all(start <= t <= end for t in times)


def test_respects_min_gap():
    times = generate_daily_times(5, "08:00", "22:00", 30, date(2026, 9, 10))
    for a, b in zip(times, times[1:]):
        assert (b - a).total_seconds() >= 30 * 60


def test_returns_sorted_times():
    times = generate_daily_times(4, "08:00", "22:00", 20, date(2026, 9, 10))
    assert times == sorted(times)


def test_raises_when_window_too_small():
    with pytest.raises(ValueError):
        generate_daily_times(10, "08:00", "08:30", 30, date(2026, 9, 10))


def test_zero_messages_returns_empty_list():
    assert generate_daily_times(0, "08:00", "22:00", 30, date(2026, 9, 10)) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_schedule_gen.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.schedule_gen'`)

- [ ] **Step 3: Write `backend/app/schedule_gen.py`**

```python
import random
from datetime import date, datetime, time, timedelta


def generate_daily_times(
    x: int, window_start: str, window_end: str, min_gap_minutes: int, day: date
) -> list[datetime]:
    if x <= 0:
        return []

    start_h, start_m = map(int, window_start.split(":"))
    end_h, end_m = map(int, window_end.split(":"))
    start_dt = datetime.combine(day, time(start_h, start_m))
    end_dt = datetime.combine(day, time(end_h, end_m))
    window_minutes = int((end_dt - start_dt).total_seconds() // 60)

    if window_minutes < (x - 1) * min_gap_minutes:
        raise ValueError(
            f"Window too small: need {(x - 1) * min_gap_minutes} min of gap capacity, "
            f"have {window_minutes}"
        )

    max_attempts = 500
    for _ in range(max_attempts):
        offsets = sorted(random.randint(0, window_minutes) for _ in range(x))
        if all(offsets[i + 1] - offsets[i] >= min_gap_minutes for i in range(x - 1)):
            return [start_dt + timedelta(minutes=o) for o in offsets]
    raise RuntimeError("Could not generate a valid schedule after max attempts")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_schedule_gen.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schedule_gen.py backend/tests/test_schedule_gen.py
git commit -m "feat: random daily schedule time generator"
```

---

## Task 4: Content Template Resolver

**Files:**
- Create: `backend/app/content.py`
- Test: `backend/tests/test_content.py`

**Interfaces:**
- Consumes: `app.models.Target`, `app.models.ContentTemplate` (Task 1); `db_session` fixture (Task 1).
- Produces: `app.content.resolve_template(db: Session, target_id: int) -> ContentTemplate`. Raises `ValueError` if no template (override or shared) exists.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_content.py`

```python
import pytest
from app.models import Target, ContentTemplate
from app.content import resolve_template


def _make_target(db_session, target_id=1):
    target = Target(id=target_id, account_id=1, telegram_chat_id="100", type="channel", title="T", active=True)
    db_session.add(target)
    db_session.commit()
    return target


def test_resolve_uses_override_when_present(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="shared", is_override=False, target_id=None))
    db_session.add(ContentTemplate(id=2, body="override", is_override=True, target_id=1))
    db_session.commit()

    result = resolve_template(db_session, target_id=1)
    assert result.body == "override"


def test_resolve_falls_back_to_shared_pool(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="shared", is_override=False, target_id=None))
    db_session.commit()

    result = resolve_template(db_session, target_id=1)
    assert result.body == "shared"


def test_resolve_raises_when_no_template(db_session):
    _make_target(db_session)
    with pytest.raises(ValueError):
        resolve_template(db_session, target_id=1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_content.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.content'`)

- [ ] **Step 3: Write `backend/app/content.py`**

```python
import random
from sqlalchemy.orm import Session
from app.models import ContentTemplate


def resolve_template(db: Session, target_id: int) -> ContentTemplate:
    overrides = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.target_id == target_id, ContentTemplate.is_override.is_(True))
        .all()
    )
    if overrides:
        return random.choice(overrides)

    shared = db.query(ContentTemplate).filter(ContentTemplate.target_id.is_(None)).all()
    if shared:
        return random.choice(shared)

    raise ValueError(f"No content template available for target {target_id}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_content.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/content.py backend/tests/test_content.py
git commit -m "feat: content template resolver (override over shared pool)"
```

---

## Task 5: Admin Auth (JWT)

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/deps.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `os.environ["JWT_SECRET_KEY"]`, `os.environ["ADMIN_USERNAME"]`, `os.environ["ADMIN_PASSWORD_HASH"]` (Task 1 conftest).
- Produces: `app.auth.verify_password(plain, hashed) -> bool`, `app.auth.create_access_token(subject: str) -> str`, `app.auth.decode_access_token(token: str) -> str`; `app.deps.require_admin(authorization: str = Header(...)) -> str` (FastAPI dependency, raises `HTTPException(401)` on bad/missing token).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_auth.py`

```python
import pytest
from app.auth import create_access_token, decode_access_token, verify_password
import bcrypt


def test_verify_password_correct():
    hashed = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    assert verify_password("secret", hashed) is True


def test_verify_password_wrong():
    hashed = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    assert verify_password("wrong", hashed) is False


def test_token_roundtrip():
    token = create_access_token("admin")
    assert decode_access_token(token) == "admin"


def test_decode_rejects_garbage_token():
    with pytest.raises(Exception):
        decode_access_token("not-a-real-token")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.auth'`)

- [ ] **Step 3: Write `backend/app/auth.py`**

```python
import os
import time
import bcrypt
import jwt

ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 12


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str) -> str:
    secret = os.environ["JWT_SECRET_KEY"]
    payload = {"sub": subject, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    secret = os.environ["JWT_SECRET_KEY"]
    payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    return payload["sub"]
```

- [ ] **Step 4: Write `backend/app/deps.py`**

```python
from fastapi import Header, HTTPException
from app.auth import decode_access_token


def require_admin(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        return decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth.py backend/app/deps.py backend/tests/test_auth.py
git commit -m "feat: admin JWT auth and require_admin dependency"
```

---

## Task 6: Telegram Account Manager — Session-String Login

**Files:**
- Create: `backend/app/telegram_manager.py`
- Test: `backend/tests/test_telegram_manager.py`

**Interfaces:**
- Consumes: `os.environ["TELEGRAM_API_ID"]`, `os.environ["TELEGRAM_API_HASH"]` (Task 1 conftest); `app.crypto.encrypt_session` (Task 2); `app.models.Account` (Task 1).
- Produces: `class app.telegram_manager.TelegramAccountManager` with `async def login_with_session_string(self, db: Session, session_string: str) -> Account` and `def get_client(self, account_id: int) -> TelegramClient`. Later tasks (7, 14) add `start_otp_login` / `confirm_otp_login` to this same class.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_telegram_manager.py`

```python
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from app.telegram_manager import TelegramAccountManager


@pytest.mark.asyncio
async def test_login_with_session_string_persists_account(db_session):
    fake_me = MagicMock(phone="1234567890", premium=True)
    fake_client = AsyncMock()
    fake_client.get_me.return_value = fake_me
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
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

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
        manager = TelegramAccountManager()
        with pytest.raises(ValueError):
            await manager.login_with_session_string(db_session, "bad-session")


@pytest.mark.asyncio
async def test_get_client_returns_client_used_at_login(db_session):
    fake_me = MagicMock(phone="1234567890", premium=False)
    fake_client = AsyncMock()
    fake_client.get_me.return_value = fake_me
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
        manager = TelegramAccountManager()
        account = await manager.login_with_session_string(db_session, "existing-session")

    assert manager.get_client(account.id) is fake_client
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_telegram_manager.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.telegram_manager'`)

- [ ] **Step 3: Write `backend/app/telegram_manager.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_telegram_manager.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/telegram_manager.py backend/tests/test_telegram_manager.py
git commit -m "feat: Telegram account manager with session-string login"
```

---

## Task 7: Telegram Account Manager — OTP Login

**Files:**
- Modify: `backend/app/telegram_manager.py`
- Modify: `backend/tests/test_telegram_manager.py`

**Interfaces:**
- Consumes: `TelegramAccountManager` (Task 6).
- Produces: `TelegramAccountManager.start_otp_login(self, phone: str) -> str` (returns `phone_code_hash`), `TelegramAccountManager.confirm_otp_login(self, db: Session, phone: str, code: str, password: str | None = None) -> Account`.

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_telegram_manager.py`

```python
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
    fake_client.session.save.return_value = "raw-session-string"

    with patch("app.telegram_manager.TelegramClient", return_value=fake_client):
        manager = TelegramAccountManager()
        await manager.start_otp_login("+841234567")
        account = await manager.confirm_otp_login(db_session, "+841234567", "12345")

    fake_client.sign_in.assert_awaited_with(phone="+841234567", code="12345")
    assert account.phone == "841234567"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_telegram_manager.py -v`
Expected: FAIL (`AttributeError: 'TelegramAccountManager' object has no attribute 'start_otp_login'`)

- [ ] **Step 3: Modify `backend/app/telegram_manager.py`** — add pending-login registry and the two new methods to `TelegramAccountManager`

```python
    def __init__(self):
        self._active_clients: dict[int, TelegramClient] = {}
        self._pending_clients: dict[str, TelegramClient] = {}

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
        return await self._persist_account(db, client, phone)
```

(Insert `_pending_clients` init into the existing `__init__`, add the two new methods anywhere inside the class.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_telegram_manager.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/telegram_manager.py backend/tests/test_telegram_manager.py
git commit -m "feat: OTP-based Telegram account login"
```

---

## Task 8: FastAPI App Wiring + Auth Endpoint

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/schemas.py` (auth portion only; extended in later tasks)
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/tests/conftest.py` (add `api_client` fixture)
- Test: `backend/tests/test_auth_api.py`

**Interfaces:**
- Consumes: `app.auth.verify_password`, `app.auth.create_access_token` (Task 5).
- Produces: FastAPI app at `app.main:app`; `api_client` pytest fixture (a `TestClient` with `get_db` overridden to a fresh in-memory DB per test); `POST /api/auth/login` → `{"access_token": str}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_auth_api.py`

```python
def test_login_success(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth_api.py -v`
Expected: FAIL (fixture `api_client` not found / `app.main` missing)

- [ ] **Step 3: Write `backend/app/schemas.py`**

```python
from datetime import datetime
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str


class AccountOut(BaseModel):
    id: int
    phone: str
    telegram_premium: bool
    status: str

    class Config:
        from_attributes = True


class OtpStartRequest(BaseModel):
    phone: str


class OtpConfirmRequest(BaseModel):
    phone: str
    code: str
    password: str | None = None


class SessionStringLoginRequest(BaseModel):
    session_string: str


class TargetCreate(BaseModel):
    account_id: int
    telegram_chat_id: str
    type: str
    title: str


class TargetOut(TargetCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True


class TemplateCreate(BaseModel):
    body: str
    is_override: bool = False
    target_id: int | None = None


class TemplateOut(TemplateCreate):
    id: int

    class Config:
        from_attributes = True


class ScheduleConfigCreate(BaseModel):
    target_id: int
    messages_per_day: int
    window_start: str
    window_end: str
    min_gap_minutes: int


class ScheduleConfigOut(ScheduleConfigCreate):
    id: int

    class Config:
        from_attributes = True


class SendLogOut(BaseModel):
    id: int
    target_id: int
    template_id: int | None
    sent_at: datetime
    status: str
    error_message: str | None

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Write `backend/app/routers/__init__.py`** (empty file)

- [ ] **Step 5: Write `backend/app/routers/auth.py`**

```python
import os
from fastapi import APIRouter, HTTPException
from app.auth import verify_password, create_access_token
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    admin_username = os.environ["ADMIN_USERNAME"]
    admin_password_hash = os.environ["ADMIN_PASSWORD_HASH"]
    if req.username != admin_username or not verify_password(req.password, admin_password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(req.username)
    return LoginResponse(access_token=token)
```

- [ ] **Step 6: Write `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routers import auth

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)
app.include_router(auth.router)


@app.on_event("startup")
def on_startup():
    init_db()
```

- [ ] **Step 7: Modify `backend/tests/conftest.py`** — add `api_client` fixture (append to file)

```python
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def api_client():
    from app.main import app
    from app.db import get_db

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && pytest tests/test_auth_api.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/main.py backend/app/schemas.py backend/app/routers/ backend/tests/conftest.py backend/tests/test_auth_api.py
git commit -m "feat: FastAPI app wiring and admin login endpoint"
```

---

## Task 9: Accounts Router

**Files:**
- Create: `backend/app/routers/accounts.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_accounts_api.py`

**Interfaces:**
- Consumes: `TelegramAccountManager` (Tasks 6-7), `app.deps.require_admin` (Task 5), `app.schemas.AccountOut/OtpStartRequest/OtpConfirmRequest/SessionStringLoginRequest` (Task 8).
- Produces: module-level `app.routers.accounts.manager: TelegramAccountManager` (imported by Task 14's scheduler wiring); `GET/POST/DELETE /api/accounts...` endpoints, all requiring `Authorization: Bearer <token>`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_accounts_api.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_accounts_api.py -v`
Expected: FAIL (404 for unknown routes / `ModuleNotFoundError`)

- [ ] **Step 3: Write `backend/app/routers/accounts.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import Account
from app.schemas import AccountOut, OtpStartRequest, OtpConfirmRequest, SessionStringLoginRequest
from app.telegram_manager import TelegramAccountManager

router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(require_admin)])
manager = TelegramAccountManager()


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()


@router.post("/otp/start")
async def otp_start(req: OtpStartRequest):
    phone_code_hash = await manager.start_otp_login(req.phone)
    return {"phone_code_hash": phone_code_hash}


@router.post("/otp/confirm", response_model=AccountOut)
async def otp_confirm(req: OtpConfirmRequest, db: Session = Depends(get_db)):
    return await manager.confirm_otp_login(db, req.phone, req.code, req.password)


@router.post("/session-string", response_model=AccountOut)
async def session_string_login(req: SessionStringLoginRequest, db: Session = Depends(get_db)):
    try:
        return await manager.login_with_session_string(db, req.session_string)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(account)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Modify `backend/app/main.py`** — register the router

```python
from app.routers import auth, accounts
...
app.include_router(accounts.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_accounts_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/accounts.py backend/app/main.py backend/tests/test_accounts_api.py
git commit -m "feat: accounts API (list, OTP login, session-string login, delete)"
```

---

## Task 10: Targets Router

**Files:**
- Create: `backend/app/routers/targets.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_targets_api.py`

**Interfaces:**
- Consumes: `app.models.Target` (Task 1), `app.deps.require_admin` (Task 5), `app.schemas.TargetCreate/TargetOut` (Task 8).
- Produces: `GET/POST /api/targets`, `PATCH /api/targets/{id}/active`, `DELETE /api/targets/{id}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_targets_api.py`

```python
def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_create_and_list_target(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "My Channel"}
    create_resp = api_client.post("/api/targets", json=payload, headers=headers)
    assert create_resp.status_code == 200
    target_id = create_resp.json()["id"]

    list_resp = api_client.get("/api/targets", headers=headers)
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == target_id
    assert list_resp.json()[0]["active"] is True


def test_toggle_active(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "group", "title": "My Group"}
    target_id = api_client.post("/api/targets", json=payload, headers=headers).json()["id"]

    resp = api_client.patch(f"/api/targets/{target_id}/active?active=false", headers=headers)
    assert resp.json()["active"] is False


def test_delete_target(api_client):
    headers = _auth_header(api_client)
    payload = {"account_id": 1, "telegram_chat_id": "-100123", "type": "channel", "title": "T"}
    target_id = api_client.post("/api/targets", json=payload, headers=headers).json()["id"]

    del_resp = api_client.delete(f"/api/targets/{target_id}", headers=headers)
    assert del_resp.status_code == 200
    assert api_client.get("/api/targets", headers=headers).json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_targets_api.py -v`
Expected: FAIL (404 not found)

- [ ] **Step 3: Write `backend/app/routers/targets.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import Target
from app.schemas import TargetCreate, TargetOut

router = APIRouter(prefix="/api/targets", tags=["targets"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TargetOut])
def list_targets(db: Session = Depends(get_db)):
    return db.query(Target).all()


@router.post("", response_model=TargetOut)
def create_target(req: TargetCreate, db: Session = Depends(get_db)):
    target = Target(**req.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.patch("/{target_id}/active", response_model=TargetOut)
def set_active(target_id: int, active: bool, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    target.active = active
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{target_id}")
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(target)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Modify `backend/app/main.py`**

```python
from app.routers import auth, accounts, targets
...
app.include_router(targets.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_targets_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/targets.py backend/app/main.py backend/tests/test_targets_api.py
git commit -m "feat: targets API (CRUD + active toggle)"
```

---

## Task 11: Templates Router

**Files:**
- Create: `backend/app/routers/templates.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_templates_api.py`

**Interfaces:**
- Consumes: `app.models.ContentTemplate` (Task 1), `app.deps.require_admin` (Task 5), `app.schemas.TemplateCreate/TemplateOut` (Task 8).
- Produces: `GET/POST /api/templates`, `DELETE /api/templates/{id}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_templates_api.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_templates_api.py -v`
Expected: FAIL (404 not found)

- [ ] **Step 3: Write `backend/app/routers/templates.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import ContentTemplate
from app.schemas import TemplateCreate, TemplateOut

router = APIRouter(prefix="/api/templates", tags=["templates"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return db.query(ContentTemplate).all()


@router.post("", response_model=TemplateOut)
def create_template(req: TemplateCreate, db: Session = Depends(get_db)):
    template = ContentTemplate(**req.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(ContentTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(template)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Modify `backend/app/main.py`**

```python
from app.routers import auth, accounts, targets, templates
...
app.include_router(templates.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_templates_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/templates.py backend/app/main.py backend/tests/test_templates_api.py
git commit -m "feat: content templates API"
```

---

## Task 12: Schedule Config Router

**Files:**
- Create: `backend/app/routers/schedules.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_schedules_api.py`

**Interfaces:**
- Consumes: `app.models.ScheduleConfig` (Task 1), `app.deps.require_admin` (Task 5), `app.schemas.ScheduleConfigCreate/ScheduleConfigOut` (Task 8).
- Produces: `GET /api/schedules`, `PUT /api/schedules/{target_id}` (upsert, one config per target), `DELETE /api/schedules/{target_id}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_schedules_api.py`

```python
def _auth_header(api_client):
    resp = api_client.post("/api/auth/login", json={"username": "admin", "password": "admin-pass"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_upsert_creates_then_updates(api_client):
    headers = _auth_header(api_client)
    payload = {
        "target_id": 1, "messages_per_day": 3, "window_start": "08:00",
        "window_end": "22:00", "min_gap_minutes": 30,
    }
    resp1 = api_client.put("/api/schedules/1", json=payload, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["messages_per_day"] == 3

    payload["messages_per_day"] = 5
    resp2 = api_client.put("/api/schedules/1", json=payload, headers=headers)
    assert resp2.json()["messages_per_day"] == 5

    list_resp = api_client.get("/api/schedules", headers=headers)
    assert len(list_resp.json()) == 1  # updated, not duplicated


def test_delete_schedule(api_client):
    headers = _auth_header(api_client)
    payload = {
        "target_id": 2, "messages_per_day": 2, "window_start": "09:00",
        "window_end": "20:00", "min_gap_minutes": 60,
    }
    api_client.put("/api/schedules/2", json=payload, headers=headers)
    resp = api_client.delete("/api/schedules/2", headers=headers)
    assert resp.status_code == 200
    assert api_client.get("/api/schedules", headers=headers).json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_schedules_api.py -v`
Expected: FAIL (404 not found)

- [ ] **Step 3: Write `backend/app/routers/schedules.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import ScheduleConfig
from app.schemas import ScheduleConfigCreate, ScheduleConfigOut

router = APIRouter(prefix="/api/schedules", tags=["schedules"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[ScheduleConfigOut])
def list_schedules(db: Session = Depends(get_db)):
    return db.query(ScheduleConfig).all()


@router.put("/{target_id}", response_model=ScheduleConfigOut)
def upsert_schedule(target_id: int, req: ScheduleConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(ScheduleConfig).filter(ScheduleConfig.target_id == target_id).first()
    if existing:
        existing.messages_per_day = req.messages_per_day
        existing.window_start = req.window_start
        existing.window_end = req.window_end
        existing.min_gap_minutes = req.min_gap_minutes
        db.commit()
        db.refresh(existing)
        return existing
    config = ScheduleConfig(**req.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{target_id}")
def delete_schedule(target_id: int, db: Session = Depends(get_db)):
    config = db.query(ScheduleConfig).filter(ScheduleConfig.target_id == target_id).first()
    if config is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(config)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Modify `backend/app/main.py`**

```python
from app.routers import auth, accounts, targets, templates, schedules
...
app.include_router(schedules.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_schedules_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/schedules.py backend/app/main.py backend/tests/test_schedules_api.py
git commit -m "feat: schedule config API (upsert per target)"
```

---

## Task 13: Logs & Stats Router

**Files:**
- Create: `backend/app/routers/logs.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_logs_api.py`

**Interfaces:**
- Consumes: `app.models.SendLog` (Task 1), `app.deps.require_admin` (Task 5), `app.schemas.SendLogOut` (Task 8).
- Produces: `GET /api/logs?target_id=` (latest 200, newest first), `GET /api/logs/stats` → `{target_id: {status: count}}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_logs_api.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_logs_api.py -v`
Expected: FAIL (404 not found)

- [ ] **Step 3: Write `backend/app/routers/logs.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db import get_db
from app.deps import require_admin
from app.models import SendLog
from app.schemas import SendLogOut

router = APIRouter(prefix="/api/logs", tags=["logs"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[SendLogOut])
def list_logs(target_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(SendLog)
    if target_id is not None:
        q = q.filter(SendLog.target_id == target_id)
    return q.order_by(SendLog.sent_at.desc()).limit(200).all()


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    rows = (
        db.query(SendLog.target_id, SendLog.status, func.count(SendLog.id))
        .group_by(SendLog.target_id, SendLog.status)
        .all()
    )
    result: dict[int, dict[str, int]] = {}
    for target_id, status, count in rows:
        result.setdefault(target_id, {})[status] = count
    return result
```

- [ ] **Step 4: Modify `backend/app/main.py`**

```python
from app.routers import auth, accounts, targets, templates, schedules, logs
...
app.include_router(logs.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_logs_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/logs.py backend/app/main.py backend/tests/test_logs_api.py
git commit -m "feat: send logs and stats API"
```

---

## Task 14: Scheduler — Daily Job Generation & Send Execution

**Files:**
- Create: `backend/app/scheduler.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_scheduler.py`

**Interfaces:**
- Consumes: `app.schedule_gen.generate_daily_times` (Task 3), `app.content.resolve_template` (Task 4), `app.telegram_manager.TelegramAccountManager` (Tasks 6-7), `app.models.Target/ScheduleConfig/SendLog/Account` (Task 1), `app.routers.accounts.manager` (Task 9), `app.db.SessionLocal/DATABASE_URL` (Task 1).
- Produces: `app.scheduler.scheduler: AsyncIOScheduler`, `app.scheduler.schedule_all_targets_for_today(manager)`, `app.scheduler.send_job(target_id: int, manager, retry: bool = False)` (async).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_scheduler.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_scheduler.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.scheduler'`)

- [ ] **Step 3: Write `backend/app/scheduler.py`**

```python
from datetime import date, datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from telethon.errors import FloodWaitError, UserDeactivatedBanError, AuthKeyUnregisteredError, ChatWriteForbiddenError

from app.db import DATABASE_URL, SessionLocal
from app.models import Target, SendLog, Account
from app.schedule_gen import generate_daily_times
from app.content import resolve_template

scheduler = AsyncIOScheduler(jobstores={"default": SQLAlchemyJobStore(url=DATABASE_URL)})


def schedule_all_targets_for_today(manager):
    db = SessionLocal()
    try:
        targets = db.query(Target).filter(Target.active.is_(True)).all()
        for target in targets:
            config = target.schedule_config
            if config is None:
                continue
            times = generate_daily_times(
                config.messages_per_day, config.window_start, config.window_end,
                config.min_gap_minutes, date.today(),
            )
            for i, run_time in enumerate(times):
                if run_time < datetime.now():
                    continue
                scheduler.add_job(
                    send_job, "date", run_date=run_time,
                    args=[target.id, manager],
                    id=f"send-{target.id}-{date.today()}-{i}",
                    replace_existing=True,
                )
    finally:
        db.close()


async def send_job(target_id: int, manager, retry: bool = False):
    db = SessionLocal()
    try:
        target = db.get(Target, target_id)
        if target is None or not target.active:
            return
        try:
            template = resolve_template(db, target_id)
        except ValueError:
            return

        try:
            client = manager.get_client(target.account_id)
            await client.send_message(target.telegram_chat_id, template.body, parse_mode="html")
            db.add(SendLog(target_id=target_id, template_id=template.id, status="success"))
        except FloodWaitError as e:
            scheduler.add_job(
                send_job, "date", run_date=datetime.now() + timedelta(seconds=e.seconds),
                args=[target_id, manager],
            )
            db.add(SendLog(
                target_id=target_id, template_id=template.id, status="failed",
                error_message=f"FloodWait {e.seconds}s, rescheduled",
            ))
        except (UserDeactivatedBanError, AuthKeyUnregisteredError) as e:
            account = db.get(Account, target.account_id)
            if account:
                account.status = "banned"
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        except ChatWriteForbiddenError as e:
            target.active = False
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        except Exception as e:
            if not retry:
                scheduler.add_job(
                    send_job, "date", run_date=datetime.now() + timedelta(minutes=5),
                    args=[target_id, manager], kwargs={"retry": True},
                )
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        db.commit()
    finally:
        db.close()
```

- [ ] **Step 4: Modify `backend/app/main.py`** — start scheduler and register the daily cron job

```python
from app.scheduler import scheduler, schedule_all_targets_for_today
from app.routers.accounts import manager as telegram_manager
...

@app.on_event("startup")
def on_startup():
    init_db()
    scheduler.start()
    scheduler.add_job(
        schedule_all_targets_for_today, "cron", hour=0, minute=5,
        args=[telegram_manager], id="daily-schedule-generator", replace_existing=True,
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_scheduler.py -v`
Expected: PASS

- [ ] **Step 6: Run full backend suite**

Run: `cd backend && pytest -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/scheduler.py backend/app/main.py backend/tests/test_scheduler.py
git commit -m "feat: scheduler with daily job generation and error-handled send"
```

---

## Task 15: Frontend Scaffold + API Client + Auth Guard

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/AuthGuard.tsx`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: `frontend/src/api.ts` exporting `apiGet<T>(path)`, `apiPost<T>(path, body)`, `apiDelete(path)`, `apiPut<T>(path, body)`, `login(username, password): Promise<string>`; `AuthGuard` component redirecting to `/login` when no token in `localStorage`.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "telegram-periodic-post-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Write `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 3: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Telegram Periodic Post Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the failing test** — `frontend/src/api.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, apiGet } from "./api";

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("login stores the access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "tok-123" }),
      })
    );
    const token = await login("admin", "pw");
    expect(token).toBe("tok-123");
    expect(localStorage.getItem("access_token")).toBe("tok-123");
  });

  it("apiGet throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(apiGet("/api/targets")).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npm install && npm test`
Expected: FAIL (`Cannot find module './api'`)

- [ ] **Step 7: Write `frontend/src/api.ts`**

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  localStorage.setItem("access_token", data.access_token);
  return data.access_token;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 9: Write `frontend/src/AuthGuard.tsx`**

```tsx
import { Navigate, Outlet } from "react-router-dom";

export default function AuthGuard() {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

- [ ] **Step 10: Write `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthGuard from "./AuthGuard";
import Login from "./pages/Login";
import Accounts from "./pages/Accounts";
import Targets from "./pages/Targets";
import Templates from "./pages/Templates";
import Schedules from "./pages/Schedules";
import Logs from "./pages/Logs";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 11: Write `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/api.ts frontend/src/AuthGuard.tsx frontend/src/api.test.ts
git commit -m "feat: frontend scaffold, API client, auth guard"
```

---

## Task 16: Login Page

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Test: `frontend/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `login` from `frontend/src/api.ts` (Task 15).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Login.test.tsx`

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Login from "./Login";
import * as api from "../api";

describe("Login page", () => {
  it("shows an error message on failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("bad creds"));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("Login"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Login'`)

- [ ] **Step 3: Write `frontend/src/pages/Login.tsx`**

```tsx
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/accounts");
    } catch {
      setError("Sai tài khoản hoặc mật khẩu");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/pages/Login.test.tsx
git commit -m "feat: login page"
```

---

## Task 17: Accounts Page

**Files:**
- Create: `frontend/src/pages/Accounts.tsx`
- Test: `frontend/src/pages/Accounts.test.tsx`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiDelete` from `frontend/src/api.ts` (Task 15); backend `GET/POST /api/accounts...` (Task 9).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Accounts.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Accounts from "./Accounts";
import * as api from "../api";

describe("Accounts page", () => {
  it("renders accounts fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, phone: "123456", telegram_premium: true, status: "active" },
    ]);
    render(<Accounts />);
    await waitFor(() => {
      expect(screen.getByText("123456")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Accounts'`)

- [ ] **Step 3: Write `frontend/src/pages/Accounts.tsx`**

```tsx
import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Account = {
  id: number;
  phone: string;
  telegram_premium: boolean;
  status: string;
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessionString, setSessionString] = useState("");

  async function refresh() {
    setAccounts(await apiGet<Account[]>("/api/accounts"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSessionStringSubmit(e: FormEvent) {
    e.preventDefault();
    await apiPost("/api/accounts/session-string", { session_string: sessionString });
    setSessionString("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/accounts/${id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Accounts</h1>
      <form onSubmit={handleSessionStringSubmit}>
        <input
          placeholder="Session string"
          value={sessionString}
          onChange={(e) => setSessionString(e.target.value)}
        />
        <button type="submit">Add via session string</button>
      </form>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            {a.phone} — {a.status} {a.telegram_premium ? "(Premium)" : ""}
            <button onClick={() => handleDelete(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Accounts.tsx frontend/src/pages/Accounts.test.tsx
git commit -m "feat: accounts page (list + add via session string + delete)"
```

---

## Task 18: Targets Page

**Files:**
- Create: `frontend/src/pages/Targets.tsx`
- Test: `frontend/src/pages/Targets.test.tsx`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiDelete` (Task 15); backend `GET/POST/DELETE /api/targets...` (Task 10).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Targets.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Targets from "./Targets";
import * as api from "../api";

describe("Targets page", () => {
  it("renders targets fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, account_id: 1, telegram_chat_id: "-100", type: "channel", title: "My Channel", active: true },
    ]);
    render(<Targets />);
    await waitFor(() => {
      expect(screen.getByText("My Channel")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Targets'`)

- [ ] **Step 3: Write `frontend/src/pages/Targets.tsx`**

```tsx
import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Target = {
  id: number;
  account_id: number;
  telegram_chat_id: string;
  type: string;
  title: string;
  active: boolean;
};

export default function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [accountId, setAccountId] = useState("");
  const [chatId, setChatId] = useState("");
  const [type, setType] = useState("channel");
  const [title, setTitle] = useState("");

  async function refresh() {
    setTargets(await apiGet<Target[]>("/api/targets"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiPost("/api/targets", {
      account_id: Number(accountId), telegram_chat_id: chatId, type, title,
    });
    setChatId("");
    setTitle("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/targets/${id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Targets</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Account ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        <input placeholder="Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="channel">channel</option>
          <option value="group">group</option>
        </select>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Add target</button>
      </form>
      <ul>
        {targets.map((t) => (
          <li key={t.id}>
            {t.title} ({t.type}) — {t.active ? "active" : "inactive"}
            <button onClick={() => handleDelete(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Targets.tsx frontend/src/pages/Targets.test.tsx
git commit -m "feat: targets page (list + add + delete)"
```

---

## Task 19: Templates Page

**Files:**
- Create: `frontend/src/pages/Templates.tsx`
- Test: `frontend/src/pages/Templates.test.tsx`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiDelete` (Task 15); backend `GET/POST/DELETE /api/templates...` (Task 11).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Templates.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Templates from "./Templates";
import * as api from "../api";

describe("Templates page", () => {
  it("renders templates fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, body: "Hello world", is_override: false, target_id: null },
    ]);
    render(<Templates />);
    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Templates'`)

- [ ] **Step 3: Write `frontend/src/pages/Templates.tsx`**

```tsx
import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Template = {
  id: number;
  body: string;
  is_override: boolean;
  target_id: number | null;
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState("");

  async function refresh() {
    setTemplates(await apiGet<Template[]>("/api/templates"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedTargetId = targetId ? Number(targetId) : null;
    await apiPost("/api/templates", {
      body, is_override: parsedTargetId !== null, target_id: parsedTargetId,
    });
    setBody("");
    setTargetId("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/templates/${id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Templates</h1>
      <form onSubmit={handleSubmit}>
        <textarea placeholder="Message body (HTML)" value={body} onChange={(e) => setBody(e.target.value)} />
        <input
          placeholder="Target ID (leave empty = shared)"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        />
        <button type="submit">Add template</button>
      </form>
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.body} {t.target_id !== null ? `(override for target ${t.target_id})` : "(shared)"}
            <button onClick={() => handleDelete(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Templates.tsx frontend/src/pages/Templates.test.tsx
git commit -m "feat: content templates page"
```

---

## Task 20: Schedules Page

**Files:**
- Create: `frontend/src/pages/Schedules.tsx`
- Test: `frontend/src/pages/Schedules.test.tsx`

**Interfaces:**
- Consumes: `apiGet`, `apiPut`, `apiDelete` (Task 15); backend `GET /api/schedules`, `PUT/DELETE /api/schedules/{target_id}` (Task 12).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Schedules.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Schedules from "./Schedules";
import * as api from "../api";

describe("Schedules page", () => {
  it("renders schedule configs fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, target_id: 1, messages_per_day: 3, window_start: "08:00", window_end: "22:00", min_gap_minutes: 30 },
    ]);
    render(<Schedules />);
    await waitFor(() => {
      expect(screen.getByText(/target 1/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Schedules'`)

- [ ] **Step 3: Write `frontend/src/pages/Schedules.tsx`**

```tsx
import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPut, apiDelete } from "../api";

type ScheduleConfig = {
  id: number;
  target_id: number;
  messages_per_day: number;
  window_start: string;
  window_end: string;
  min_gap_minutes: number;
};

export default function Schedules() {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [targetId, setTargetId] = useState("");
  const [messagesPerDay, setMessagesPerDay] = useState("3");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [minGap, setMinGap] = useState("30");

  async function refresh() {
    setSchedules(await apiGet<ScheduleConfig[]>("/api/schedules"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = Number(targetId);
    await apiPut(`/api/schedules/${id}`, {
      target_id: id,
      messages_per_day: Number(messagesPerDay),
      window_start: windowStart,
      window_end: windowEnd,
      min_gap_minutes: Number(minGap),
    });
    await refresh();
  }

  async function handleDelete(target_id: number) {
    await apiDelete(`/api/schedules/${target_id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Schedules</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <input placeholder="Messages/day" value={messagesPerDay} onChange={(e) => setMessagesPerDay(e.target.value)} />
        <input placeholder="Window start (HH:MM)" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
        <input placeholder="Window end (HH:MM)" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
        <input placeholder="Min gap (minutes)" value={minGap} onChange={(e) => setMinGap(e.target.value)} />
        <button type="submit">Save schedule</button>
      </form>
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            target {s.target_id}: {s.messages_per_day}/day, {s.window_start}-{s.window_end}, gap {s.min_gap_minutes}m
            <button onClick={() => handleDelete(s.target_id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Schedules.tsx frontend/src/pages/Schedules.test.tsx
git commit -m "feat: schedule config page"
```

---

## Task 21: Logs / Stats Page

**Files:**
- Create: `frontend/src/pages/Logs.tsx`
- Test: `frontend/src/pages/Logs.test.tsx`

**Interfaces:**
- Consumes: `apiGet` (Task 15); backend `GET /api/logs`, `GET /api/logs/stats` (Task 13).

- [ ] **Step 1: Write the failing test** — `frontend/src/pages/Logs.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Logs from "./Logs";
import * as api from "../api";

describe("Logs page", () => {
  it("renders send logs fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockImplementation(async (path: string) => {
      if (path === "/api/logs") {
        return [
          {
            id: 1, target_id: 1, template_id: 1,
            sent_at: "2026-09-10T08:00:00Z", status: "success", error_message: null,
          },
        ] as any;
      }
      return { "1": { success: 1 } } as any;
    });
    render(<Logs />);
    await waitFor(() => {
      expect(screen.getByText(/success/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL (`Cannot find module './Logs'`)

- [ ] **Step 3: Write `frontend/src/pages/Logs.tsx`**

```tsx
import { useEffect, useState } from "react";
import { apiGet } from "../api";

type SendLog = {
  id: number;
  target_id: number;
  template_id: number | null;
  sent_at: string;
  status: string;
  error_message: string | null;
};

type Stats = Record<string, Record<string, number>>;

export default function Logs() {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    apiGet<SendLog[]>("/api/logs").then(setLogs);
    apiGet<Stats>("/api/logs/stats").then(setStats);
  }, []);

  return (
    <div>
      <h1>Logs & Stats</h1>
      <table>
        <thead>
          <tr>
            <th>Target</th>
            <th>Sent at</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.target_id}</td>
              <td>{l.sent_at}</td>
              <td>{l.status}</td>
              <td>{l.error_message ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Stats by target</h2>
      <ul>
        {Object.entries(stats).map(([targetId, counts]) => (
          <li key={targetId}>
            target {targetId}: {Object.entries(counts).map(([s, c]) => `${s}=${c}`).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Logs.tsx frontend/src/pages/Logs.test.tsx
git commit -m "feat: logs and stats page"
```

---

## Task 22: Premium Emoji Entity Support

**Files:**
- Create: `backend/app/premium_emoji.py`
- Modify: `backend/app/scheduler.py`
- Test: `backend/tests/test_premium_emoji.py`
- Modify: `backend/tests/test_scheduler.py`

**Interfaces:**
- Consumes: `app.models.Account` (Task 1); `app.scheduler.send_job` (Task 14).
- Produces: `app.premium_emoji.build_message_with_entities(body: str, is_premium: bool) -> tuple[str, list[MessageEntityCustomEmoji]]`. Template bodies may contain `[emoji:<document_id>]<fallback char>[/emoji]` markup; premium accounts get a real custom-emoji entity, non-premium accounts get the plain fallback character with no entity (never an error).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_premium_emoji.py`

```python
from app.premium_emoji import build_message_with_entities


def test_premium_account_gets_custom_emoji_entity():
    text, entities = build_message_with_entities("Hi [emoji:123]\U0001F525[/emoji] there", is_premium=True)
    assert text == "Hi \U0001F525 there"
    assert len(entities) == 1
    assert entities[0].document_id == 123


def test_non_premium_account_gets_plain_fallback_no_entity():
    text, entities = build_message_with_entities("Hi [emoji:123]\U0001F525[/emoji] there", is_premium=False)
    assert text == "Hi \U0001F525 there"
    assert entities == []


def test_no_markup_passthrough():
    text, entities = build_message_with_entities("plain text", is_premium=True)
    assert text == "plain text"
    assert entities == []


def test_multiple_markups():
    text, entities = build_message_with_entities(
        "[emoji:1]A[/emoji] mid [emoji:2]B[/emoji]", is_premium=True
    )
    assert text == "A mid B"
    assert [e.document_id for e in entities] == [1, 2]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_premium_emoji.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.premium_emoji'`)

- [ ] **Step 3: Write `backend/app/premium_emoji.py`**

```python
import re
from telethon.tl.types import MessageEntityCustomEmoji

CUSTOM_EMOJI_PATTERN = re.compile(r"\[emoji:(\d+)\](.+?)\[/emoji\]")


def build_message_with_entities(body: str, is_premium: bool) -> tuple[str, list]:
    entities = []
    result = []
    cursor = 0
    offset = 0
    for match in CUSTOM_EMOJI_PATTERN.finditer(body):
        plain_before = body[cursor:match.start()]
        result.append(plain_before)
        offset += len(plain_before.encode("utf-16-le")) // 2

        document_id, fallback = match.group(1), match.group(2)
        result.append(fallback)
        length = len(fallback.encode("utf-16-le")) // 2
        if is_premium:
            entities.append(
                MessageEntityCustomEmoji(offset=offset, length=length, document_id=int(document_id))
            )
        offset += length
        cursor = match.end()

    result.append(body[cursor:])
    return "".join(result), entities
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_premium_emoji.py -v`
Expected: PASS

- [ ] **Step 5: Modify `backend/app/scheduler.py`** — fetch the account before sending, and send resolved text + entities instead of raw `template.body`

```python
from app.premium_emoji import build_message_with_entities
```

Replace the body of the inner `try` block in `send_job` (the part building and sending the message) with:

```python
        try:
            account = db.get(Account, target.account_id)
            client = manager.get_client(target.account_id)
            text, entities = build_message_with_entities(
                template.body, bool(account and account.telegram_premium)
            )
            await client.send_message(target.telegram_chat_id, text, formatting_entities=entities or None)
            db.add(SendLog(target_id=target_id, template_id=template.id, status="success"))
```

(Everything after this — the `except FloodWaitError` block onward — stays as written in Task 14; only the two lines building/sending the message and the `account = db.get(...)` line inside the `UserDeactivatedBanError` branch change, since `account` is now already fetched above — remove the duplicate `account = db.get(Account, target.account_id)` from that except branch and just reuse `account`.)

- [ ] **Step 6: Modify `backend/tests/test_scheduler.py`** — update `test_send_job_success_writes_log` to cover emoji markup

```python
    db.add(ContentTemplate(id=1, body="hello [emoji:99]\U0001F525[/emoji]", is_override=False, target_id=None))
```

(Replace the existing plain `"hello"` template body with this markup version so the test exercises the new code path; the assertions on `SendLog.status == "success"` and `fake_client.send_message.assert_awaited_once()` stay unchanged.)

- [ ] **Step 7: Run full backend suite**

Run: `cd backend && pytest -v`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/premium_emoji.py backend/app/scheduler.py backend/tests/test_premium_emoji.py backend/tests/test_scheduler.py
git commit -m "feat: premium custom-emoji entity support with plain-emoji fallback"
```

---

## Task 23: End-to-End Manual Verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run full backend suite**

Run: `cd backend && pytest -v`
Expected: All PASS

- [ ] **Step 2: Run full frontend suite**

Run: `cd frontend && npm test`
Expected: All PASS

- [ ] **Step 3: Boot backend locally**

```bash
cd backend
cp .env.example .env   # fill in TELEGRAM_API_ID/HASH, generate SESSION_ENCRYPTION_KEY (Fernet.generate_key()) and JWT_SECRET_KEY, set ADMIN_PASSWORD_HASH (bcrypt hash)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- [ ] **Step 4: Boot frontend locally**

```bash
cd frontend
npm install
npm run dev
```

- [ ] **Step 5: Manual walkthrough**

1. Login vào dashboard bằng admin credentials.
2. Add 1 Telegram account thật qua session string (account phải admin của 1 group/channel test riêng).
3. Add target trỏ tới group/channel test đó.
4. Add 1 shared template.
5. Set schedule: `messages_per_day=2`, window rút ngắn vài phút tới (test mode thủ công) để xác nhận tin gửi đúng giờ, đúng nội dung.
6. Kiểm tra Logs page: log ghi đúng `success`, thời gian đúng.
7. Kiểm tra Stats: đếm đúng số lượt gửi.
8. Nếu account có Telegram Premium: thử template chứa `[emoji:<document_id>]<fallback>[/emoji]`, xác nhận emoji custom hiển thị đúng trong Telegram; với account không Premium, xác nhận fallback về emoji thường, không lỗi.

- [ ] **Step 6: Commit** (only if any fixups were needed during manual verification)

```bash
git add -A
git commit -m "fix: address issues found during manual end-to-end verification"
```
