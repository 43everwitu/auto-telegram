// Mirrors backend/app/premium_emoji.py's [emoji:ID]fallback[/emoji] markup: the ID only
// resolves to a custom-emoji sticker inside a real Telegram client for Premium accounts, so
// here we just show the fallback glyph — this is an approximation, not a pixel-exact render.
const CUSTOM_EMOJI_PATTERN = /\[emoji:\d+\](.+?)\[\/emoji\]/g;

export function telegramPreviewHtml(body: string): string {
  return body.replace(CUSTOM_EMOJI_PATTERN, "$1").replace(/\r\n|\n/g, "<br>");
}

export default function TelegramPreview({ body }: { body: string }) {
  return (
    <div className="tg-preview">
      <div className="tg-bubble" dangerouslySetInnerHTML={{ __html: telegramPreviewHtml(body) }} />
    </div>
  );
}
