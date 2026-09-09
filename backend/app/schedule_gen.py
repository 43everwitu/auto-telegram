import random
from datetime import date, datetime, time, timedelta


def generate_daily_times(
    x: int, window_start: str, window_end: str, min_gap_minutes: int, day: date
) -> list[datetime]:
    if x <= 0:
        return []

    start_h, start_m = map(int, window_start.split(":"))
    end_h, end_m = map(int, window_end.split(":"))
    start_dt = datetime.combine(day, time(start_h, start_m))
    end_dt = datetime.combine(day, time(end_h, end_m))
    window_minutes = int((end_dt - start_dt).total_seconds() // 60)

    if window_minutes < (x - 1) * min_gap_minutes:
        raise ValueError(
            f"Window too small: need {(x - 1) * min_gap_minutes} min of gap capacity, "
            f"have {window_minutes}"
        )

    reduced_range = window_minutes - (x - 1) * min_gap_minutes
    offsets = sorted(random.randint(0, reduced_range) for _ in range(x))
    return [start_dt + timedelta(minutes=offsets[i] + i * min_gap_minutes) for i in range(x)]
