from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db import get_db
from app.deps import require_admin
from app.models import SendLog
from app.schemas import SendLogOut

router = APIRouter(prefix="/api/logs", tags=["logs"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[SendLogOut])
def list_logs(target_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(SendLog)
    if target_id is not None:
        q = q.filter(SendLog.target_id == target_id)
    return q.order_by(SendLog.sent_at.desc()).limit(200).all()


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    rows = (
        db.query(SendLog.target_id, SendLog.status, func.count(SendLog.id))
        .group_by(SendLog.target_id, SendLog.status)
        .all()
    )
    result: dict[int, dict[str, int]] = {}
    for target_id, status, count in rows:
        result.setdefault(target_id, {})[status] = count
    return result
