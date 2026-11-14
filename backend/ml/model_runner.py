"""Model serving module.
Loads the retrained risk model, performs calibrated inference, applies safety overrides,
and generates local SHAP factor explanations.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd

from . import risk

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "outputs" / "models"
MODEL_PATH = MODEL_DIR / "risk_model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"
THRESHOLDS_PATH = MODEL_DIR / "thresholds.json"
DEMO_USERS_PATH = MODEL_DIR / "demo_users.json"
FEATURE_LIST_PATH = MODEL_DIR / "final_feature_list.txt"

FRIENDLY_NAMES = {
    "steps_awake_mean": "average daily steps",
    "sleep_asleep_weekday_mean": "sleep time on weekdays",
    "sleep_asleep_weekend_mean": "sleep time on weekends",
    "sleep_in_bed_weekday_mean": "time in bed on weekdays",
    "sleep_main_start_hour_adj_median": "usual bedtime",
    "sleep_main_start_hour_adj_iqr": "bedtime variability",
    "money": "financial stress indicator",
    "comorbid_migraines": "migraine history",
    "comorbid_neuropathic": "neuropathic pain history",
    "phq9_score_start": "starting questionnaire score",
    "bmi": "BMI",
    "sleep_nap_count": "daytime nap frequency",
    "steps_rolling_6_sum_max": "peak activity pattern",
}


def friendly(name: str) -> str:
    clean = name.strip()
    return FRIENDLY_NAMES.get(clean, clean.replace("__", " ").replace("_", " ").strip())


class ModelRunner:
    def __init__(self):
        self._bundle: dict[str, Any] | None = None
        self._explainer = None
        self._load()

    def _load(self):
        if not MODEL_PATH.exists():
            self._bundle = None
            return
        try:
            self._bundle = joblib.load(MODEL_PATH)
            model = self._bundle.get("model")
            model_name = self._bundle.get("name", "")
            if model_name == "xgboost" and model is not None:
                try:
                    import shap
                    self._explainer = shap.TreeExplainer(model)
                except Exception:
                    self._explainer = None
        except Exception as e:
            print("Warning: failed to load model artifact:", e)
            self._bundle = None

    def is_available(self) -> bool:
        return self._bundle is not None

    def get_metrics(self) -> dict | None:
        if METRICS_PATH.exists():
            try:
                return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass
        return None

    def get_thresholds(self) -> dict:
        if self._bundle and "thresholds" in self._bundle:
            return self._bundle["thresholds"]
        if THRESHOLDS_PATH.exists():
            try:
                return json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"moderate": 0.2387, "high": 0.4171}

    def get_global_shap(self) -> list[dict]:
        """Returns cohort-level global mean |SHAP| values from PSYCHE-D evaluation."""
        return [
            {"name": "financial stress indicator", "value": 0.300, "context": True},
            {"name": "migraine history", "value": 0.227, "context": True},
            {"name": "neuropathic pain history", "value": 0.222, "context": True},
            {"name": "headache / migraine days", "value": 0.133, "context": True},
            {"name": "birth year / age cohort", "value": 0.106, "context": True},
            {"name": "average daily steps", "value": 0.075, "context": False},
            {"name": "weekend sleep duration", "value": 0.056, "context": False},
            {"name": "daytime nap frequency", "value": 0.055, "context": False},
        ]

    def get_demo_users(self) -> list[dict]:
        """Isolated demonstration users from held-out test cohort for benchmark evaluation."""
        if DEMO_USERS_PATH.exists():
            try:
                data = json.loads(DEMO_USERS_PATH.read_text(encoding="utf-8"))
                return data.get("users", [])
            except Exception:
                pass
        return []

    def predict(
        self,
        features: dict[str, float | int | None],
        phq9_start: float | None = None,
        phq9_item9: int | None = None,
        crisis_text: bool = False,
    ) -> dict:
        if not self.is_available():
            return {
                "model_available": False,
                "status": "model_not_loaded",
                "message": "ML model artifact is not loaded. Train the model using ml_pipeline.",
            }

        bundle = self._bundle
        cols: list[str] = bundle["columns"]
        model = bundle["model"]
        calibrator = bundle["calibrator"]
        thr = bundle["thresholds"]

        # Build single row DataFrame matching expected columns
        row = {}
        for col in cols:
            val = features.get(col)
            if val is None and col == "phq9_score_start":
                val = phq9_start
            row[col] = float(val) if val is not None else 0.0

        df = pd.DataFrame([row], columns=cols)

        # Raw & calibrated probability
        try:
            raw_p = float(model.predict_proba(df)[:, 1][0])
            calibrated_p = float(calibrator.predict([raw_p])[0])
            calibrated_p = max(0.0, min(1.0, calibrated_p))
        except Exception as e:
            return {"model_available": True, "error": f"Prediction failed: {str(e)}"}

        raw_level = risk.level_from_prob(calibrated_p, thr["moderate"], thr["high"])
        final_level = risk.apply_safety_override(raw_level, phq9_item9=phq9_item9, crisis_text=crisis_text)
        is_override = final_level == "high" and raw_level != "high"

        # Local SHAP / Feature contributions
        factors = []
        if self._explainer is not None:
            try:
                shap_vals = self._explainer.shap_values(df)
                arr = np.asarray(shap_vals)[0] if np.asarray(shap_vals).ndim > 1 else np.asarray(shap_vals)
                top_indices = np.argsort(-np.abs(arr))[:5]
                for idx in top_indices:
                    val = float(arr[idx])
                    factors.append({
                        "name": friendly(cols[idx]),
                        "direction": "raises" if val > 0 else "lowers",
                        "size": round(abs(val), 3),
                    })
            except Exception:
                pass

        return {
            "model_available": True,
            "model_name": bundle.get("name", "xgboost"),
            "raw_probability": round(raw_p, 4),
            "calibrated_probability": round(calibrated_p, 4),
            "level": final_level,
            "raw_level": raw_level,
            "safety_override": is_override,
            "thresholds": thr,
            "top_factors": factors,
            "support": risk.SUPPORT.get(final_level),
        }


runner = ModelRunner()
