from datetime import date, datetime, time
import pytest
from app.schedule_gen import generate_daily_times


def test_generates_correct_count():
    times = generate_daily_times(3, "08:00", "22:00", 30, date(2026, 9, 10))
    assert len(times) == 3


def test_respects_window():
    day = date(2026, 9, 10)
    start = datetime.combine(day, time(8, 0))
    end = datetime.combine(day, time(22, 0))
    times = generate_daily_times(5, "08:00", "22:00", 10, day)
    assert all(start <= t <= end for t in times)


def test_respects_min_gap():
    times = generate_daily_times(5, "08:00", "22:00", 30, date(2026, 9, 10))
    for a, b in zip(times, times[1:]):
        assert (b - a).total_seconds() >= 30 * 60


def test_returns_sorted_times():
    times = generate_daily_times(4, "08:00", "22:00", 20, date(2026, 9, 10))
    assert times == sorted(times)


def test_raises_when_window_too_small():
    with pytest.raises(ValueError):
        generate_daily_times(10, "08:00", "08:30", 30, date(2026, 9, 10))


def test_zero_messages_returns_empty_list():
    assert generate_daily_times(0, "08:00", "22:00", 30, date(2026, 9, 10)) == []
