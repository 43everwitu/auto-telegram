from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import ContentTemplate
from app.schemas import TemplateCreate, TemplateOut

router = APIRouter(prefix="/api/templates", tags=["templates"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return db.query(ContentTemplate).all()


@router.post("", response_model=TemplateOut)
def create_template(req: TemplateCreate, db: Session = Depends(get_db)):
    template = ContentTemplate(**req.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(ContentTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(template)
    db.commit()
    return {"ok": True}
