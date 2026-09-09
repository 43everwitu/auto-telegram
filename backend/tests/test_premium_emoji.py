from app.premium_emoji import build_message_with_entities


def test_premium_account_gets_custom_emoji_entity():
    text, entities = build_message_with_entities("Hi [emoji:123]\U0001F525[/emoji] there", is_premium=True)
    assert text == "Hi \U0001F525 there"
    assert len(entities) == 1
    assert entities[0].document_id == 123


def test_non_premium_account_gets_plain_fallback_no_entity():
    text, entities = build_message_with_entities("Hi [emoji:123]\U0001F525[/emoji] there", is_premium=False)
    assert text == "Hi \U0001F525 there"
    assert entities == []


def test_no_markup_passthrough():
    text, entities = build_message_with_entities("plain text", is_premium=True)
    assert text == "plain text"
    assert entities == []


def test_multiple_markups():
    text, entities = build_message_with_entities(
        "[emoji:1]A[/emoji] mid [emoji:2]B[/emoji]", is_premium=True
    )
    assert text == "A mid B"
    assert [e.document_id for e in entities] == [1, 2]
