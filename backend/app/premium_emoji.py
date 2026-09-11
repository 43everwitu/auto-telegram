import re
from telethon import helpers
from telethon.tl.types import MessageEntityCustomEmoji

CUSTOM_EMOJI_PATTERN = re.compile(r"\[emoji:(\d+)\](.+?)\[/emoji\]")


def build_message_with_entities(body: str, is_premium: bool) -> tuple[str, list]:
    entities = []
    result = []
    cursor = 0
    offset = 0
    for match in CUSTOM_EMOJI_PATTERN.finditer(body):
        plain_before = body[cursor:match.start()]
        result.append(plain_before)
        offset += len(plain_before.encode("utf-16-le")) // 2

        document_id, fallback = match.group(1), match.group(2)
        result.append(fallback)
        length = len(fallback.encode("utf-16-le")) // 2
        if is_premium:
            entities.append(
                MessageEntityCustomEmoji(offset=offset, length=length, document_id=int(document_id))
            )
        offset += length
        cursor = match.end()

    result.append(body[cursor:])
    return "".join(result), entities


def tag_custom_emoji(text: str, entities: list) -> str:
    """Inverse of build_message_with_entities: given a message's text and its Telegram
    entities (as returned by Telethon for a real sent message), re-insert [emoji:ID]...[/emoji]
    markup around each MessageEntityCustomEmoji span so a copied message keeps its custom
    (Premium) emoji instead of losing them to plain-text fallback glyphs.

    entity.offset/length are UTF-16 code units, not Python codepoints, so slicing goes through
    Telethon's surrogate-pair helpers to stay aligned with the entity offsets.
    """
    customs = sorted(
        (e for e in entities if isinstance(e, MessageEntityCustomEmoji)),
        key=lambda e: e.offset,
    )
    if not customs:
        return text

    surrogate = helpers.add_surrogate(text)
    pieces = []
    cursor = 0
    for e in customs:
        pieces.append(helpers.del_surrogate(surrogate[cursor:e.offset]))
        fallback = helpers.del_surrogate(surrogate[e.offset:e.offset + e.length])
        pieces.append(f"[emoji:{e.document_id}]{fallback}[/emoji]")
        cursor = e.offset + e.length
    pieces.append(helpers.del_surrogate(surrogate[cursor:]))
    return "".join(pieces)
