# Telegram Autopost

A dashboard for scheduling recurring posts to Telegram groups/channels (including groups with Topics), using a real Telegram user account via Telethon — not a bot.

**Vietnamese version: [README.md](README.md)**

## Features

- **Accounts** — log in a Telegram account via phone + OTP (2FA supported), or paste an existing session string.
- **Targets** — add a group/channel by pasting a link (t.me, @username, or a web.telegram.org link) and clicking "Look up" to auto-resolve the Chat ID, type (channel/group), and Topic ID (if the group has Topics enabled). Toggle each target on/off.
- **Templates** — write message bodies (HTML supported: `<b>`, `<i>`, `<a>`, `<code>`...), with a live Telegram-style chat-bubble preview. You can **import a template directly from an already-sent Telegram message** (paste the message link) to keep its Premium custom-emoji icons — plain copy-paste loses them.
- **Assigning templates to targets** — a target can use multiple templates (picked at random on each send), and a template can be reused across multiple targets.
- **Schedules** — set messages/day, a time window, and a minimum gap between sends; the app randomizes today's send times deterministically (stable across restarts — no more sends than configured). A "Send test message" button fires immediately, and a Running/Paused toggle pauses sending for a target without deleting its schedule.
- **Logs** — per-send history (success/failure + reason) and per-target stats.
- The UI ships in **Vietnamese and English** (flag toggle in the nav bar), defaulting to Vietnamese.

## Architecture

- **Backend**: Python, FastAPI + SQLAlchemy (SQLite) + APScheduler (send scheduling) + Telethon (real-account Telegram connection).
- **Frontend**: React + TypeScript + Vite, no external UI framework (hand-written design system in `frontend/src/index.css`).
- **Auth**: single admin account (JWT), no multi-user support.

## Setup

### 1. Get a Telegram API ID/Hash

Go to https://my.telegram.org → "API development tools" → create an app → copy `api_id` and `api_hash`. This identifies the **application**, not the Telegram account(s) that will post — every account logged into the dashboard shares this same API ID/Hash pair.

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `backend/.env`:

```bash
TELEGRAM_API_ID=...          # from my.telegram.org
TELEGRAM_API_HASH=...        # from my.telegram.org
SESSION_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
JWT_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...      # see command below
DATABASE_URL=sqlite:///./app.db
```

Generate `ADMIN_PASSWORD_HASH` from the admin password you want to use:

```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt()).decode())"
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` if the frontend and backend aren't on the same origin (by default the frontend calls the API on the same origin via `/api`, see the `server.proxy` block in `vite.config.ts`):

```bash
VITE_API_BASE=
```

Run it:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` by default, the backend on `http://localhost:8000`.

### 4. Running in production with PM2 (optional)

The repo ships an `ecosystem.config.js` that runs the backend (uvicorn, port 8010) and frontend (vite dev server, port 5173):

```bash
pm2 start ecosystem.config.js
```

## Usage guide

1. **Log in** with `ADMIN_USERNAME` and the password you hashed during setup.
2. **Accounts** → "Login with phone" tab → enter the phone number → enter the OTP code Telegram sends (+ the 2FA password if the account has one set).
3. **Targets** → pick the account you just added → paste the group/channel link (that account must already be a **member**) → click "Look up" → Chat ID/type/Topic ID auto-fill → click "Add target".
4. Still on **Targets**, click "Manage templates" on that target → write a new message and attach it, or attach an existing template. Attach more than one template to the same target to rotate between them at random.
   - To keep Premium emoji icons intact: go to the **Templates** page and use the "Import from a Telegram message" box — paste the original message link and pick an account that's a member of that chat.
5. **Schedules** → pick the target, messages/day, time window, minimum gap → Save. Click "Send test message" to verify immediately without waiting for the schedule.
6. To pause a target without deleting its configuration: click the **Running/Paused** toggle (on either Targets or Schedules).
7. **Logs** → review send history and failure reasons, e.g. `TOPIC_CLOSED` when a target is missing the correct Topic ID.

### Note on groups with Topics

If a group has Topics enabled and its default ("General") topic is locked, sending fails with `TOPIC_CLOSED` unless the target has the correct Topic ID set. To get it: open that topic on web.telegram.org, copy the link in the form `https://web.telegram.org/a/#-100xxxxxxxxxx_yyyyyy`, and paste it into the "Look up" field on Targets — the Topic ID fills in automatically.

## Running tests

```bash
# Backend
cd backend && source venv/bin/activate && pytest

# Frontend
cd frontend && npm run test
```
