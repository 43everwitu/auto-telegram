from datetime import date, datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from telethon.errors import FloodWaitError, UserDeactivatedBanError, AuthKeyUnregisteredError, ChatWriteForbiddenError

from app.db import DATABASE_URL, SessionLocal
from app.models import Target, SendLog, Account
from app.schedule_gen import generate_daily_times
from app.content import resolve_template
from app.premium_emoji import build_message_with_entities

scheduler = AsyncIOScheduler(jobstores={"default": SQLAlchemyJobStore(url=DATABASE_URL)})


def schedule_target_for_today(target: Target) -> None:
    """Schedule this target's remaining today's-window sends. Called both in bulk (daily cron /
    app startup) and immediately after a schedule is created/updated, so a newly-configured
    target doesn't have to wait for the next midnight cron run to get today's jobs."""
    config = target.schedule_config
    if config is None or not target.active:
        return
    times = generate_daily_times(
        config.messages_per_day, config.window_start, config.window_end,
        config.min_gap_minutes, date.today(),
    )
    for i, run_time in enumerate(times):
        if run_time < datetime.now():
            continue
        scheduler.add_job(
            send_job, "date", run_date=run_time,
            args=[target.id],
            id=f"send-{target.id}-{date.today()}-{i}",
            replace_existing=True,
        )


def schedule_all_targets_for_today():
    db = SessionLocal()
    try:
        targets = db.query(Target).filter(Target.active.is_(True)).all()
        for target in targets:
            try:
                schedule_target_for_today(target)
            except Exception as e:
                print(f"schedule_all_targets_for_today: failed to schedule target {target.id}: {e}")
    finally:
        db.close()


def cancel_jobs_for_account(db, account_id):
    try:
        targets = db.query(Target).filter(Target.account_id == account_id).all()
        for target in targets:
            prefix = f"send-{target.id}-"
            for job in scheduler.get_jobs():
                if job.id.startswith(prefix):
                    scheduler.remove_job(job.id)
    except Exception as e:
        print(f"cancel_jobs_for_account: failed to cancel jobs for account {account_id}: {e}")


async def send_job(target_id: int, retry: bool = False, force: bool = False):
    from app.routers.accounts import manager

    db = SessionLocal()
    try:
        target = db.get(Target, target_id)
        if target is None or (not target.active and not force):
            return
        try:
            template = resolve_template(db, target_id)
        except ValueError as e:
            db.add(SendLog(target_id=target_id, template_id=None, status="failed", error_message=str(e)))
            db.commit()
            return

        account = db.get(Account, target.account_id)
        try:
            client = await manager.ensure_client(db, target.account_id)
            send_target = await manager.resolve_send_target(client, target.telegram_chat_id)
            text, entities = build_message_with_entities(
                template.body, bool(account and account.telegram_premium)
            )
            # parse_mode="html" only applies when formatting_entities is None (no custom emoji
            # markup in the template); telethon ignores parse_mode when formatting_entities is
            # non-empty, so HTML tags in a template that also has [emoji:...] markup won't render.
            await client.send_message(
                send_target, text, parse_mode="html", formatting_entities=entities or None,
                reply_to=target.topic_id,
            )
            db.add(SendLog(target_id=target_id, template_id=template.id, status="success"))
        except FloodWaitError as e:
            scheduler.add_job(
                send_job, "date", run_date=datetime.now() + timedelta(seconds=e.seconds),
                args=[target_id],
            )
            cancel_jobs_for_account(db, target.account_id)
            db.add(SendLog(
                target_id=target_id, template_id=template.id, status="failed",
                error_message=f"FloodWait {e.seconds}s, rescheduled",
            ))
        except (UserDeactivatedBanError, AuthKeyUnregisteredError) as e:
            if account:
                account.status = "banned"
            cancel_jobs_for_account(db, target.account_id)
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        except ChatWriteForbiddenError as e:
            target.active = False
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        except Exception as e:
            if not retry:
                scheduler.add_job(
                    send_job, "date", run_date=datetime.now() + timedelta(minutes=5),
                    args=[target_id], kwargs={"retry": True},
                )
            db.add(SendLog(target_id=target_id, template_id=template.id, status="failed", error_message=str(e)))
        db.commit()
    finally:
        db.close()
