from datetime import datetime
from pydantic import BaseModel, Field, model_validator


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
    topic_id: int | None = None


class TargetOut(TargetCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True


class TargetResolveRequest(BaseModel):
    account_id: int
    link: str


class TargetResolveResponse(BaseModel):
    telegram_chat_id: str
    type: str
    title: str
    topic_id: int | None = None


class TestSendResponse(BaseModel):
    status: str
    error_message: str | None
    sent_at: datetime


class TemplateCreate(BaseModel):
    body: str


class TemplateOut(TemplateCreate):
    id: int

    class Config:
        from_attributes = True


class TargetTemplateAssign(BaseModel):
    template_id: int


class TemplateImportRequest(BaseModel):
    account_id: int
    message_link: str


class TemplateImportResponse(BaseModel):
    body: str


class ScheduleConfigCreate(BaseModel):
    target_id: int
    messages_per_day: int = Field(ge=1)
    window_start: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    window_end: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    min_gap_minutes: int = Field(ge=0)

    @model_validator(mode="after")
    def check_window_order(self):
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be after window_start")
        return self


class ScheduleConfigOut(BaseModel):
    id: int
    target_id: int
    messages_per_day: int
    window_start: str
    window_end: str
    min_gap_minutes: int
    next_send_at: datetime | None = None

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
