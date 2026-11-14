"""Fitbit Web API Integration Adapter.
Connects with Fitbit Intraday Activity and Sleep logs via OAuth 2.0.
"""
from __future__ import annotations

from typing import Any
from ..base import NormalizedWearableRecord, WearableProvider


class FitbitAdapter(WearableProvider):
    @property
    def provider_id(self) -> str:
        return "fitbit"

    @property
    def display_name(self) -> str:
        return "Fitbit"

    def is_connected(self, user_id: int) -> bool:
        # Development prototype: OAuth tokens managed via secure environment/DB
        return False

    def parse_payload(self, raw_data: Any) -> list[NormalizedWearableRecord]:
        records: list[NormalizedWearableRecord] = []
        # Support Fitbit standard 'activities-steps' and 'sleep' JSON responses
        if isinstance(raw_data, dict):
            # Parse steps
            for item in raw_data.get("activities-steps", []):
                date_str = item.get("dateTime", "")
                val = int(item.get("value", 0))
                records.append(NormalizedWearableRecord(
                    timestamp=f"{date_str}T00:00:00Z",
                    steps=val,
                    provider="fitbit"
                ))
            # Parse sleep
            for s in raw_data.get("sleep", []):
                date_str = s.get("dateOfSleep", "")
                mins_asleep = float(s.get("minutesAsleep", 0))
                mins_in_bed = float(s.get("timeInBed", 0))
                records.append(NormalizedWearableRecord(
                    timestamp=f"{date_str}T00:00:00Z",
                    sleep_minutes=mins_asleep,
                    in_bed_minutes=mins_in_bed,
                    provider="fitbit"
                ))
        return records
