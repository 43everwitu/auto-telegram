import random
from sqlalchemy.orm import Session
from app.models import ContentTemplate, TargetTemplate


def resolve_template(db: Session, target_id: int) -> ContentTemplate:
    templates = (
        db.query(ContentTemplate)
        .join(TargetTemplate, TargetTemplate.template_id == ContentTemplate.id)
        .filter(TargetTemplate.target_id == target_id)
        .all()
    )
    if not templates:
        raise ValueError(f"No template assigned to target {target_id}")
    return random.choice(templates)
