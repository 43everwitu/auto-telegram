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
