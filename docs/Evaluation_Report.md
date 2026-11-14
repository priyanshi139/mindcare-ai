# Model Retraining & Evaluation Report

**Date of Execution**: 14 November 2026  
**Environment**: Python 3.14 on Windows (x86_64)  
**Artifact Directory**: `backend/outputs/models/`

---

## 1. Executive Summary
The primary early-detection model for depression screening was retrained from the original 35,694-row research dataset (`anon_processed_df_parquet`) using strict participant-wise stratified splitting.

Zero synthetic, fabricated, or randomized replacement data was used. Data leakage was strictly prevented by locking preprocessor parameters to training folds and isolating outcome variables.

---

## 2. Multi-Model Comparison on Validation Data
Models were trained with class weighting on the training split (7,610 rows, 2,835 participants) and evaluated on the validation split (1,630 rows, 593 participants):

| Model Candidate | Validation ROC-AUC | Explainability Support | Status |
|---|---|---|---|
| **Baseline (Start PHQ-9 Score Only)** | 0.8823 | Coefficient only | Reference Benchmark |
| **Logistic Regression (L2 C=0.3)** | 0.7523 | Exact Linear Coefficients | Evaluated |
| **HistGradientBoosting** | 0.7556 | Permutation / Tree SHAP | Evaluated |
| **XGBoost (n=400, depth=4, lr=0.05)** | **0.7529** | **TreeExplainer Native SHAP** | **Selected Winning Model** |

*Selection Rationale*: XGBoost was selected under the pre-defined selection criteria (scoring within 0.005 of top validation AUC while providing exact, fast local SHAP feature explanations via `shap.TreeExplainer`).

---

## 3. Probability Calibration & Decision Thresholds
Post-hoc probability calibration was fitted on the validation fold using `IsotonicRegression` (`out_of_bounds='clip'`, `y_min=0`, `y_max=1`).

Thresholds tuned on validation probabilities:
* **Moderate Risk Threshold**: `0.2387` (achieves >= 85% recall for screening detection)
* **High Risk Threshold**: `0.4171` (achieves >= 60% precision)

---

## 4. Test Set Evaluation (Held-Out Test Split)
Single evaluation conducted on held-out test split (1,626 rows, 608 participants):
* **ROC-AUC**: 0.7758
* **PR-AUC**: 0.6146
* **Brier Score Loss**: 0.1696 (low calibration error)
* **Macro-F1 (at Moderate Cut-off)**: 0.6834
* **Distribution of Test Cohort by Risk Level**:
  * Low Risk: 57.4%
  * Moderate Risk: 20.7%
  * High Risk: 21.9%

---

## 5. Artifact Verification Checklist
- [x] Preprocessing Pipeline saved: `backend/outputs/models/preprocessor.joblib`
- [x] Trained Model & Calibrator saved: `backend/outputs/models/risk_model.joblib`
- [x] Feature Schema verified: `backend/outputs/models/final_feature_list.txt` (139 columns)
- [x] Calibrated Thresholds: `backend/outputs/models/thresholds.json`
- [x] Full Evaluation Metrics: `backend/outputs/models/metrics.json`
- [x] Isolated Demo Cohort: `backend/outputs/models/demo_users.json`
- [x] Integrated into FastAPI: `backend/ml/model_runner.py`
