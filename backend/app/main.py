from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routers import auth, accounts, targets

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(targets.router)


@app.on_event("startup")
def on_startup():
    init_db()
