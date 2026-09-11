import pytest
from app.models import Target, ContentTemplate, TargetTemplate
from app.content import resolve_template


def _make_target(db_session, target_id=1):
    target = Target(id=target_id, account_id=1, telegram_chat_id="100", type="channel", title="T", active=True)
    db_session.add(target)
    db_session.commit()
    return target


def test_resolve_uses_assigned_template(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="unassigned"))
    db_session.add(ContentTemplate(id=2, body="assigned"))
    db_session.add(TargetTemplate(target_id=1, template_id=2))
    db_session.commit()

    result = resolve_template(db_session, target_id=1)
    assert result.body == "assigned"


def test_resolve_only_considers_this_targets_assignments(db_session):
    _make_target(db_session, target_id=1)
    _make_target(db_session, target_id=2)
    db_session.add(ContentTemplate(id=1, body="for target 1"))
    db_session.add(ContentTemplate(id=2, body="for target 2"))
    db_session.add(TargetTemplate(target_id=1, template_id=1))
    db_session.add(TargetTemplate(target_id=2, template_id=2))
    db_session.commit()

    assert resolve_template(db_session, target_id=1).body == "for target 1"
    assert resolve_template(db_session, target_id=2).body == "for target 2"


def test_resolve_raises_when_no_template_assigned(db_session):
    _make_target(db_session)
    db_session.add(ContentTemplate(id=1, body="not assigned to anyone"))
    db_session.commit()
    with pytest.raises(ValueError):
        resolve_template(db_session, target_id=1)
