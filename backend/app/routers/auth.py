import os
from fastapi import APIRouter, HTTPException
from app.auth import verify_password, create_access_token
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    admin_username = os.environ["ADMIN_USERNAME"]
    admin_password_hash = os.environ["ADMIN_PASSWORD_HASH"]
    if req.username != admin_username or not verify_password(req.password, admin_password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(req.username)
    return LoginResponse(access_token=token)
