import re
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
