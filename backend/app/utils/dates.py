import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.errors import AppError
from app.models.enums import Frequency, Interval, Period

MAX_RANGE_DAYS = 366 * 5


def today_in(timezone: str) -> date:
    try:
        return datetime.now(ZoneInfo(timezone)).date()
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def is_valid_timezone(timezone: str) -> bool:
    try:
        ZoneInfo(timezone)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def parse_month(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m").date()
    except ValueError as exc:
        raise AppError("Month must be formatted as YYYY-MM.", code="invalid_month") from exc


def format_month(d: date) -> str:
    return d.strftime("%Y-%m")


def next_occurrence(d: date, frequency: Frequency) -> date:
    if frequency == Frequency.weekly:
        return d + timedelta(days=7)
    months = {Frequency.monthly: 1, Frequency.quarterly: 3, Frequency.yearly: 12}[frequency]
    return add_months(d, months)


@dataclass(frozen=True)
class DateRange:
    period: Period
    start: date
    end: date
    previous_start: date
    previous_end: date

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    def as_dict(self) -> dict[str, object]:
        return {
            "period": self.period.value,
            "start_date": self.start,
            "end_date": self.end,
            "previous_start_date": self.previous_start,
            "previous_end_date": self.previous_end,
            "days": self.days,
        }


def resolve_range(period: Period, today: date, start: date | None = None, end: date | None = None) -> DateRange:
    """Resolve a period preset (or custom range) and its comparison range.

    "this_*" periods run up to today and are compared with the same elapsed span
    one period earlier (e.g. 1–24 Oct vs 1–24 Sep). Complete periods compare with
    the preceding equal span. Custom ranges compare with the window right before.
    """
    if period == Period.custom or (start is not None and end is not None):
        if start is None or end is None:
            raise AppError("start_date and end_date are required for a custom period.", code="invalid_range")
        if start > end:
            raise AppError("start_date must be on or before end_date.", code="invalid_range")
        if (end - start).days + 1 > MAX_RANGE_DAYS:
            raise AppError("Date range cannot exceed 5 years.", code="invalid_range")
        length = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        return DateRange(Period.custom, start, end, prev_end - timedelta(days=length - 1), prev_end)

    if period == Period.this_week:
        s = week_start(today)
        return DateRange(period, s, today, s - timedelta(days=7), today - timedelta(days=7))

    if period == Period.this_month:
        s = month_start(today)
        ps = add_months(s, -1)
        pe = min(ps + (today - s), month_end(ps))
        return DateRange(period, s, today, ps, pe)

    if period == Period.last_month:
        s = add_months(month_start(today), -1)
        ps = add_months(s, -1)
        return DateRange(period, s, month_end(s), ps, month_end(ps))

    if period == Period.last_3_months:
        # The current month to date plus the two complete months before it.
        s = add_months(month_start(today), -2)
        ps = add_months(s, -3)
        pe = add_months(today, -3)
        return DateRange(period, s, today, ps, pe)

    if period == Period.this_year:
        s = date(today.year, 1, 1)
        ps = date(today.year - 1, 1, 1)
        pe = add_months(today, -12)
        return DateRange(period, s, today, ps, pe)

    raise AppError("Unsupported period.", code="invalid_period")  # pragma: no cover


def default_interval(r: DateRange) -> Interval:
    if r.days <= 31:
        return Interval.day
    if r.days <= 92:
        return Interval.week
    return Interval.month


def bucket_key(d: date, interval: Interval) -> date:
    if interval == Interval.day:
        return d
    if interval == Interval.week:
        return week_start(d)
    return month_start(d)


def buckets(start: date, end: date, interval: Interval) -> list[date]:
    out: list[date] = []
    cursor = bucket_key(start, interval)
    while cursor <= end:
        out.append(cursor)
        if interval == Interval.day:
            cursor += timedelta(days=1)
        elif interval == Interval.week:
            cursor += timedelta(days=7)
        else:
            cursor = add_months(cursor, 1)
    return out


def bucket_label(d: date, interval: Interval, multi_year: bool) -> str:
    if interval == Interval.month:
        return d.strftime("%b %Y") if multi_year else d.strftime("%b")
    label = f"{d.day} {d.strftime('%b')}"
    return f"{label} {d.strftime('%y')}" if multi_year and interval == Interval.week else label
