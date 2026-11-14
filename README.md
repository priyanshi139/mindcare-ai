# MindCare AI — Unified Mental Health Platform

**Integrated AI-Based Early Detection, Continuous Wearable Monitoring & Multilingual Support System for Depression.**

MindCare AI is a full-stack, clinically-grounded mental health platform combining a **React 18 / TypeScript** frontend, a **FastAPI** backend, a **retrained and calibrated XGBoost machine learning model**, and the **multilingual Saathi listen-first conversational companion** powered by Groq LLM and offline safety fallbacks.

---

## 🌟 Key Features

* **Genuinely Retrained Machine Learning Model**: Calibrated XGBoost estimator (`risk_model.joblib`, ROC-AUC **0.7758**, PR-AUC **0.6146**) trained on 35,694 longitudinal participant-period records with participant-wise stratified splitting (zero data leakage).
* **Human-Centered AI Wellness Forecast**: Replaces intimidating technical data-science jargon with warm, understandable wellness forecasts and actionable 15-minute micro-goals.
* **Explainable AI (XAI)**: Dynamic individual-level factor attributions via `shap.TreeExplainer` alongside cohort-level research insights.
* **Multilingual AI Companion ("Saathi")**: Real-time conversational support in **English, Hindi, and Hinglish** with native **Groq (Llama-3.3-70B)** integration, psychoeducation RAG, and an offline rule-based fallback.
* **Clinical Safety & Crisis Routing**: Mandatory PHQ-9 Item 9 (suicidality/self-harm) emergency overrides and immediate 24/7 routing to India's national **Tele-MANAS (14416 / 1-800-891-4416)** and **112**.
* **Modular Wearable Data Framework**: Production-ready ingestion adapters for Android Health Connect, Apple HealthKit, Fitbit, and CSV imports.
* **Role-Based Access Control & Privacy**: Salted PBKDF2 password hashing (200,000 rounds), 32-byte JWT sessions, and patient-controlled clinician delegation (Doctor / Caregiver views).

---

## 📑 Project Documentation & Reports

Detailed technical documentation, work logs, and audit reports are available in the [`docs/`](docs/) directory:

1. **[Comprehensive Project Work Report](docs/Comprehensive_Project_Work_Report.md)**: Full chronological record of all engineering work performed across the project (audit, dataset recovery, model retraining, calibration, backend integration, bug fixes, and testing).
2. **[Official Project Submission Report](docs/Project_Submission_Report.md)**: Formal academic and technical submission document covering system architecture, clinical data engineering, multi-algorithm benchmarks, and safety protocols.
3. **[Model Card](docs/Model_Card.md)**: Clinical model specifications, input modalities, decision boundaries, intended boundaries, and demographic fairness audits.
4. **[Model Evaluation Report](docs/Evaluation_Report.md)**: Detailed multi-model comparison (Baseline vs. Logistic Regression vs. HistGradientBoosting vs. XGBoost), calibration curves, and held-out test set metrics.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Python 3.10+** (tested on Python 3.14)
* **Node.js 18+** & **npm**

---

### Step 1: Run the FastAPI Backend

Open a terminal in `backend/` (MindCare AI):

```powershell
cd backend

# (Optional) Add your Groq API Key to .env for live AI Companion:
# LLM_PROVIDER=groq
# LLM_API_KEY=gsk_your_actual_groq_api_key
# LLM_MODEL=llama-3.3-70b-versatile

# Start the API server
python -m uvicorn main:app --port 8000 --reload
```

* **API Server**: `http://127.0.0.1:8000`
* **Interactive API Documentation (Swagger)**: `http://127.0.0.1:8000/docs`
* **Health Endpoint**: `http://127.0.0.1:8000/api/health`
* **Model Benchmark Metrics**: `http://127.0.0.1:8000/api/ml/metrics`

---

### Step 2: Run the React Frontend

Open a second terminal in `MindCare AI`:

```powershell
# In project root
npm run dev
```

* **Application UI**: `http://localhost:5173`
* Vite automatically proxies `/api` requests to the FastAPI backend at port 8000.

---

### Step 3: Run the Automated Verification Suite

Run the full integration test suite (covers model loading, unseen sample inference, safety overrides, multilingual safety filters, and FastAPI endpoints):

```powershell
python -m pytest backend/tests/test_inference_pipeline.py -v
```
*(All 5 tests pass with 0 warnings in ~5 seconds without external network dependencies).*

---

## 🤖 Configuring the AI Companion (Groq LLM)

Saathi works out-of-the-box in **offline template mode** without requiring any API keys. 

To enable freeform, real-time generative dialogue powered by Groq's high-speed **Llama-3.3-70B**:
1. Open `backend/.env`
2. Add your Groq API key:
   ```env
   LLM_PROVIDER=groq
   LLM_API_KEY=gsk_your_actual_key_here
   LLM_MODEL=llama-3.3-70b-versatile
   ```
3. Restart the backend (`uvicorn main:app --port 8000 --reload`).

*(Google Gemini, Anthropic, and local Ollama are also natively supported by changing `LLM_PROVIDER`).*

---

## 🩺 Clinician Provisioning

To create a Doctor or Caregiver account:
```powershell
cd backend
python create_clinician.py "Dr. Specialist" doctor@example.com Password123! Doctor
```
*(Use `Caregiver` for family members). Patients can grant read access to this clinician under **Profile and privacy**.*

---

## 📦 Pushing to GitHub

This repository is completely self-contained. To push to your GitHub account:

```powershell
# Navigate to your project repository
cd MindCare_AI

git init
git add .
git commit -m "feat: MindCare unified mental health platform with retrained XGBoost model"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

> **Security Note**: The included `.gitignore` automatically prevents `.env`, `backend/.env`, `mindcare.db`, and multi-gigabyte raw datasets from being uploaded. Only source code, tests, documentation, and the lightweight 672 KB retrained model artifact (`risk_model.joblib`) are pushed.

---

## 📊 Model Summary & Performance

* **Model Architecture**: Calibrated Extreme Gradient Boosting (`XGBClassifier`) with post-hoc `IsotonicRegression`.
* **Primary Dataset**: 35,694 rows, 139 behavioral/wearable/clinical features across 4,948 participants.
* **Test ROC-AUC**: **0.7758**
* **Test PR-AUC**: **0.6146**
* **Brier Score Loss**: **0.1696**
* **Sex Demographic Parity**: Female ROC-AUC **0.7575** vs. Male ROC-AUC **0.7580** (Δ = 0.0005).
* **Calibrated Cut-offs**: Moderate `0.2387` (≥ 85% recall), High `0.4171` (≥ 60% precision).
* **Clinical Boundary**: Screening risk indicator only; not a diagnostic instrument.

---

## ⚖️ License & Ethical Boundaries

MindCare AI is developed for academic, screening, and research purposes. In emergencies, users are immediately directed to **Tele-MANAS (14416)** or **112**.
