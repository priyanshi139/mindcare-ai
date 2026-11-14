"""Modular wearable data ingestion architecture.
Defines abstract contracts for multi-vendor health stream normalization.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class NormalizedWearableRecord:
    timestamp: str  # ISO 8601 UTC
    steps: int | None = None
    sleep_minutes: float | None = None
    in_bed_minutes: float | None = None
    stress_score: int | None = None  # 1 to 5 scale
    is_device_worn: bool = True
    provider: str = "generic"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class DailyWearableSummary:
    date: str  # YYYY-MM-DD
    steps_total: int | None = None
    sleep_hours: float | None = None
    in_bed_hours: float | None = None
    sleep_efficiency: float | None = None
    is_valid_day: bool = True
    non_wear_detected: bool = False
    provider: str = "generic"


class WearableProvider(ABC):
    """Abstract base provider for wearable ecosystem ingestion."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique provider identifier (e.g. 'fitbit', 'health_connect', 'healthkit')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @abstractmethod
    def is_connected(self, user_id: int) -> bool:
        """Check if active OAuth2 authorization exists for user."""
        pass

    @abstractmethod
    def parse_payload(self, raw_data: Any) -> list[NormalizedWearableRecord]:
        """Convert vendor-specific stream into normalized records."""
        pass
