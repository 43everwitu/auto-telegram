import pytest
from app.models import Target, ContentTemplate
from app.content import resolve_template


def _make_target(db_session, target_id=1):
    target = Target(id=target_id, account_id=1, telegram_chat_id="100", type="channel", title="T", active=True)
    db_session.add(target)
    db_session.commit()
    return target


def test_resolve_uses_override_when_present(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="shared", is_override=False, target_id=None))
    db_session.add(ContentTemplate(id=2, body="override", is_override=True, target_id=1))
    db_session.commit()

    result = resolve_template(db_session, target_id=1)
    assert result.body == "override"


def test_resolve_falls_back_to_shared_pool(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="shared", is_override=False, target_id=None))
    db_session.commit()

    result = resolve_template(db_session, target_id=1)
    assert result.body == "shared"


def test_resolve_raises_when_no_template(db_session):
    _make_target(db_session)
    with pytest.raises(ValueError):
        resolve_template(db_session, target_id=1)
