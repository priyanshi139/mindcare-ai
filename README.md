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

## What is implemented (real)
- Backend (FastAPI + SQLite): signup and login with salted PBKDF2 password hashes and JWT sessions, per-user data, input validation
- Mood tracking: add and delete entries (mood, sleep, stress, note), stored per user
- PHQ-9 questionnaire with correct scoring (0 to 27, standard bands), history, and a safety message if item 9 is answered above 0
- Dashboard built from the logged-in user's own data, with empty states ("Complete your first assessment...")
- Explainable AI page: global SHAP bars from the project's model run (demo bars until a model is served)
- API endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/me`, `/api/mood`, `/api/assessment`, `/api/summary`

## What is NOT implemented yet
- **No trained ML model is served**, so no risk percentage is shown. Next step: load the project's model in `backend/` and add a `/api/predict` endpoint.
- AI companion (needs an LLM API key held by the backend), editing mood entries, wellness goals, notifications, data upload, risk alerts
- Doctor and caregiver access with consent, EHR/FHIR, password reset, data export and account deletion
- Production security: sessions are stored in localStorage for development. Use httpOnly cookies, HTTPS and a managed auth service for real deployment.

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
