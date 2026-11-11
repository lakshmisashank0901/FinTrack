def format_inr(paise: int) -> str:
    """Format minor units as Indian rupees with lakh/crore grouping: 12500000 -> '₹1,25,000'."""
    sign = "-" if paise < 0 else ""
    rupees, fraction = divmod(abs(paise), 100)
    digits = str(rupees)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups) + "," + tail
    text = f"{sign}₹{digits}"
    return f"{text}.{fraction:02d}" if fraction else text


def paise_to_rupee_str(paise: int) -> str:
    sign = "-" if paise < 0 else ""
    rupees, fraction = divmod(abs(paise), 100)
    return f"{sign}{rupees}.{fraction:02d}"


def percent(part: int | float, whole: int | float) -> float | None:
    if not whole:
        return None
    return round(part / whole * 100, 1)


def change_percent(current: int, previous: int | None) -> float | None:
    if previous is None or previous == 0:
        return None
    return round((current - previous) / abs(previous) * 100, 1)
