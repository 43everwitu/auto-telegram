from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import Target, SendLog, ContentTemplate, TargetTemplate
from app.schemas import (
    TargetCreate,
    TargetOut,
    TargetResolveRequest,
    TargetResolveResponse,
    TestSendResponse,
    TargetTemplateAssign,
    TemplateOut,
)
from app.routers.accounts import manager
from app.scheduler import send_job

router = APIRouter(prefix="/api/targets", tags=["targets"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TargetOut])
def list_targets(db: Session = Depends(get_db)):
    return db.query(Target).all()


@router.post("/resolve", response_model=TargetResolveResponse)
async def resolve_target(req: TargetResolveRequest, db: Session = Depends(get_db)):
    try:
        chat_id, chat_type, title, topic_id = await manager.resolve_chat(db, req.account_id, req.link)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TargetResolveResponse(telegram_chat_id=chat_id, type=chat_type, title=title, topic_id=topic_id)


@router.post("", response_model=TargetOut)
def create_target(req: TargetCreate, db: Session = Depends(get_db)):
    target = Target(**req.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.post("/{target_id}/test-send", response_model=TestSendResponse)
async def test_send(target_id: int, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")

    await send_job(target_id, retry=True, force=True)

    log = (
        db.query(SendLog)
        .filter(SendLog.target_id == target_id)
        .order_by(SendLog.id.desc())
        .first()
    )
    if log is None:
        raise HTTPException(status_code=500, detail="Send did not produce a result")
    return TestSendResponse(status=log.status, error_message=log.error_message, sent_at=log.sent_at)


@router.put("/{target_id}", response_model=TargetOut)
def update_target(target_id: int, req: TargetCreate, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in req.model_dump().items():
        setattr(target, key, value)
    db.commit()
    db.refresh(target)
    return target


@router.get("/{target_id}/templates", response_model=list[TemplateOut])
def list_target_templates(target_id: int, db: Session = Depends(get_db)):
    return (
        db.query(ContentTemplate)
        .join(TargetTemplate, TargetTemplate.template_id == ContentTemplate.id)
        .filter(TargetTemplate.target_id == target_id)
        .all()
    )


@router.post("/{target_id}/templates", response_model=TemplateOut)
def assign_template(target_id: int, req: TargetTemplateAssign, db: Session = Depends(get_db)):
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    template = db.get(ContentTemplate, req.template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    existing = (
        db.query(TargetTemplate)
        .filter(TargetTemplate.target_id == target_id, TargetTemplate.template_id == req.template_id)
        .first()
    )
    if existing is None:
        db.add(TargetTemplate(target_id=target_id, template_id=req.template_id))
        db.commit()
    return template


@router.delete("/{target_id}/templates/{template_id}")
def unassign_template(target_id: int, template_id: int, db: Session = Depends(get_db)):
    link = (
        db.query(TargetTemplate)
        .filter(TargetTemplate.target_id == target_id, TargetTemplate.template_id == template_id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Not assigned")
    db.delete(link)
    db.commit()
    return {"ok": True}


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
