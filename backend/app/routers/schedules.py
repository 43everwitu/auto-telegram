from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import ScheduleConfig, Target
from app.schemas import ScheduleConfigCreate, ScheduleConfigOut
from app.scheduler import scheduler, schedule_target_for_today

router = APIRouter(prefix="/api/schedules", tags=["schedules"], dependencies=[Depends(require_admin)])


def _next_send_for_target(target_id: int):
    prefix = f"send-{target_id}-"
    try:
        jobs = scheduler.get_jobs()
    except Exception:
        # Best-effort enrichment — a jobstore hiccup shouldn't break listing schedules.
        return None
    times = [job.next_run_time for job in jobs if job.id.startswith(prefix) and job.next_run_time is not None]
    return min(times) if times else None


@router.get("", response_model=list[ScheduleConfigOut])
def list_schedules(db: Session = Depends(get_db)):
    configs = db.query(ScheduleConfig).all()
    result = []
    for config in configs:
        out = ScheduleConfigOut.model_validate(config)
        out.next_send_at = _next_send_for_target(config.target_id)
        result.append(out)
    return result


@router.put("/{target_id}", response_model=ScheduleConfigOut)
def upsert_schedule(target_id: int, req: ScheduleConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(ScheduleConfig).filter(ScheduleConfig.target_id == target_id).first()
    if existing:
        existing.messages_per_day = req.messages_per_day
        existing.window_start = req.window_start
        existing.window_end = req.window_end
        existing.min_gap_minutes = req.min_gap_minutes
        existing.target_id = target_id
        db.commit()
        db.refresh(existing)
        out = existing
    else:
        config = ScheduleConfig(**req.model_dump(exclude={"target_id"}), target_id=target_id)
        db.add(config)
        db.commit()
        db.refresh(config)
        out = config

    target = db.get(Target, target_id)
    if target is not None:
        # Pick up today's remaining slots right away instead of waiting for the next
        # midnight cron run — see schedule_target_for_today's docstring.
        schedule_target_for_today(target)
    return out


@router.delete("/{target_id}")
def delete_schedule(target_id: int, db: Session = Depends(get_db)):
    config = db.query(ScheduleConfig).filter(ScheduleConfig.target_id == target_id).first()
    if config is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(config)
    db.commit()
    return {"ok": True}
