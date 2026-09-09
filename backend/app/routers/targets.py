from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import Target
from app.schemas import TargetCreate, TargetOut

router = APIRouter(prefix="/api/targets", tags=["targets"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TargetOut])
def list_targets(db: Session = Depends(get_db)):
    return db.query(Target).all()


@router.post("", response_model=TargetOut)
def create_target(req: TargetCreate, db: Session = Depends(get_db)):
    target = Target(**req.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.patch("/{target_id}/active", response_model=TargetOut)
def set_active(target_id: int, active: bool, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    target.active = active
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{target_id}")
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(target)
    db.commit()
    return {"ok": True}
