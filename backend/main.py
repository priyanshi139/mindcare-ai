"""MindCare AI backend (development version).
Real: accounts with salted PBKDF2 hashes, JWT sessions, per-user data in SQLite, PHQ-9 scoring.
Not real: no trained ML model is served here, no doctor/caregiver access, no LLM. See README."""
import hashlib, json, os, secrets, sqlite3, time
import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

SECRET = os.environ.get("MINDCARE_SECRET", "dev-only-secret-change-me")  # set MINDCARE_SECRET outside development
DB = os.environ.get("MINDCARE_DB", "mindcare.db")
app = FastAPI(title="MindCare AI API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
bearer = HTTPBearer(auto_error=False)

def q(sql, args=(), one=False, commit=False):
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    try:
        cur = con.execute(sql, args)
        if commit: con.commit(); return cur.lastrowid
        rows = cur.fetchall(); return (rows[0] if rows else None) if one else rows
    finally: con.close()

q("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, salt TEXT, hash TEXT, created TEXT)", commit=True)
q("CREATE TABLE IF NOT EXISTS mood(id INTEGER PRIMARY KEY, user_id INT, v INT, sleep_h REAL, stress INT, note TEXT, created TEXT)", commit=True)
q("CREATE TABLE IF NOT EXISTS assess(id INTEGER PRIMARY KEY, user_id INT, answers TEXT, score INT, category TEXT, created TEXT)", commit=True)

now = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
def hpw(pw, salt): return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 200_000).hex()
def token(uid): return jwt.encode({"sub": str(uid), "exp": int(time.time()) + 7 * 86400}, SECRET, "HS256")

def me(c: HTTPAuthorizationCredentials = Depends(bearer)):
    try: uid = int(jwt.decode(c.credentials, SECRET, ["HS256"])["sub"])
    except Exception: raise HTTPException(401, "Please log in again.")
    u = q("SELECT id,name,email,role FROM users WHERE id=?", (uid,), one=True)
    if not u: raise HTTPException(401, "Please log in again.")
    return dict(u)

class Signup(BaseModel):
    name: str = Field(min_length=2, max_length=80); email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128); role: str = "Patient"
class Login(BaseModel): email: str; password: str
class MoodIn(BaseModel):
    v: int = Field(ge=1, le=5); sleep_h: float | None = Field(None, ge=0, le=24)
    stress: int | None = Field(None, ge=1, le=5); note: str = Field("", max_length=300)
class AssessIn(BaseModel): answers: list[int] = Field(min_length=9, max_length=9)

@app.post("/api/auth/signup")
def signup(b: Signup):
    e = b.email.strip().lower()
    if "@" not in e or "." not in e.split("@")[-1]: raise HTTPException(422, "Enter a valid email.")
    if b.role not in ("Patient", "Caregiver", "Doctor"): raise HTTPException(422, "Invalid role.")
    if q("SELECT 1 FROM users WHERE email=?", (e,), one=True): raise HTTPException(409, "An account with this email already exists.")
    salt = secrets.token_hex(16)
    uid = q("INSERT INTO users(name,email,role,salt,hash,created) VALUES(?,?,?,?,?,?)", (b.name.strip(), e, b.role, salt, hpw(b.password, salt), now()), commit=True)
    return {"token": token(uid), "user": {"id": uid, "name": b.name.strip(), "email": e, "role": b.role}}

@app.post("/api/auth/login")
def login(b: Login):
    u = q("SELECT * FROM users WHERE email=?", (b.email.strip().lower(),), one=True)
    if not u or not secrets.compare_digest(hpw(b.password, u["salt"]), u["hash"]): raise HTTPException(401, "Email or password is incorrect.")
    return {"token": token(u["id"]), "user": {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"]}}

@app.get("/api/me")
def whoami(u=Depends(me)): return u

@app.get("/api/mood")
def mood_list(u=Depends(me)):
    return [dict(r) for r in q("SELECT id,v,sleep_h,stress,note,created FROM mood WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 200", (u["id"],))]

@app.post("/api/mood")
def mood_add(b: MoodIn, u=Depends(me)):
    i = q("INSERT INTO mood(user_id,v,sleep_h,stress,note,created) VALUES(?,?,?,?,?,?)", (u["id"], b.v, b.sleep_h, b.stress, b.note.strip(), now()), commit=True)
    return {"id": i}

@app.delete("/api/mood/{mid}")
def mood_del(mid: int, u=Depends(me)):
    q("DELETE FROM mood WHERE id=? AND user_id=?", (mid, u["id"]), commit=True); return {"ok": True}

def phq9_category(s): return "Minimal" if s < 5 else "Mild" if s < 10 else "Moderate" if s < 15 else "Moderately severe" if s < 20 else "Severe"

@app.post("/api/assessment")
def assess_add(b: AssessIn, u=Depends(me)):
    if any(a not in (0, 1, 2, 3) for a in b.answers): raise HTTPException(422, "Each answer must be 0 to 3.")
    s = sum(b.answers); c = phq9_category(s)
    q("INSERT INTO assess(user_id,answers,score,category,created) VALUES(?,?,?,?,?)", (u["id"], json.dumps(b.answers), s, c, now()), commit=True)
    return {"score": s, "category": c, "screen_positive": s >= 10, "item9": b.answers[8] > 0}

@app.get("/api/assessment")
def assess_list(u=Depends(me)):
    return [{"score": r["score"], "category": r["category"], "created": r["created"], "item9": json.loads(r["answers"])[8] > 0}
            for r in q("SELECT * FROM assess WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 50", (u["id"],))]

@app.get("/api/summary")
def summary(u=Depends(me)):
    ms = [dict(r) for r in q("SELECT v,sleep_h,stress,created FROM mood WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 30", (u["id"],))][::-1]
    cut = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 7 * 86400))
    r7 = [m["v"] for m in ms if m["created"] >= cut]
    a = assess_list(u)
    return {"series": [{"date": m["created"][:10], "v": m["v"], "sleep_h": m["sleep_h"], "stress": m["stress"]} for m in ms],
            "moods": len(ms), "avg7": round(sum(r7) / len(r7), 2) if r7 else None,
            "last": a[0] if a else None, "change": a[0]["score"] - a[1]["score"] if len(a) > 1 else None}
