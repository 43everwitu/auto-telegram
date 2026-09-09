from sqlalchemy import inspect
from app.db import init_db, engine


def test_init_db_creates_all_tables():
    init_db()
    tables = set(inspect(engine).get_table_names())
    assert {"accounts", "targets", "content_templates", "schedule_configs", "send_logs"} <= tables
