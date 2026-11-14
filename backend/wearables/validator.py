"""Validation and data-cleaning engine for incoming wearable data streams.
Ensures adherence to clinical research standards and leak-safe imputation rules.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence
from .base import NormalizedWearableRecord, DailyWearableSummary


class WearableValidationError(Exception):
    pass


def validate_record(r: NormalizedWearableRecord) -> NormalizedWearableRecord:
    # 1. Timestamp validation (must be ISO8601, not in future)
    try:
        dt = datetime.fromisoformat(r.timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise WearableValidationError(f"Invalid timestamp format: {r.timestamp}")

    now_utc = datetime.now(timezone.utc)
    if dt > now_utc:
        raise WearableValidationError(f"Timestamp is in the future: {r.timestamp}")

    # 2. Non-wear detection rule from research preprocessing:
    # If asleep == 0 and in_bed == 0, device was not worn during sleep window.
    if r.sleep_minutes == 0 and r.in_bed_minutes == 0:
        r.is_device_worn = False
        r.sleep_minutes = None
        r.in_bed_minutes = None

    # 3. Range checks
    if r.steps is not None and (r.steps < 0 or r.steps > 100000):
        raise WearableValidationError(f"Steps count out of realistic range: {r.steps}")

    if r.sleep_minutes is not None and (r.sleep_minutes < 0 or r.sleep_minutes > 1440):
        raise WearableValidationError(f"Sleep minutes out of range (0-1440): {r.sleep_minutes}")

    if r.stress_score is not None and not (1 <= r.stress_score <= 5):
        raise WearableValidationError(f"Stress score must be 1 to 5: {r.stress_score}")

    return r


def aggregate_daily(records: Sequence[NormalizedWearableRecord]) -> list[DailyWearableSummary]:
    by_day: dict[str, list[NormalizedWearableRecord]] = {}
    for r in records:
        day_str = r.timestamp[:10]
        by_day.setdefault(day_str, []).append(r)

    summaries = []
    for day, recs in sorted(by_day.items()):
        total_steps = sum(r.steps for r in recs if r.steps is not None)
        has_steps = any(r.steps is not None for r in recs)

        sleep_mins = [r.sleep_minutes for r in recs if r.sleep_minutes is not None]
        in_bed_mins = [r.in_bed_minutes for r in recs if r.in_bed_minutes is not None]

        sleep_h = (sum(sleep_mins) / 60.0) if sleep_mins else None
        in_bed_h = (sum(in_bed_mins) / 60.0) if in_bed_mins else None

        efficiency = (sleep_h / in_bed_h) if (sleep_h and in_bed_h and in_bed_h > 0) else None
        non_wear = any(not r.is_device_worn for r in recs)

        summaries.append(
            DailyWearableSummary(
                date=day,
                steps_total=total_steps if has_steps else None,
                sleep_hours=round(sleep_h, 2) if sleep_h is not None else None,
                in_bed_hours=round(in_bed_h, 2) if in_bed_h is not None else None,
                sleep_efficiency=round(efficiency, 3) if efficiency is not None else None,
                non_wear_detected=non_wear,
                provider=recs[0].provider if recs else "generic",
            )
        )
    return summaries
