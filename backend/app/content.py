import random
from sqlalchemy.orm import Session
from app.models import ContentTemplate


def resolve_template(db: Session, target_id: int) -> ContentTemplate:
    overrides = (
        db.query(ContentTemplate)
        .filter(ContentTemplate.target_id == target_id, ContentTemplate.is_override.is_(True))
        .all()
    )
    if overrides:
        return random.choice(overrides)

    shared = db.query(ContentTemplate).filter(ContentTemplate.target_id.is_(None)).all()
    if shared:
        return random.choice(shared)

    raise ValueError(f"No content template available for target {target_id}")
