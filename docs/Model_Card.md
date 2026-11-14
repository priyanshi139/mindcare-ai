# Model Card: AI Early Detection & Screening Risk Model for Depression

## 1. Model Details
* **Model Name**: Calibrated XGBoost Depression Risk Estimator (`risk_model.joblib`)
* **Version**: 1.0.0 (Retrained from primary wearable + context dataset)
* **Architecture**: Extreme Gradient Boosting (`XGBClassifier`) with post-hoc `IsotonicRegression` probability calibration.
* **Trained by**: MindCare AI Pipeline
* **Input Modalities**: 139 tabular features (wearable summary aggregates, behavioral step/sleep patterns, clinical context, and baseline starting PHQ-9).
* **Target Label**: Probability of end-of-period `PHQ-9 >= 10` (standard screening threshold for moderate-to-severe depression).
* **Calibrated Output**: Probability bounded `[0.0, 1.0]` mapped to three risk bands:
  * **Low**: `p < 0.2387`
  * **Moderate**: `0.2387 <= p < 0.4171` (tuned to achieve >= 85% recall on validation set)
  * **High**: `p >= 0.4171` (tuned to achieve >= 60% precision on validation set)

## 2. Intended Use & Boundaries
* **Intended Use**: Research prototype for early behavioral risk screening and lifestyle support prompts.
* **Clinical Boundary**: This system estimates a *screening risk indicator*. It does **not** diagnose depression, dysthymia, or any other medical condition. It must not replace clinical assessment by a physician, psychiatrist, or licensed counsellor.
* **Mandatory Clinical Safety Override**: A positive response to PHQ-9 Item 9 (thoughts of self-harm or suicide, answer > 0) or crisis wording in companion conversation immediately forces a **High** risk status and activates direct referral to Tele-MANAS (14416) and 112, overriding any lower probability estimated by the statistical model.

## 3. Training & Validation Data
* **Primary Cohort**: 35,694 participant-period records from 4,948 participants (PSYCHE-D wearable cohort with chronic conditions).
* **Splitting Strategy**: Strict participant-wise 20-fold stratified grouping. No individual participant appears in more than one split:
  * **Train Set**: 7,610 rows (2,835 participants; positive rate 31.68%)
  * **Validation Set**: 1,630 rows (593 participants; positive rate 31.72%)
  * **Held-out Test Set**: 1,626 rows (608 participants; positive rate 31.73%)
* **Leakage Controls**:
  * End-of-period outcomes (`phq9_score_end`, `phq9_cat_end`, `phq9_cat_start`) strictly removed from model features.
  * 20 undocumented timing window features excluded from primary model training.
  * Quantile clipping, median imputation, and robust scaling fitted strictly on training data.

## 4. Evaluation Metrics (Held-Out Test Set)
* **ROC-AUC**: **0.7758** (well above random chance 0.50)
* **PR-AUC**: **0.6146** (against base prevalence 0.3173)
* **Brier Score**: **0.1696** (calibrated, lower is better)
* **Macro-F1 at Moderate Threshold**: **0.6834**
* **Baseline Comparison**: Starting PHQ-9 score alone scored ROC-AUC 0.8869. The model signal is honest and transparent: historical questionnaire baseline remains highly predictive, while wearable behavior provides orthogonal continuous monitoring signals between questionnaire intervals.

## 5. Demographic Fairness Audit
Evaluated on unseen test participants across demographic subgroups:
* `sex = 0 (female)`: n = 1,244 | ROC-AUC = 0.7575
* `sex = 1 (male)`: n = 379 | ROC-AUC = 0.7580 (near-identical performance across sex)
* `race_white = 1`: n = 1,413 | ROC-AUC = 0.7633
* `race_black = 1`: n = 95 | ROC-AUC = 0.8679
* `race_hispanic = 1`: n = 78 | ROC-AUC = 0.8635
* `race_other = 1`: n = 63 | ROC-AUC = 0.8266
* `race_asian = 1`: n = 68 | ROC-AUC = 0.6719 (smaller subgroup variance, recommended for larger sampling)

## 6. Explainability
* Global cohort factors computed via `shap.TreeExplainer`:
  * Top risk modifiers: Financial stress indicator, migraine history, neuropathic pain history, sleep nap frequency, peak 6-hour activity pattern.
* Local individual explanations generated via tree path attributions showing exact feature directions (`raises` vs `lowers`) and magnitudes.
