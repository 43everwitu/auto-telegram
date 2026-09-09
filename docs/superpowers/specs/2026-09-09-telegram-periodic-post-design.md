# Telegram Periodic Post Dashboard — Design

## Scope

Tool tự động đăng tin nhắn định kỳ tới **channel/group mà Telegram user account có quyền admin/owner**. Không hỗ trợ đăng vào channel/group mà account không quản trị (loại trừ rõ ràng — tránh hành vi automated unsolicited messaging).

## Requirements

- Dashboard quản lý: user (Telegram account), tin nhắn (template), số lượt đăng, thời gian đăng, target (channel/group).
- Tuỳ chọn x tin/24h mỗi target, giờ đăng random trong khung cho phép (tránh trùng giờ liền nhau).
- Nội dung thay đổi theo target: template chung + override riêng theo target.
- Hỗ trợ custom emoji (Telegram Premium) khi account có Premium.
- Quản lý nhiều Telegram account (2-10), mỗi account nhiều target.

## Architecture

```
┌─────────────────────────────────────────────┐
│  FastAPI app (1 process, async)              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ REST API     │  │ APScheduler          │  │
│  │ (dashboard   │  │ (SQLAlchemy jobstore  │  │
│  │  backend)    │  │  → SQLite)            │  │
│  └─────────────┘  └──────────────────────┘  │
│         │                    │                │
│         ▼                    ▼                │
│  ┌───────────────────────────────────────┐  │
│  │ Telegram Account Manager               │  │
│  │ (pool of Telethon clients, 1/account)  │  │
│  └───────────────────────────────────────┘  │
│         │                                     │
│         ▼                                     │
│  SQLite DB (accounts, targets, templates,     │
│  jobs, send logs)                             │
└─────────────────────────────────────────────┘
         │
         ▼
   React dashboard (SPA, gọi REST API)
```

**Stack**: Python (FastAPI + Telethon) backend, React dashboard, APScheduler (SQLAlchemy jobstore) cho lịch, SQLite cho DB, chạy local/VPS đơn giản (không Docker/Celery/Redis).

**Components**:
- Telegram Account Manager: quản lý session Telethon cho từng account, login qua OTP hoặc nhập session string có sẵn.
- Scheduler service: sinh job random giờ trong ngày theo config mỗi target.
- Content resolver: chọn nội dung gửi (override target > pool chung).
- REST API + React dashboard: CRUD account/target/template, xem lịch, log, thống kê.
- Auth dashboard: 1 admin duy nhất, username/password.

## Data Model

```
Account
  id, phone, session_string (encrypted, Fernet), telegram_premium: bool,
  status (active/banned/needs_login)

Target (channel hoặc group)
  id, account_id (FK), telegram_chat_id, type (channel/group), title, active: bool

ContentTemplate
  id, body (HTML + custom emoji entity nếu premium), is_override: bool,
  target_id (FK, null nếu template chung)

ScheduleConfig
  id, target_id (FK), messages_per_day (x), window_start, window_end, min_gap_minutes

SendLog
  id, target_id, template_id, sent_at, status (success/failed), error_message
```

## Scheduling Logic

1. Cron 00:05 mỗi ngày: với mỗi target active, đọc `ScheduleConfig` → sinh x thời điểm random trong window (reject-resample nếu vi phạm min-gap) → tạo x APScheduler job persist SQLite.
2. Mỗi job trigger → content resolver chọn template → gửi qua Telethon client của account sở hữu target → ghi `SendLog`.
3. Job lỗi → log, retry 1 lần sau 5 phút, không dồn bù ngày sau.

## Premium Emoji

- Chỉ dùng custom emoji entity nếu `Account.telegram_premium = true` (check qua `client.get_me().premium`).
- Account không Premium mà template chứa custom emoji → tự động fallback gửi emoji thường, không lỗi.

## Account Login Flow

Hai cách thêm account:
1. **OTP flow**: nhập phone → `send_code_request()` → nhập OTP (+ mật khẩu 2FA nếu có) → `sign_in()` → lưu `session_string` mã hoá.
2. **Session string có sẵn**: paste session string → validate bằng `client.connect()` + `get_me()` → lưu nếu hợp lệ.

## Error Handling

- `FloodWaitError` → tự pause account đúng số giây yêu cầu, reschedule sau khi hết wait, không tính lỗi job.
- Account bị kick / mất quyền admin khỏi target → `Target.active=false`, cảnh báo dashboard, không tự retry.
- Account bị khoá (`AuthKeyUnregisteredError`...) → `Account.status=banned`, dừng toàn bộ job account đó, cảnh báo dashboard.
- Lỗi khác → `SendLog.status=failed` + `error_message`, retry 1 lần sau 5 phút rồi bỏ qua.

## Testing Plan

- Unit test: content resolver, schedule generator (đúng số lượng/window/min-gap), emoji fallback.
- Integration test: mock hoặc test account thật — full flow login → add target → schedule → send → log.
- Manual verify trước khi coi done: 1 account + 1 group/channel test riêng, test mode rút ngắn window xuống phút, xác nhận tin gửi đúng giờ/nội dung/log/thống kê dashboard.
