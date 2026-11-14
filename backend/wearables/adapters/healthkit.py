"""Apple HealthKit Integration Adapter.
Maps HKQuantityTypeIdentifierStepCount and HKCategoryTypeIdentifierSleepAnalysis records.
"""
from __future__ import annotations

from typing import Any
from ..base import NormalizedWearableRecord, WearableProvider


class HealthKitAdapter(WearableProvider):
    @property
    def provider_id(self) -> str:
        return "healthkit"

    @property
    def display_name(self) -> str:
        return "Apple HealthKit"

    def is_connected(self, user_id: int) -> bool:
        return False

    def parse_payload(self, raw_data: Any) -> list[NormalizedWearableRecord]:
        records: list[NormalizedWearableRecord] = []
        if isinstance(raw_data, list):
            for item in raw_data:
                sample_type = item.get("type", "")
                start = item.get("startDate", "")
                if "StepCount" in sample_type:
                    records.append(NormalizedWearableRecord(
                        timestamp=start,
                        steps=int(float(item.get("value", 0))),
                        provider="healthkit"
                    ))
                elif "SleepAnalysis" in sample_type:
                    val = item.get("value")
                    # Value in HealthKit: 0 = in bed, 1 = asleep
                    duration = float(item.get("durationMinutes", 0))
                    records.append(NormalizedWearableRecord(
                        timestamp=start,
                        sleep_minutes=duration if val == 1 else None,
                        in_bed_minutes=duration,
                        provider="healthkit"
                    ))
        return records
