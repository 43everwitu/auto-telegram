import os
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    key = os.environ["SESSION_ENCRYPTION_KEY"]
    return Fernet(key.encode())


def encrypt_session(raw: str) -> str:
    return _get_fernet().encrypt(raw.encode()).decode()


def decrypt_session(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()
