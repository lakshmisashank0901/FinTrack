from datetime import date

import pytest

from app.models.enums import Frequency, Interval, Period
from app.services.budgets import budget_state
from app.services.recurring import monthly_equivalent
from app.services.savings import months_between
from app.utils.dates import add_months, bucket_label, buckets, next_occurrence, resolve_range
from app.utils.money import change_percent, format_inr, paise_to_rupee_str

TODAY = date(2026, 10, 24)  # a Saturday


@pytest.mark.parametrize("paise,expected", [
    (125_000, "₹1,250"), (1_250_000, "₹12,500"), (12_500_000, "₹1,25,000"), (125_000_000, "₹12,50,000"),
    (1_000_000_000, "₹1,00,00,000"), (10_000_000_000, "₹10,00,00,000"), (0, "₹0"), (99, "₹0.99"), (125_050, "₹1,250.50"), (-12_500_000, "-₹1,25,000"),
])
def test_format_inr(paise, expected):
    assert format_inr(paise) == expected


def test_paise_to_rupee_str():
    assert paise_to_rupee_str(125_050) == "1250.50"
    assert paise_to_rupee_str(-5) == "-0.05"


def test_change_percent():
    assert change_percent(150, 100) == 50.0
    assert change_percent(50, 100) == -50.0
    assert change_percent(100, 0) is None
    assert change_percent(100, None) is None


@pytest.mark.parametrize("period,start,end,pstart,pend", [
    (Period.this_week, "2026-10-19", "2026-10-24", "2026-10-12", "2026-10-17"),
    (Period.this_month, "2026-10-01", "2026-10-24", "2026-09-01", "2026-09-24"),
    (Period.last_month, "2026-09-01", "2026-09-30", "2026-08-01", "2026-08-31"),
    (Period.last_3_months, "2026-08-01", "2026-10-24", "2026-05-01", "2026-07-24"),
    (Period.this_year, "2026-01-01", "2026-10-24", "2025-01-01", "2025-10-24"),
])
def test_resolve_range_presets(period, start, end, pstart, pend):
    r = resolve_range(period, TODAY)
    assert (str(r.start), str(r.end), str(r.previous_start), str(r.previous_end)) == (start, end, pstart, pend)


def test_this_month_previous_span_is_capped_at_month_end():
    r = resolve_range(Period.this_month, date(2026, 3, 31))
    assert (r.previous_start, r.previous_end) == (date(2026, 2, 1), date(2026, 2, 28))


def test_custom_range_and_validation():
    r = resolve_range(Period.custom, TODAY, date(2026, 10, 1), date(2026, 10, 10))
    assert r.days == 10 and r.previous_end == date(2026, 9, 30) and r.previous_start == date(2026, 9, 21)
    from app.core.errors import AppError
    with pytest.raises(AppError):
        resolve_range(Period.custom, TODAY, date(2026, 10, 10), date(2026, 10, 1))
    with pytest.raises(AppError):
        resolve_range(Period.custom, TODAY, None, None)
    with pytest.raises(AppError):
        resolve_range(Period.custom, TODAY, date(2010, 1, 1), date(2026, 1, 1))


def test_buckets():
    assert len(buckets(date(2026, 1, 1), date(2026, 12, 31), Interval.month)) == 12
    assert len(buckets(date(2026, 10, 1), date(2026, 10, 31), Interval.day)) == 31
    weeks = buckets(date(2026, 10, 1), date(2026, 10, 31), Interval.week)
    assert weeks[0] == date(2026, 9, 28) and all(w.weekday() == 0 for w in weeks) and len(weeks) == 5
    assert bucket_label(date(2026, 10, 1), Interval.month, False) == "Oct"
    assert bucket_label(date(2026, 10, 1), Interval.month, True) == "Oct 2026"
    assert bucket_label(date(2026, 10, 5), Interval.day, False) == "5 Oct"


def test_month_arithmetic_and_occurrences():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 15), 3) == date(2027, 2, 15)
    assert add_months(date(2026, 1, 15), -2) == date(2025, 11, 15)
    assert next_occurrence(date(2026, 10, 24), Frequency.weekly) == date(2026, 10, 31)
    assert next_occurrence(date(2026, 10, 31), Frequency.monthly) == date(2026, 11, 30)
    assert next_occurrence(date(2026, 11, 30), Frequency.quarterly) == date(2027, 2, 28)
    assert next_occurrence(date(2028, 2, 29), Frequency.yearly) == date(2029, 2, 28)


def test_monthly_equivalent():
    assert monthly_equivalent(1200, Frequency.weekly) == 5200
    assert monthly_equivalent(1200, Frequency.monthly) == 1200
    assert monthly_equivalent(1200, Frequency.quarterly) == 400
    assert monthly_equivalent(1200, Frequency.yearly) == 100


def test_budget_state():
    assert budget_state(79, 100, 80).value == "on_track"
    assert budget_state(80, 100, 80).value == "approaching"
    assert budget_state(100, 100, 80).value == "approaching"
    assert budget_state(101, 100, 80).value == "exceeded"


def test_months_between():
    assert months_between(date(2026, 10, 24), date(2026, 10, 30)) == 1
    assert months_between(date(2026, 10, 24), date(2027, 4, 24)) == 7
    assert months_between(date(2026, 10, 24), date(2027, 4, 23)) == 6
