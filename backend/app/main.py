from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routers import auth, accounts, targets, templates, schedules, logs
from app.scheduler import scheduler, schedule_all_targets_for_today

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(targets.router)
app.include_router(templates.router)
app.include_router(schedules.router)
app.include_router(logs.router)


@app.on_event("startup")
def on_startup():
    init_db()
    if not scheduler.running:
        # `scheduler` is a module-level singleton, so guard against calling
        # start() twice in the same process (e.g. each api_client fixture
        # instantiates its own TestClient(app), re-firing this startup
        # event) — APScheduler raises SchedulerAlreadyRunningError otherwise.
        scheduler.start()
    scheduler.add_job(
        schedule_all_targets_for_today, "cron", hour=0, minute=5,
        id="daily-schedule-generator", replace_existing=True,
    )
    # Also run once immediately: a restart any time after 00:05 would otherwise leave every
    # target with no jobs for the rest of today until the next midnight cron fires.
    schedule_all_targets_for_today()


@app.on_event("shutdown")
def on_shutdown():
    # AsyncIOScheduler binds to the event loop that is running when start()
    # is called; shut it down here so a later startup (e.g. a new test's
    # TestClient, which runs on its own event loop) rebinds cleanly instead
    # of scheduling callbacks on an already-closed loop.
    if scheduler.running:
        scheduler.shutdown(wait=False)
