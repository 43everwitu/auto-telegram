import os
import time
import bcrypt
import jwt

ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 12


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str) -> str:
    secret = os.environ["JWT_SECRET_KEY"]
    payload = {"sub": subject, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    secret = os.environ["JWT_SECRET_KEY"]
    payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    return payload["sub"]
