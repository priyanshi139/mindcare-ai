# MindCare AI

Frontend for **AI-Based Early Detection and Support System for Depression Using Behavioral and Wearable Data**.
A research prototype. It shows risk indicators, never diagnoses.

## Stack
React 18, TypeScript, Vite, Tailwind CSS v4, React Router, Zustand, Recharts, Lucide.

## Run locally (two terminals, Windows PowerShell)
**Terminal 1: backend**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```
**Terminal 2: frontend**
```powershell
npm install
npm run dev        # http://localhost:5173 (proxies /api to the backend)
```
Optional: set `MINDCARE_SECRET` to a long random string before starting the backend (the default is for development only).

## Enable the AI companion
Easiest: copy `backend/.env.example` to `backend/.env` and put your key in it (that file is git-ignored). Or set these where the backend starts (Windows cmd, before `uvicorn`):
```
set LLM_API_KEY=your_groq_key
set LLM_MODEL=openai/gpt-oss-120b
set MINDCARE_HELPLINE=Tele-MANAS 14416 (free, 24x7, India) or emergency services 112
```
Never put the key in frontend files or on GitHub. The companion was tested with a mocked LLM; test it with your real key before demos.

## What is implemented (real)
- Backend (FastAPI + SQLite): signup and login with salted PBKDF2 password hashes and JWT sessions, per-user data, input validation
- Mood tracking: add and delete entries (mood, sleep, stress, note), stored per user
- PHQ-9 questionnaire with correct scoring (0 to 27, standard bands), history, and a safety message if item 9 is answered above 0
- Dashboard built from the logged-in user's own data, with empty states ("Complete your first assessment...")
- Explainable AI page: global SHAP bars from the project's model run (demo bars until a model is served)
- AI companion: chat through the backend to an OpenAI-compatible LLM (Groq by default). The key lives only in backend environment variables. Crisis messages are handled before the LLM and always show help information. Not configured means a clear message, never a fake AI reply.
- Behavioral analytics: weekly mood, sleep and stress averages and week-over-week change, from your own check-ins
- Explainable AI: your latest PHQ-9 answers as exact per-question contributions, plus your own 7-day changes. The PSYCHE-D SHAP chart is labeled demo (no model is served yet)
- Wellness goals: add, progress, delete, per user
- Profile and privacy: edit name, download all your data as JSON, delete your account and all data (typed confirmation)
- Signup creates Patient accounts only. Doctor and caregiver accounts need authorization and are not self-registrable
- Risk monitoring: assessment-based status, configurable alert threshold (5 to 27), alerts (threshold, rise of 5+ points, PHQ-9 item 9) with acknowledge, dismiss and history. No ML model is used
- Notifications stored in the backend: saved assessments, completed goals, and 2-day mood reminders; read, delete, mark all read, preference toggle
- Mood entries can be edited as well as deleted
- Wellness insights: rule-based suggestions from your own data (labeled rule-based), journaling prompts, sleep hygiene, activity ideas
- Data upload: CSV/JSON mood import with validation, preview, per-row error reasons, duplicate skipping and import history. Wearables are listed as not connected (integration-ready only)
- Health records: your PHQ-9 results as a FHIR R4 Bundle (LOINC 44261-6), downloaded with explicit consent. Prototype only, no hospital connection
- Password change
- Doctor and caregiver access (consent-based, enforced by the backend): clinician accounts are created only by an administrator script, never by signup. Members grant and revoke access by email in Profile and privacy and can see who viewed their data. Clinicians see only members who consented, only scores and mood, sleep and stress numbers (never journal text or chats). Doctors can write private notes; caregivers are view-only. Deleting an account removes its access records, view log and notes
- Onboarding after signup (3 steps): consent, focus areas (used to order your insights), reminder preference and an optional first goal
- Behavioral analytics with daily (30 days), weekly (8 weeks) and monthly (12 months) views
- Forgot password in DEVELOPMENT MODE: the one-time code (15 minutes, single use, stored hashed) is printed in the backend console instead of being emailed. Email delivery and email verification are not implemented (they need an email service). Existing login tokens stay valid until they expire (7 days)
- API endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/me`, `/api/mood`, `/api/assessment`, `/api/summary`

## What is NOT implemented yet
- **No trained ML model is served**, so no risk percentage is shown. Next step: load the project's model in `backend/` and add a `/api/predict` endpoint.
- Editing mood entries, notifications, data upload, risk alerts
- data upload
- Production security: sessions are stored in localStorage for development. Use httpOnly cookies, HTTPS and a managed auth service for real deployment.

## Create a doctor or caregiver account (administrator only)
```powershell
cd backend
.venv\Scripts\activate
python create_clinician.py "Dr Name" doctor@example.com password123 Doctor
```
Use `Caregiver` instead of `Doctor` for a view-only account. Then the patient adds that email in Profile and privacy. This is a development-level design: a production system would also need identity verification of clinicians, audit retention, and a security review.

## Folder structure
```
public/logo        logo files
src/components     Layout, Logo
src/pages          Landing, Auth, Overview, Assess, Explain, Mood
src/services       api.ts (backend integration point)
src/store          auth.ts (Zustand, JWT session)
src/data           mock.ts (demo data)
```

## Push to GitHub (PowerShell)
Create an empty repository on github.com first (no README), then:
```powershell
git init
git add .
git commit -m "MindCare AI React frontend"
git branch -M main
git remote add origin https://github.com/<your-username>/mindcare-ai.git
git push -u origin main
```
