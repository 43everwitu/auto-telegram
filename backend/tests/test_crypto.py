from app.crypto import encrypt_session, decrypt_session


def test_encrypt_decrypt_roundtrip():
    raw = "example-telethon-session-string"
    token = encrypt_session(raw)
    assert token != raw
    assert decrypt_session(token) == raw
