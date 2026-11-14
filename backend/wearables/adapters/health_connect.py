"""Android Health Connect Integration Adapter.
Maps StepsRecord and SleepSessionRecord from Google Health Connect Android SDK.
"""
from __future__ import annotations

from typing import Any
from ..base import NormalizedWearableRecord, WearableProvider


class HealthConnectAdapter(WearableProvider):
    @property
    def provider_id(self) -> str:
        return "health_connect"

    @property
    def display_name(self) -> str:
        return "Android Health Connect"

    def is_connected(self, user_id: int) -> bool:
        return False

    def parse_payload(self, raw_data: Any) -> list[NormalizedWearableRecord]:
        records: list[NormalizedWearableRecord] = []
        if isinstance(raw_data, list):
            for item in raw_data:
                rec_type = item.get("recordType", "")
                start_time = item.get("startTime", "")
                if "Steps" in rec_type:
                    records.append(NormalizedWearableRecord(
                        timestamp=start_time,
                        steps=int(item.get("count", 0)),
                        provider="health_connect"
                    ))
                elif "SleepSession" in rec_type:
                    duration_sec = float(item.get("durationSeconds", 0))
                    records.append(NormalizedWearableRecord(
                        timestamp=start_time,
                        sleep_minutes=duration_sec / 60.0,
                        provider="health_connect"
                    ))
        return records
