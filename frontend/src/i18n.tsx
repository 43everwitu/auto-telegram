import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type Lang = "vi" | "en";

const STORAGE_KEY = "lang";

const dict = {
  // Nav / layout
  "nav.brand": { vi: "Telegram Tự Đăng", en: "Telegram Autopost" },
  "nav.accounts": { vi: "Tài khoản", en: "Accounts" },
  "nav.targets": { vi: "Mục tiêu", en: "Targets" },
  "nav.templates": { vi: "Mẫu tin nhắn", en: "Templates" },
  "nav.schedules": { vi: "Lịch gửi", en: "Schedules" },
  "nav.logs": { vi: "Nhật ký", en: "Logs" },
  "nav.logout": { vi: "Đăng xuất", en: "Logout" },

  // Login
  "login.username": { vi: "Tên đăng nhập", en: "Username" },
  "login.password": { vi: "Mật khẩu", en: "Password" },
  "login.submit": { vi: "Đăng nhập", en: "Login" },
  "login.error": { vi: "Sai tài khoản hoặc mật khẩu", en: "Invalid username or password" },

  // Accounts
  "accounts.title": { vi: "Tài khoản", en: "Accounts" },
  "accounts.tab.phone": { vi: "Đăng nhập bằng SĐT", en: "Login with phone" },
  "accounts.tab.session": { vi: "Chuỗi phiên (session string)", en: "Session string" },
  "accounts.phone.hint": { vi: "Nhập số điện thoại Telegram để nhận mã đăng nhập.", en: "Enter the Telegram phone number to receive a login code." },
  "accounts.phone.label": { vi: "Số điện thoại", en: "Phone number" },
  "accounts.phone.send": { vi: "Gửi mã", en: "Send code" },
  "accounts.code.hint": { vi: "Đã gửi mã tới {{phone}}. Nhập mã bên dưới.", en: "Code sent to {{phone}}. Enter it below." },
  "accounts.code.label": { vi: "Mã đăng nhập", en: "Login code" },
  "accounts.twofa.label": { vi: "Mật khẩu 2FA (nếu có bật)", en: "2FA password (only if enabled)" },
  "accounts.twofa.optional": { vi: "Không bắt buộc", en: "Optional" },
  "accounts.confirm": { vi: "Xác nhận & đăng nhập", en: "Confirm & login" },
  "accounts.back": { vi: "Quay lại", en: "Back" },
  "accounts.session.hint": { vi: "Nâng cao: dán chuỗi phiên Telethon tạo sẵn ở nơi khác, thay vì đăng nhập bằng số điện thoại ở trên.", en: "Advanced: paste a Telethon session string generated elsewhere, instead of logging in with a phone number above." },
  "accounts.session.placeholder": { vi: "Chuỗi phiên", en: "Session string" },
  "accounts.session.submit": { vi: "Thêm bằng chuỗi phiên", en: "Add via session string" },
  "accounts.premium": { vi: "Premium", en: "Premium" },
  "accounts.delete": { vi: "Xoá", en: "Delete" },
  "accounts.err.sendCode": { vi: "Gửi mã thất bại", en: "Failed to send code" },
  "accounts.err.confirm": { vi: "Xác nhận mã thất bại", en: "Failed to confirm code" },
  "accounts.err.add": { vi: "Thêm tài khoản thất bại", en: "Failed to add account" },
  "accounts.err.delete": { vi: "Xoá tài khoản thất bại", en: "Failed to delete account" },

  // Targets
  "targets.title": { vi: "Mục tiêu", en: "Targets" },
  "targets.form.account": { vi: "Tài khoản", en: "Account" },
  "targets.form.accountPlaceholder": { vi: "Chọn tài khoản…", en: "Select account…" },
  "targets.lookup.hint": { vi: "Dán link t.me, @username, hoặc link web.telegram.org copy từ trình duyệt (vd https://web.telegram.org/a/#-1001715471462), rồi tra cứu — tài khoản trên phải đã tham gia. Chat ID và loại sẽ tự điền.", en: "Paste a t.me link, @username, or a web.telegram.org URL copied from your browser (e.g. https://web.telegram.org/a/#-1001715471462), then look it up — the account above must already be a member. Chat ID and type fill in automatically." },
  "targets.lookup.placeholder": { vi: "https://t.me/kenhcuaban, @username, hoặc link web.telegram.org", en: "https://t.me/yourchannel, @username, or web.telegram.org link" },
  "targets.lookup.button": { vi: "Tra cứu", en: "Look up" },
  "targets.lookup.loading": { vi: "Đang tra cứu…", en: "Looking up…" },
  "targets.form.chatId": { vi: "Chat ID (tự điền khi Tra cứu)", en: "Chat ID (auto-filled by Look up)" },
  "targets.form.type.channel": { vi: "kênh (channel)", en: "channel" },
  "targets.form.type.group": { vi: "nhóm (group)", en: "group" },
  "targets.form.title": { vi: "Tên hiển thị", en: "Title" },
  "targets.form.topicId": { vi: "Topic ID (nếu nhóm có bật Topics)", en: "Topic ID (if the group has Topics)" },
  "targets.form.topicHint": { vi: "Nhóm có Topics: gửi vào topic \"Chung\" mặc định có thể bị lỗi TOPIC_CLOSED. Dán link topic dạng web.telegram.org/a/#-100xxxx_yyyy vào ô Tra cứu ở trên để tự điền, hoặc nhập tay số topic ID.", en: "Groups with Topics: sending to the default \"General\" topic can fail with TOPIC_CLOSED. Paste a web.telegram.org/a/#-100xxxx_yyyy topic link into Look up above to auto-fill this, or enter the topic ID manually." },
  "targets.topic": { vi: "topic #{{id}}", en: "topic #{{id}}" },
  "targets.form.add": { vi: "Thêm mục tiêu", en: "Add target" },
  "targets.form.save": { vi: "Lưu thay đổi", en: "Save changes" },
  "targets.editing": { vi: "Đang sửa mục tiêu #{{id}}.", en: "Editing target #{{id}}." },
  "targets.cancelEdit": { vi: "Huỷ sửa", en: "Cancel edit" },
  "targets.edit": { vi: "Sửa", en: "Edit" },
  "targets.delete": { vi: "Xoá", en: "Delete" },
  "targets.active": { vi: "đang bật", en: "active" },
  "targets.inactive": { vi: "đang tắt", en: "inactive" },
  "targets.hint.mainBefore": { vi: "Mẫu tin nhắn (sửa nội dung ở trang", en: "A template (edit the text on" },
  "targets.hint.mainAfter": { vi: ") không tự làm gì cả cho tới khi bạn gán nó vào 1 mục tiêu bên dưới. Gán nhiều hơn 1 mẫu cho 1 mục tiêu để nó chọn ngẫu nhiên mỗi lần gửi; 1 mẫu có thể gán cho nhiều mục tiêu.", en: ") does nothing until you assign it to a target below. Assign more than one to a target and it picks one at random each send; the same template can be assigned to several targets." },
  "targets.manage": { vi: "Quản lý mẫu tin", en: "Manage templates" },
  "targets.hide": { vi: "Ẩn mẫu tin", en: "Hide templates" },
  "targets.account": { vi: "Tài khoản", en: "Account" },
  "targets.templateCountOne": { vi: "{{count}} mẫu tin", en: "{{count}} template" },
  "targets.templateCountOther": { vi: "{{count}} mẫu tin", en: "{{count}} templates" },
  "targets.noTemplate": { vi: "Chưa gán mẫu tin nào cho mục tiêu này — sẽ không gửi được gì cho tới khi bạn gán hoặc tạo mẫu bên dưới.", en: "No template assigned to this target yet — it won't send anything until you attach or create one below." },
  "targets.removeFromTarget": { vi: "Gỡ khỏi mục tiêu", en: "Remove from target" },
  "targets.attachPlaceholder": { vi: "Gán 1 mẫu tin có sẵn…", en: "Attach an existing template…" },
  "targets.attach": { vi: "Gán", en: "Attach" },
  "targets.createPlaceholder": { vi: "Hoặc viết mẫu tin mới rồi gán luôn cho mục tiêu này (HTML)", en: "Or write a new message and attach it to this target (HTML)" },
  "targets.createAndAttach": { vi: "Tạo & gán", en: "Create & attach" },
  "targets.removeHintBefore": { vi: "\"Gỡ khỏi mục tiêu\" chỉ bỏ gán ở đây — mẫu tin vẫn còn, có thể gán lại, sửa, hoặc xoá ở trang", en: "\"Remove from target\" only unassigns it here — the template itself still exists and can be reattached, edited, or deleted from" },
  "targets.removeHintAfter": { vi: ".", en: "." },
  "targets.err.lookupMissing": { vi: "Chọn tài khoản và dán link trước đã", en: "Choose an account and paste a link first" },
  "targets.err.lookup": { vi: "Tra cứu thất bại", en: "Failed to resolve link" },
  "targets.err.save": { vi: "Lưu mục tiêu thất bại", en: "Failed to save target" },
  "targets.err.delete": { vi: "Xoá mục tiêu thất bại", en: "Failed to delete target" },
  "targets.err.createTemplate": { vi: "Tạo mẫu tin thất bại", en: "Failed to create template" },
  "targets.err.unassign": { vi: "Gỡ mẫu tin khỏi mục tiêu thất bại", en: "Failed to remove template from target" },
  "targets.err.attach": { vi: "Gán mẫu tin thất bại", en: "Failed to attach template" },

  // Templates
  "templates.title": { vi: "Mẫu tin nhắn", en: "Templates" },
  "templates.hintBefore": { vi: "Mẫu tin nhắn chỉ là nội dung tái sử dụng — không gắn với nhóm/kênh nào ở đây. Qua trang", en: "A template is just reusable message text — it isn't tied to any group or channel here. Go to" },
  "templates.hintAfter": { vi: "để chọn mục tiêu nào dùng mẫu nào; gán nhiều hơn 1 mẫu cho 1 mục tiêu sẽ xoay vòng ngẫu nhiên.", en: "to decide which target(s) use which template(s); assign more than one to a target and it rotates between them at random." },
  "templates.placeholder": { vi: "Nội dung tin nhắn (HTML)", en: "Message body (HTML)" },
  "templates.importTitle": { vi: "Nhập từ tin nhắn Telegram (giữ đúng icon Premium)", en: "Import from a Telegram message (keeps Premium icons)" },
  "templates.importHint": { vi: "Copy-paste thường sẽ mất icon emoji Premium (chỉ còn icon thường). Dán link tin nhắn gốc (vd https://t.me/kenh/123) và chọn tài khoản đã tham gia kênh/nhóm đó — hệ thống sẽ lấy đúng icon từ Telegram.", en: "Regular copy-paste loses Premium custom-emoji icons (falls back to plain ones). Paste the original message link (e.g. https://t.me/channel/123) and pick an account that's a member of that chat — the exact icons get pulled from Telegram." },
  "templates.importAccount": { vi: "Tài khoản dùng để lấy tin nhắn", en: "Account to fetch the message with" },
  "templates.importLink": { vi: "Link tin nhắn (https://t.me/...)", en: "Message link (https://t.me/...)" },
  "templates.importButton": { vi: "Nhập", en: "Import" },
  "templates.importing": { vi: "Đang nhập…", en: "Importing…" },
  "templates.err.import": { vi: "Nhập tin nhắn thất bại", en: "Failed to import message" },
  "templates.err.importMissing": { vi: "Chọn tài khoản và dán link tin nhắn trước đã", en: "Choose an account and paste a message link first" },
  "templates.preview": { vi: "Xem trước (như trên Telegram)", en: "Preview (as it appears on Telegram)" },
  "templates.add": { vi: "Thêm mẫu tin", en: "Add template" },
  "templates.save": { vi: "Lưu thay đổi", en: "Save changes" },
  "templates.cancel": { vi: "Huỷ", en: "Cancel" },
  "templates.edit": { vi: "Sửa", en: "Edit" },
  "templates.delete": { vi: "Xoá", en: "Delete" },
  "templates.err.save": { vi: "Lưu mẫu tin thất bại", en: "Failed to save template" },
  "templates.err.delete": { vi: "Xoá mẫu tin thất bại", en: "Failed to delete template" },

  // Schedules
  "schedules.title": { vi: "Lịch gửi", en: "Schedules" },
  "schedules.target": { vi: "Mục tiêu", en: "Target" },
  "schedules.targetPlaceholder": { vi: "Chọn mục tiêu…", en: "Select target…" },
  "schedules.perDay": { vi: "Số tin / ngày", en: "Messages / day" },
  "schedules.windowStart": { vi: "Bắt đầu khung giờ", en: "Window start" },
  "schedules.windowEnd": { vi: "Kết thúc khung giờ", en: "Window end" },
  "schedules.minGap": { vi: "Cách nhau tối thiểu (phút)", en: "Min gap (minutes)" },
  "schedules.save": { vi: "Lưu lịch gửi", en: "Save schedule" },
  "schedules.sendTest": { vi: "Gửi thử", en: "Send test message" },
  "schedules.sending": { vi: "Đang gửi…", en: "Sending…" },
  "schedules.testOk": { vi: "Đã gửi tin thử thành công.", en: "Test message sent successfully." },
  "schedules.testFail": { vi: "Gửi thử thất bại: {{error}}", en: "Test send failed: {{error}}" },
  "schedules.unknownError": { vi: "lỗi không rõ", en: "unknown error" },
  "schedules.msgsPerDay": { vi: "{{count}} tin/ngày", en: "{{count}} msgs/day" },
  "schedules.gap": { vi: "cách tối thiểu {{minutes}}p", en: "min gap {{minutes}}m" },
  "schedules.nextSend": { vi: "Gửi tiếp theo: {{time}}", en: "Next send: {{time}}" },
  "schedules.nextSendNone": { vi: "Chưa có lịch gửi tiếp theo", en: "No upcoming send scheduled" },
  "schedules.delete": { vi: "Xoá", en: "Delete" },
  "schedules.edit": { vi: "Sửa", en: "Edit" },
  "schedules.editing": { vi: "Đang sửa lịch gửi cho mục tiêu #{{id}}.", en: "Editing the schedule for target #{{id}}." },
  "schedules.cancelEdit": { vi: "Huỷ sửa", en: "Cancel edit" },
  "schedules.err.save": { vi: "Lưu lịch gửi thất bại", en: "Failed to save schedule" },
  "schedules.err.delete": { vi: "Xoá lịch gửi thất bại", en: "Failed to delete schedule" },

  // Logs
  "logs.title": { vi: "Nhật ký & Thống kê", en: "Logs & Stats" },
  "logs.target": { vi: "Mục tiêu", en: "Target" },
  "logs.sentAt": { vi: "Thời gian gửi", en: "Sent at" },
  "logs.status": { vi: "Trạng thái", en: "Status" },
  "logs.error": { vi: "Lỗi", en: "Error" },
  "logs.statsTitle": { vi: "Thống kê theo mục tiêu", en: "Stats by target" },
  "logs.statsRow": { vi: "mục tiêu {{id}}: {{stats}}", en: "target {{id}}: {{stats}}" },

  // Relative time
  "time.now": { vi: "ngay bây giờ", en: "now" },
  "time.minutes": { vi: "{{n}} phút nữa", en: "in {{n}} min" },
  "time.hours": { vi: "{{n}} giờ {{m}} phút nữa", en: "in {{n}}h {{m}}m" },
  "time.days": { vi: "{{n}} ngày nữa", en: "in {{n}} days" },
} as const;

export type TKey = keyof typeof dict;

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}>({
  lang: "vi",
  setLang: () => {},
  t: (key) => key,
});

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "vi") return stored;
    } catch {
      // ignore
    }
    return "vi";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      const entry = dict[key];
      if (!entry) return key;
      return interpolate(entry[lang], vars);
    },
    [lang]
  );

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  return useContext(LanguageContext);
}
