from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_admin
from app.models import Account
from app.schemas import AccountOut, OtpStartRequest, OtpConfirmRequest, SessionStringLoginRequest
from app.telegram_manager import TelegramAccountManager

router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(require_admin)])
manager = TelegramAccountManager()


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()


@router.post("/otp/start")
async def otp_start(req: OtpStartRequest):
    phone_code_hash = await manager.start_otp_login(req.phone)
    return {"phone_code_hash": phone_code_hash}


@router.post("/otp/confirm", response_model=AccountOut)
async def otp_confirm(req: OtpConfirmRequest, db: Session = Depends(get_db)):
    try:
        return await manager.confirm_otp_login(db, req.phone, req.code, req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/session-string", response_model=AccountOut)
async def session_string_login(req: SessionStringLoginRequest, db: Session = Depends(get_db)):
    try:
        return await manager.login_with_session_string(db, req.session_string)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(account)
    db.commit()
    return {"ok": True}
