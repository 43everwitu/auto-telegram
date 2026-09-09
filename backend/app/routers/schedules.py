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
