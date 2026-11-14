"""Comprehensive inference and integration test suite.
Validates:
1. Model loading and pipeline serialization
2. Real inference on unseen test samples from X_test.parquet
3. Local SHAP factor explanations
4. Clinical safety overrides (Item 9 and crisis wording)
5. Companion multilingual safety and offline template fallback
6. FastAPI endpoint handlers
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Add paths to sys.path so tests can run from any working directory
os.environ["LLM_PROVIDER"] = "none"
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("LLM_API_KEY", None)
BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BACKEND_DIR.parent.parent
for p in [str(WORKSPACE_DIR), str(BACKEND_DIR.parent), str(BACKEND_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import pandas as pd
import pytest

try:
    from MindCare_Integration.backend.main import (
        app,
        q,
        signup,
        assess_add,
        chat_post,
        predict_endpoint,
        explain_global,
        ml_metrics,
        Signup,
        AssessIn,
        ChatIn,
        PredictIn,
    )
    from MindCare_Integration.backend.ml import companion, risk, safety
    from MindCare_Integration.backend.ml.model_runner import runner
except ImportError:
    from backend.main import (
        app,
        q,
        signup,
        assess_add,
        chat_post,
        predict_endpoint,
        explain_global,
        ml_metrics,
        Signup,
        AssessIn,
        ChatIn,
        PredictIn,
    )
    from backend.ml import companion, risk, safety
    from backend.ml.model_runner import runner


def test_model_loading_and_availability():
    assert runner.is_available(), "Trained risk_model.joblib must be available"
    thr = runner.get_thresholds()
    assert "moderate" in thr and "high" in thr
    assert 0 < thr["moderate"] < thr["high"] < 1.0


def test_inference_on_unseen_test_samples():
    test_path = BACKEND_DIR.parent / "ml_pipeline" / "outputs" / "primary" / "X_test.parquet"
    y_test_path = BACKEND_DIR.parent / "ml_pipeline" / "outputs" / "primary" / "y_test.parquet"
    assert test_path.exists(), "X_test.parquet must exist"

    X_test = pd.read_parquet(test_path)
    y_test = pd.read_parquet(y_test_path)
    assert len(X_test) > 0

    # Pick 5 unseen test samples
    samples = X_test.head(5)
    y_samples = y_test.head(5)

    for i in range(len(samples)):
        feat_dict = samples.iloc[i].to_dict()
        start_score = float(y_samples.iloc[i]["phq9_score_start"]) if pd.notna(y_samples.iloc[i]["phq9_score_start"]) else None
        res = runner.predict(feat_dict, phq9_start=start_score)

        assert res["model_available"] is True
        assert 0.0 <= res["raw_probability"] <= 1.0
        assert 0.0 <= res["calibrated_probability"] <= 1.0
        assert res["level"] in ("low", "moderate", "high")
        assert len(res["top_factors"]) > 0
        for f in res["top_factors"]:
            assert "name" in f and "direction" in f and "size" in f
            assert f["direction"] in ("raises", "lowers")
            assert f["size"] >= 0.0


def test_clinical_safety_overrides():
    feat = {"steps_awake_mean": 10000, "sleep_asleep_weekday_mean": 450}

    # Baseline prediction without self-harm
    normal_res = runner.predict(feat, phq9_start=1.0, phq9_item9=0, crisis_text=False)
    assert normal_res["level"] == "low"
    assert normal_res["safety_override"] is False

    # Positive Item 9 (thoughts of self-harm > 0) MUST override level to high
    override_res = runner.predict(feat, phq9_start=1.0, phq9_item9=1, crisis_text=False)
    assert override_res["level"] == "high"
    assert override_res["safety_override"] is True

    # Crisis text in conversation MUST override level to high
    crisis_res = runner.predict(feat, phq9_start=1.0, phq9_item9=0, crisis_text=True)
    assert crisis_res["level"] == "high"
    assert crisis_res["safety_override"] is True


def test_multilingual_companion_safety():
    crisis_queries = [
        "I want to end my life",
        "mujhe marna hai jeene ka mann nahi hai",
        "मुझे आत्महत्या करने का विचार आ रहा है",
    ]
    for q_text in crisis_queries:
        assert safety.classify(q_text) == "crisis"
        rep = companion.respond(q_text)
        assert rep["level"] == "crisis"
        assert "14416" in rep["reply"]  # Tele-MANAS helpline
        assert "112" in rep["reply"]    # Emergency helpline

    # Offline template check
    normal_rep = companion.respond("I feel a little stressed about work today")
    assert normal_rep["level"] in ("normal", "distress")
    assert len(normal_rep["reply"]) > 10


def test_fastapi_endpoints_end_to_end():
    # 1. Global explainability endpoint
    shap_data = explain_global()
    assert isinstance(shap_data, list)
    assert len(shap_data) >= 5

    # 2. Metrics endpoint
    metrics_data = ml_metrics()
    assert metrics_data["available"] is True
    assert "metrics" in metrics_data

    # 3. Create test patient user
    signup_payload = Signup(
        name="Integration Test User",
        email=f"test_patient_{int(os.getpid())}@example.com",
        password="StrongPassword123!",
        role="Patient",
    )
    user_res = signup(signup_payload)
    user = user_res["user"]
    assert user["role"] == "Patient"

    # 4. Save PHQ-9 assessment
    assess_res = assess_add(AssessIn(answers=[1, 2, 0, 1, 1, 0, 1, 0, 0]), u=user)
    assert assess_res["score"] == 6

    # 5. Test companion chat
    chat_res = chat_post(ChatIn(message="Hello Saathi, I had a busy day."), u=user)
    assert "reply" in chat_res
    assert chat_res["kind"] in ("chat", "safety")

    # 6. Test predict endpoint
    p_data = predict_endpoint(
        PredictIn(features={"steps_awake_mean": 7500, "sleep_asleep_weekday_mean": 410}, phq9_start=6.0),
        u=user,
    )
    assert p_data["model_available"] is True
    assert "calibrated_probability" in p_data
    assert "level" in p_data
    assert len(p_data["top_factors"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
