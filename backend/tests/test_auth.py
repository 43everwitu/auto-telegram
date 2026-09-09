import pytest
from app.auth import create_access_token, decode_access_token, verify_password
import bcrypt


def test_verify_password_correct():
    hashed = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    assert verify_password("secret", hashed) is True


def test_verify_password_wrong():
    hashed = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    assert verify_password("wrong", hashed) is False


def test_token_roundtrip():
    token = create_access_token("admin")
    assert decode_access_token(token) == "admin"


def test_decode_rejects_garbage_token():
    with pytest.raises(Exception):
        decode_access_token("not-a-real-token")
