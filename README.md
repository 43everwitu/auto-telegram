# Telegram Autopost

Dashboard tự động đăng tin nhắn định kỳ lên Telegram (nhóm/kênh, kể cả nhóm có Topics), dùng tài khoản Telegram thật (user account qua Telethon, không phải bot).

**English version: [README.en.md](README.en.md)**

## Tính năng

- **Accounts** — đăng nhập tài khoản Telegram bằng số điện thoại + OTP (có hỗ trợ 2FA), hoặc dán session string có sẵn.
- **Targets** — thêm nhóm/kênh bằng cách dán link (t.me, @username, hoặc link web.telegram.org) rồi "Tra cứu" để tự lấy đúng Chat ID, loại (channel/group), và Topic ID (nếu nhóm có bật Topics). Bật/tắt từng target bằng toggle.
- **Templates** — soạn mẫu tin nhắn (hỗ trợ HTML: `<b>`, `<i>`, `<a>`, `<code>`...), xem trước kiểu bong bóng chat Telegram. Có thể **nhập mẫu tin trực tiếp từ 1 tin nhắn Telegram đã gửi** (dán link tin nhắn) để giữ đúng icon emoji Premium — copy-paste thường sẽ làm mất icon này.
- **Gán template cho target** — 1 target có thể dùng nhiều template (xoay vòng ngẫu nhiên mỗi lần gửi), 1 template có thể dùng cho nhiều target.
- **Schedules** — đặt số tin/ngày, khung giờ, khoảng cách tối thiểu giữa các tin; hệ thống tự random giờ gửi trong ngày (ổn định, không gửi dư khi restart). Có nút "Gửi thử" để test ngay, và toggle Bật/Tắt để tạm dừng gửi cho 1 target mà không cần xoá lịch.
- **Logs** — nhật ký từng lần gửi (thành công/thất bại + lý do) và thống kê theo target.
- Giao diện có 2 ngôn ngữ **Việt/Anh** (nút cờ trên thanh điều hướng), mặc định Tiếng Việt.

## Kiến trúc

- **Backend**: Python, FastAPI + SQLAlchemy (SQLite) + APScheduler (lên lịch gửi) + Telethon (kết nối Telegram bằng tài khoản thật).
- **Frontend**: React + TypeScript + Vite, không dùng UI framework ngoài (tự viết design system trong `frontend/src/index.css`).
- **Auth**: 1 tài khoản admin (JWT), không có đăng ký nhiều người dùng.

## Cài đặt

### 1. Lấy Telegram API ID/Hash

Vào https://my.telegram.org → "API development tools" → tạo app → lấy `api_id` và `api_hash`. Đây là thông tin của **ứng dụng**, không phải của tài khoản Telegram sẽ đăng bài — mọi tài khoản đăng nhập vào dashboard đều dùng chung 1 cặp API ID/Hash này.

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Điền `backend/.env`:

```bash
TELEGRAM_API_ID=...          # từ my.telegram.org
TELEGRAM_API_HASH=...        # từ my.telegram.org
SESSION_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
JWT_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...      # xem lệnh bên dưới
DATABASE_URL=sqlite:///./app.db
```

Tạo `ADMIN_PASSWORD_HASH` từ mật khẩu admin bạn muốn dùng:

```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'MAT_KHAU_CUA_BAN', bcrypt.gensalt()).decode())"
```

Chạy thử:

```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Tạo `frontend/.env` nếu frontend và backend không cùng domain/port (mặc định frontend gọi API cùng origin qua `/api`, xem `vite.config.ts` phần `server.proxy`):

```bash
VITE_API_BASE=
```

Chạy thử:

```bash
npm run dev
```

Mặc định frontend chạy ở `http://localhost:5173`, backend ở `http://localhost:8000`.

### 4. Chạy production bằng PM2 (tuỳ chọn)

Repo có sẵn `ecosystem.config.js` chạy backend (uvicorn, port 8010) và frontend (vite dev server, port 5173):

```bash
pm2 start ecosystem.config.js
```

## Hướng dẫn sử dụng

1. **Đăng nhập** bằng `ADMIN_USERNAME` / mật khẩu bạn đã hash ở bước cài đặt.
2. **Accounts** → chọn tab "Đăng nhập bằng SĐT" → nhập số điện thoại → nhập mã OTP Telegram gửi về (+ mật khẩu 2FA nếu tài khoản có bật).
3. **Targets** → chọn account vừa thêm → dán link nhóm/kênh (account đó phải **đã là thành viên**) → bấm "Tra cứu" → Chat ID/loại/Topic ID tự điền → bấm "Thêm mục tiêu".
4. Vẫn ở **Targets**, bấm "Quản lý mẫu tin" trên target đó → viết tin nhắn mới và gán luôn, hoặc gán 1 template có sẵn. Gán nhiều template cho cùng 1 target để xoay vòng ngẫu nhiên.
   - Muốn giữ đúng icon Premium: qua trang **Templates**, dùng khung "Nhập từ tin nhắn Telegram" — dán link tin nhắn gốc, chọn account đã tham gia chat đó.
5. **Schedules** → chọn target, số tin/ngày, khung giờ, khoảng cách tối thiểu → Lưu. Bấm "Gửi thử" để kiểm tra ngay không cần chờ lịch.
6. Muốn tạm dừng 1 target mà không xoá cấu hình: bấm toggle **Đang chạy/Đã tắt** (ở Targets hoặc Schedules).
7. **Logs** → theo dõi lịch sử gửi và lý do lỗi (nếu có), vd `TOPIC_CLOSED` khi target chưa điền đúng Topic ID.

### Lưu ý về nhóm có Topics

Nếu nhóm bật tính năng Topics (chủ đề) và topic mặc định ("Chung") bị khoá, gửi tin sẽ lỗi `TOPIC_CLOSED` trừ khi target có Topic ID đúng. Cách lấy: mở topic đó trên web.telegram.org, copy link dạng `https://web.telegram.org/a/#-100xxxxxxxxxx_yyyyyy` rồi dán vào ô "Tra cứu" ở Targets — Topic ID tự điền.

## Chạy test

```bash
# Backend
cd backend && source venv/bin/activate && pytest

# Frontend
cd frontend && npm run test
```
