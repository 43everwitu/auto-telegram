from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
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
    topic_id = Column(Integer, nullable=True)  # forum topic (thread) id, if the group uses Topics
    active = Column(Boolean, default=True)

    account = relationship("Account", back_populates="targets")
    template_links = relationship("TargetTemplate", back_populates="target", cascade="all, delete-orphan")
    schedule_config = relationship(
        "ScheduleConfig", back_populates="target", uselist=False, cascade="all, delete-orphan"
    )


class ContentTemplate(Base):
    """A reusable piece of message content. Which target(s) send it is decided entirely by
    TargetTemplate links — a template has no opinion about how it's used."""

    __tablename__ = "content_templates"
    id = Column(Integer, primary_key=True)
    body = Column(Text, nullable=False)

    target_links = relationship("TargetTemplate", back_populates="template", cascade="all, delete-orphan")


class TargetTemplate(Base):
    """Assigns a template to a target. A target rotates randomly among its assigned
    templates when sending; the same template can be assigned to multiple targets."""

    __tablename__ = "target_templates"
    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("content_templates.id"), nullable=False)

    target = relationship("Target", back_populates="template_links")
    template = relationship("ContentTemplate", back_populates="target_links")

    __table_args__ = (UniqueConstraint("target_id", "template_id", name="uq_target_template"),)


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
