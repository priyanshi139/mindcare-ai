"""MindCare AI backend (development version).
Real: accounts with salted PBKDF2 hashes, JWT sessions, per-user data in SQLite, PHQ-9 scoring.
Not real: no trained ML model is served here, no doctor/caregiver access, no LLM. See README."""
import hashlib, json, os, secrets, sqlite3, time
import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")  # optional backend/.env with LLM_API_KEY etc.
if os.path.exists(_env):
    for _l in open(_env, encoding="utf-8"):
        _k, _, _v = _l.strip().partition("=")
        if _k and not _k.startswith("#") and _k not in os.environ: os.environ[_k] = _v.strip().strip('"')
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
    if b.role != "Patient": raise HTTPException(403, "Doctor and caregiver accounts need authorization and cannot be self-registered.")
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
    prev = q("SELECT score FROM assess WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 1", (u["id"],), one=True)
    s = sum(b.answers); c = phq9_category(s)
    q("INSERT INTO assess(user_id,answers,score,category,created) VALUES(?,?,?,?,?)", (u["id"], json.dumps(b.answers), s, c, now()), commit=True)
    uid, th = u["id"], get_settings(u["id"])["alert_threshold"]
    if s >= th: raise_alert(uid, "threshold", "Screening score at or above your threshold", f"Your PHQ-9 score was {s}/27 and your alert threshold is {th}. This is a screening result, not a diagnosis. Consider talking to a doctor or counsellor.")
    if prev is not None and s - prev["score"] >= 5: raise_alert(uid, "change", f"Score rose by {s - prev['score']} points", f"Your PHQ-9 score went from {prev['score']} to {s} since your last assessment. A rise can have many reasons; it is worth keeping an eye on.")
    if b.answers[8] > 0: raise_alert(uid, "safety", "You reported thoughts of self-harm", f"You deserve support right now. Please reach out to {HELP}, or someone you trust.")
    notify(uid, "Assessment saved", f"Your PHQ-9 score was {s}/27 ({c}).")
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


# ---------------- AI companion ----------------
import re, urllib.error, urllib.request

q("CREATE TABLE IF NOT EXISTS chat(id INTEGER PRIMARY KEY, user_id INT, role TEXT, content TEXT, kind TEXT, created TEXT)", commit=True)
HELP = os.environ.get("MINDCARE_HELPLINE", "Tele-MANAS 14416 (free, 24x7, India) or emergency services 112")  # set for your location
CRISIS = re.compile(r"(suicid|kill myself|end my life|want to die|hurt myself|self.?harm|better off dead|marna chah|marne ka (mann|man)|jeena nahi|jina nahi|zindagi khatam)", re.I)
SYSTEM = ("You are Saathi, a warm, listen-first wellness companion inside a university research prototype that supports depression screening. "
          "Reply in the language the user writes in (English, Hindi or Hinglish), in 2 to 4 short sentences, and ask at most one gentle follow-up question. "
          "Never diagnose, never give medication advice, and never claim to be a therapist or an emergency service. "
          "You may suggest simple things: a breathing exercise, a journaling prompt, sleep habits, a short walk, or contacting a friend, family member or professional. "
          "If someone seems to be in danger, encourage contacting local emergency services or a trusted person. Do not encourage dependence on you.")

def llm_ready(): return bool(os.environ.get("LLM_API_KEY"))

def llm(messages):
    """OpenAI-compatible chat call (Groq by default). The key is read from the backend environment only."""
    url = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1") + "/chat/completions"
    body = json.dumps({"model": os.environ.get("LLM_MODEL", "openai/gpt-oss-120b"), "messages": messages, "temperature": 0.6, "max_tokens": 350}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["LLM_API_KEY"], "User-Agent": "mindcare-ai/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)["choices"][0]["message"]["content"].strip()

class ChatIn(BaseModel): message: str = Field(min_length=1, max_length=1000)

def save(uid, role, content, kind="chat"):
    q("INSERT INTO chat(user_id,role,content,kind,created) VALUES(?,?,?,?,?)", (uid, role, content, kind, now()), commit=True)

@app.get("/api/chat")
def chat_get(u=Depends(me)):
    rows = q("SELECT role,content,kind FROM chat WHERE user_id=? ORDER BY id DESC LIMIT 60", (u["id"],))
    return {"configured": llm_ready(), "messages": [dict(r) for r in rows][::-1]}

@app.post("/api/chat")
def chat_post(b: ChatIn, u=Depends(me)):
    text = b.message.strip()
    if CRISIS.search(text):  # safety first: fixed, clearly labeled guidance, never sent to the LLM
        msg = (f"I am really glad you told me, and I am sorry you are hurting. You deserve support right now. "
               f"Please reach out to {HELP}, or to someone you trust who can be with you. I am not an emergency service or a professional, but I am here to listen.")
        save(u["id"], "user", text); save(u["id"], "assistant", msg, "safety")
        return {"reply": msg, "kind": "safety"}
    if not llm_ready():
        raise HTTPException(503, "The AI companion is not configured. On the backend, set LLM_API_KEY (and optionally LLM_MODEL and LLM_BASE_URL), then restart it.")
    save(u["id"], "user", text)
    hist = [dict(r) for r in q("SELECT role,content FROM chat WHERE user_id=? ORDER BY id DESC LIMIT 12", (u["id"],))][::-1]
    try: reply = llm([{"role": "system", "content": SYSTEM}] + [{"role": h["role"], "content": h["content"]} for h in hist])
    except urllib.error.HTTPError as e:
        print("LLM error", e.code, e.read().decode(errors="ignore")[:300])
        hint = {401: "The API key was rejected. Check LLM_API_KEY.", 403: "The provider blocked the request.", 404: "Model not found. Check LLM_MODEL.", 429: "Rate limit reached. Wait a minute."}.get(e.code, "The AI service returned an error.")
        raise HTTPException(502, f"{hint} (status {e.code})")
    except Exception as e:
        print("LLM error", repr(e)); raise HTTPException(502, "Could not reach the AI service. Check your internet connection and LLM_BASE_URL.")
    save(u["id"], "assistant", reply)
    return {"reply": reply, "kind": "chat"}

@app.delete("/api/chat")
def chat_clear(u=Depends(me)):
    q("DELETE FROM chat WHERE user_id=?", (u["id"],), commit=True); return {"ok": True}


# ---------------- analytics, explanations, goals ----------------
from datetime import datetime, timedelta

def _avg(rs, k):
    xs = [x[k] for x in rs if x[k] is not None]; return round(sum(xs) / len(xs), 2) if xs else None

def window_avgs(uid):
    t = time.time(); iso = lambda d: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t - d * 86400))
    rows = q("SELECT v,sleep_h,stress,created FROM mood WHERE user_id=? AND created>=?", (uid, iso(14)))
    rec = [r for r in rows if r["created"] >= iso(7)]; prev = [r for r in rows if r["created"] < iso(7)]
    out = {}
    for k, n in (("v", "mood"), ("sleep_h", "sleep"), ("stress", "stress")):
        a, b = _avg(rec, k), _avg(prev, k)
        out[n] = {"recent": a, "previous": b, "delta": round(a - b, 2) if a is not None and b is not None else None}
    out["entries"] = {"recent": len(rec), "previous": len(prev)}
    return out

@app.get("/api/analytics")
def analytics(view: str = "weekly", u=Depends(me)):
    if view not in ("daily", "weekly", "monthly"): raise HTTPException(422, "view must be daily, weekly or monthly.")
    key = {"daily": lambda d: d.strftime("%Y-%m-%d"), "weekly": lambda d: (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d"), "monthly": lambda d: d.strftime("%Y-%m")}[view]
    grp = {}
    for r in q("SELECT v,sleep_h,stress,created FROM mood WHERE user_id=? ORDER BY created", (u["id"],)):
        grp.setdefault(key(datetime.strptime(r["created"][:10], "%Y-%m-%d")), []).append(r)
    pts = [{"label": s, "mood": _avg(v, "v"), "sleep": _avg(v, "sleep_h"), "stress": _avg(v, "stress"), "n": len(v)} for s, v in sorted(grp.items())][-{"daily": 30, "weekly": 8, "monthly": 12}[view]:]
    return {"view": view, "points": pts, "changes": window_avgs(u["id"])}

PHQ_ITEMS = ["Little interest or pleasure", "Feeling down or hopeless", "Sleep problems", "Tired or low energy", "Appetite changes", "Feeling bad about yourself", "Trouble concentrating", "Slowed or restless movement", "Thoughts of self-harm"]

@app.get("/api/explain")
def explain(u=Depends(me)):
    r = q("SELECT answers,score,category,created FROM assess WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 1", (u["id"],), one=True)
    a = None
    if r:
        ans = json.loads(r["answers"])
        a = {"score": r["score"], "category": r["category"], "created": r["created"], "items": [{"name": PHQ_ITEMS[i], "value": ans[i]} for i in range(9)]}
    return {"assessment": a, "changes": window_avgs(u["id"])}

q("CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY, user_id INT, title TEXT, target INT, progress INT, created TEXT)", commit=True)
class GoalIn(BaseModel): title: str = Field(min_length=3, max_length=80); target: int = Field(7, ge=1, le=30)

@app.get("/api/goals")
def goals_list(u=Depends(me)): return [dict(r) for r in q("SELECT id,title,target,progress FROM goals WHERE user_id=? ORDER BY id DESC", (u["id"],))]

@app.post("/api/goals")
def goals_add(b: GoalIn, u=Depends(me)): return {"id": q("INSERT INTO goals(user_id,title,target,progress,created) VALUES(?,?,?,0,?)", (u["id"], b.title.strip(), b.target, now()), commit=True)}

@app.post("/api/goals/{gid}/progress")
def goals_step(gid: int, u=Depends(me)):
    before = q("SELECT title,target,progress FROM goals WHERE id=? AND user_id=?", (gid, u["id"]), one=True)
    q("UPDATE goals SET progress=MIN(target,progress+1) WHERE id=? AND user_id=?", (gid, u["id"]), commit=True)
    if before and before["progress"] + 1 == before["target"]: notify(u["id"], "Goal completed", f"You completed your goal: {before['title']}.")
    return {"ok": True}

@app.delete("/api/goals/{gid}")
def goals_del(gid: int, u=Depends(me)):
    q("DELETE FROM goals WHERE id=? AND user_id=?", (gid, u["id"]), commit=True); return {"ok": True}


# ---------------- profile, export, deletion ----------------
class NameIn(BaseModel): name: str = Field(min_length=2, max_length=80)

@app.patch("/api/me")
def rename(b: NameIn, u=Depends(me)):
    q("UPDATE users SET name=? WHERE id=?", (b.name.strip(), u["id"]), commit=True); return {**u, "name": b.name.strip()}

@app.get("/api/export")
def export(u=Depends(me)):
    g = lambda sql: [dict(r) for r in q(sql, (u["id"],))]
    return {"exported": now(), "user": u, "mood": g("SELECT v,sleep_h,stress,note,created FROM mood WHERE user_id=?"),
            "assessments": [{"score": r["score"], "category": r["category"], "answers": json.loads(r["answers"]), "created": r["created"]} for r in q("SELECT * FROM assess WHERE user_id=?", (u["id"],))],
            "goals": g("SELECT title,target,progress FROM goals WHERE user_id=?"), "chat": g("SELECT role,content,kind FROM chat WHERE user_id=?")}

@app.delete("/api/account")
def delete_account(u=Depends(me)):
    for tbl in ("mood", "assess", "chat", "goals", "alerts", "notifs", "settings", "imports", "profile", "resets"): q(f"DELETE FROM {tbl} WHERE user_id=?", (u["id"],), commit=True)
    for sql in ("DELETE FROM access WHERE patient_id=? OR clinician_id=?", "DELETE FROM access_log WHERE patient_id=? OR clinician_id=?", "DELETE FROM clinic_notes WHERE patient_id=? OR clinician_id=?"):
        q(sql, (u["id"], u["id"]), commit=True)
    q("DELETE FROM users WHERE id=?", (u["id"],), commit=True); return {"ok": True}


# ---------------- mood edit, settings, notifications, risk monitoring ----------------
@app.patch("/api/mood/{mid}")
def mood_edit(mid: int, b: MoodIn, u=Depends(me)):
    if not q("SELECT 1 FROM mood WHERE id=? AND user_id=?", (mid, u["id"]), one=True): raise HTTPException(404, "Entry not found.")
    q("UPDATE mood SET v=?,sleep_h=?,stress=?,note=? WHERE id=? AND user_id=?", (b.v, b.sleep_h, b.stress, b.note.strip(), mid, u["id"]), commit=True); return {"ok": True}

q("CREATE TABLE IF NOT EXISTS settings(user_id INTEGER PRIMARY KEY, alert_threshold INT, reminders INT)", commit=True)
q("CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY, user_id INT, kind TEXT, title TEXT, detail TEXT, status TEXT, created TEXT)", commit=True)
q("CREATE TABLE IF NOT EXISTS notifs(id INTEGER PRIMARY KEY, user_id INT, title TEXT, body TEXT, read INT DEFAULT 0, created TEXT)", commit=True)

def get_settings(uid):
    r = q("SELECT alert_threshold,reminders FROM settings WHERE user_id=?", (uid,), one=True)
    return {"alert_threshold": r["alert_threshold"], "reminders": bool(r["reminders"])} if r else {"alert_threshold": 10, "reminders": True}
def notify(uid, title, body): q("INSERT INTO notifs(user_id,title,body,read,created) VALUES(?,?,?,0,?)", (uid, title, body, now()), commit=True)
def raise_alert(uid, kind, title, detail): q("INSERT INTO alerts(user_id,kind,title,detail,status,created) VALUES(?,?,?,?,'open',?)", (uid, kind, title, detail, now()), commit=True)

class SettingsIn(BaseModel): alert_threshold: int = Field(ge=5, le=27); reminders: bool

@app.get("/api/settings")
def settings_get(u=Depends(me)): return get_settings(u["id"])

@app.put("/api/settings")
def settings_put(b: SettingsIn, u=Depends(me)):
    q("INSERT INTO settings(user_id,alert_threshold,reminders) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET alert_threshold=excluded.alert_threshold, reminders=excluded.reminders", (u["id"], b.alert_threshold, int(b.reminders)), commit=True)
    return get_settings(u["id"])

def ensure_reminder(uid):
    if not get_settings(uid)["reminders"]: return
    iso = lambda d: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - d * 86400))
    if q("SELECT 1 FROM mood WHERE user_id=? AND created>=?", (uid, iso(2)), one=True): return
    if q("SELECT 1 FROM notifs WHERE user_id=? AND title='Mood check-in reminder' AND created>=?", (uid, iso(1)), one=True): return
    notify(uid, "Mood check-in reminder", "You have not logged your mood in the last 2 days. A quick check-in keeps your trends accurate.")

@app.get("/api/notifications")
def notifs_list(u=Depends(me)):
    ensure_reminder(u["id"])
    items = [dict(r) for r in q("SELECT id,title,body,read,created FROM notifs WHERE user_id=? ORDER BY id DESC LIMIT 100", (u["id"],))]
    return {"unread": sum(1 for i in items if not i["read"]), "items": items}

@app.post("/api/notifications/read-all")
def notifs_read_all(u=Depends(me)):
    q("UPDATE notifs SET read=1 WHERE user_id=?", (u["id"],), commit=True); return {"ok": True}

@app.post("/api/notifications/{nid}/read")
def notifs_read(nid: int, u=Depends(me)):
    q("UPDATE notifs SET read=1 WHERE id=? AND user_id=?", (nid, u["id"]), commit=True); return {"ok": True}

@app.delete("/api/notifications/{nid}")
def notifs_del(nid: int, u=Depends(me)):
    q("DELETE FROM notifs WHERE id=? AND user_id=?", (nid, u["id"]), commit=True); return {"ok": True}

@app.get("/api/risk")
def risk(u=Depends(me)):
    th = get_settings(u["id"])["alert_threshold"]
    h = [dict(r) for r in q("SELECT score,category,answers,created FROM assess WHERE user_id=? ORDER BY created,id", (u["id"],))]
    last = h[-1] if h else None
    return {"threshold": th, "status": "no_data" if not last else "at_or_above" if last["score"] >= th else "below",
            "latest": {"score": last["score"], "category": last["category"], "date": last["created"][:10]} if last else None,
            "change": last["score"] - h[-2]["score"] if len(h) > 1 else None,
            "safety": bool(last and json.loads(last["answers"])[8] > 0),
            "history": [{"date": x["created"][:10], "score": x["score"]} for x in h][-20:]}

@app.get("/api/alerts")
def alerts_list(u=Depends(me)):
    return [dict(r) for r in q("SELECT id,kind,title,detail,status,created FROM alerts WHERE user_id=? ORDER BY id DESC LIMIT 100", (u["id"],))]

@app.post("/api/alerts/{aid}/{action}")
def alert_act(aid: int, action: str, u=Depends(me)):
    if action not in ("acknowledge", "dismiss"): raise HTTPException(404, "Unknown action.")
    q("UPDATE alerts SET status=? WHERE id=? AND user_id=?", ("acknowledged" if action == "acknowledge" else "dismissed", aid, u["id"]), commit=True); return {"ok": True}


# ---------------- insights, data import, FHIR export, password ----------------
import calendar
JOURNAL = ["What is one thing that went okay today, even if it was small?", "What is taking up the most space in my mind right now?",
           "What would I say to a friend who felt the way I feel today?", "What is one thing I can let go of tonight?"]

@app.get("/api/insights")
def insights(u=Depends(me)):
    uid, c, out = u["id"], window_avgs(u["id"]), []
    add = lambda cat, title, text, link=None: out.append({"category": cat, "title": title, "text": text, "link": link})
    m, s, st = c["mood"], c["sleep"], c["stress"]
    if c["entries"]["recent"] == 0: add("Mood", "Log how you feel", "No mood check-ins in the last 7 days. A quick daily check-in makes your trends meaningful.", "/dashboard/mood")
    else:
        if m["delta"] is not None and m["delta"] <= -0.5: add("Mood", "Your mood is lower than last week", f"Average mood is {m['recent']} compared with {m['previous']} the week before. Talking to someone you trust, or to Saathi, may help.", "/dashboard/companion")
        if m["delta"] is not None and m["delta"] >= 0.5: add("Mood", "Your mood is up this week", f"Average mood is {m['recent']} compared with {m['previous']} the week before. Notice what helped.")
        if s["recent"] is None: add("Sleep", "Track your sleep", "Add sleep hours to your check-ins to unlock sleep insights.", "/dashboard/mood")
        elif s["recent"] < 6: add("Sleep", "Short sleep this week", f"You averaged {s['recent']} hours. Many adults feel best with 7 to 9. A steady bedtime and a screen-free last hour can help.")
        if st["recent"] is not None and st["recent"] >= 4: add("Stress", "Stress has been high", f"Average stress was {st['recent']} out of 5. A few minutes of slow breathing in the AI companion may help.", "/dashboard/companion")
    last = q("SELECT created FROM assess WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 1", (uid,), one=True)
    if not last: add("Assessment", "Take your first PHQ-9", "It takes about two minutes and gives you a starting point to compare against.", "/dashboard/assess")
    else:
        days = int((time.time() - calendar.timegm(time.strptime(last["created"], "%Y-%m-%dT%H:%M:%SZ"))) / 86400)
        if days >= 14: add("Assessment", "Time for a new check-in", f"Your last PHQ-9 was {days} days ago. It is usually repeated every 2 weeks or so.", "/dashboard/assess")
    gs = [dict(r) for r in q("SELECT title,target,progress FROM goals WHERE user_id=?", (uid,))]
    if not gs: add("Goals", "Set one small goal", "A tiny, specific goal, like a 10 minute walk, is easier to keep.", "/dashboard/goals")
    for g in gs:
        if 0 < g["target"] - g["progress"] <= 2: add("Goals", f"Almost there: {g['title']}", f"{g['progress']} of {g['target']} days done.", "/dashboard/goals")
    pr = q("SELECT focus FROM profile WHERE user_id=?", (uid,), one=True)
    focus = (pr["focus"] or "").split(",") if pr else []
    out.sort(key=lambda i: i["category"] not in focus)  # the member's chosen focus areas come first
    return {"rule_based": True, "items": out, "prompts": JOURNAL}

q("CREATE TABLE IF NOT EXISTS imports(id INTEGER PRIMARY KEY, user_id INT, filename TEXT, source TEXT, imported INT, skipped INT, created TEXT)", commit=True)
class Bad(Exception): pass
class ImportIn(BaseModel):
    filename: str = Field(max_length=120); source: str = Field("csv", max_length=20); rows: list[dict] = Field(max_length=500)

@app.post("/api/import")
def import_rows(b: ImportIn, u=Depends(me)):
    ok, bad, today = 0, [], time.strftime("%Y-%m-%d", time.gmtime())
    for i, r in enumerate(b.rows, 1):
        try:
            d = str(r.get("date", "")).strip(); time.strptime(d, "%Y-%m-%d")
            if d > today: raise Bad("date is in the future")
            v = int(float(r.get("mood")))
            if not 1 <= v <= 5: raise Bad("mood must be 1 to 5")
            sl = r.get("sleep_hours"); sl = None if sl in (None, "") else float(sl)
            if sl is not None and not 0 <= sl <= 24: raise Bad("sleep_hours must be 0 to 24")
            st = r.get("stress"); st = None if st in (None, "") else int(float(st))
            if st is not None and not 1 <= st <= 5: raise Bad("stress must be 1 to 5")
            note = str(r.get("note") or "").strip()[:300]
            if q("SELECT 1 FROM mood WHERE user_id=? AND substr(created,1,10)=? AND v=? AND IFNULL(note,'')=?", (u["id"], d, v, note), one=True): raise Bad("duplicate of an existing entry")
        except Bad as e: bad.append({"row": i, "reason": str(e)}); continue
        except (ValueError, TypeError): bad.append({"row": i, "reason": "date must be YYYY-MM-DD and mood a number from 1 to 5"}); continue
        q("INSERT INTO mood(user_id,v,sleep_h,stress,note,created) VALUES(?,?,?,?,?,?)", (u["id"], v, sl, st, note, d + "T12:00:00Z"), commit=True); ok += 1
    q("INSERT INTO imports(user_id,filename,source,imported,skipped,created) VALUES(?,?,?,?,?,?)", (u["id"], b.filename, b.source, ok, len(bad), now()), commit=True)
    if ok: notify(u["id"], "Data imported", f"{ok} mood entries were imported from {b.filename}.")
    return {"imported": ok, "skipped_count": len(bad), "skipped": bad[:50]}

@app.get("/api/imports")
def imports_list(u=Depends(me)): return [dict(r) for r in q("SELECT filename,source,imported,skipped,created FROM imports WHERE user_id=? ORDER BY id DESC LIMIT 20", (u["id"],))]

@app.get("/api/fhir")
def fhir(u=Depends(me)):
    """FHIR R4 Bundle built from the user's own PHQ-9 results. Prototype export only: not sent to any hospital or EHR."""
    pid = f"user-{u['id']}"; tag = [{"system": "urn:mindcare", "code": "prototype-not-for-clinical-use"}]
    entries = [{"resource": {"resourceType": "Patient", "id": pid, "meta": {"tag": tag}, "name": [{"text": u["name"]}]}}]
    for r in q("SELECT id,score,category,created FROM assess WHERE user_id=? ORDER BY created,id", (u["id"],)):
        entries.append({"resource": {"resourceType": "Observation", "id": f"phq9-{r['id']}", "meta": {"tag": tag}, "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "44261-6", "display": "Patient Health Questionnaire 9 item total score [Reported]"}]},
            "subject": {"reference": f"Patient/{pid}"}, "effectiveDateTime": r["created"], "valueInteger": r["score"], "interpretation": [{"text": r["category"]}]}})
    return {"resourceType": "Bundle", "type": "collection", "meta": {"tag": tag}, "entry": entries}

class PwIn(BaseModel): current: str; new: str = Field(min_length=8, max_length=128)

@app.put("/api/me/password")
def change_pw(b: PwIn, u=Depends(me)):
    r = q("SELECT salt,hash FROM users WHERE id=?", (u["id"],), one=True)
    if not secrets.compare_digest(hpw(b.current, r["salt"]), r["hash"]): raise HTTPException(403, "Current password is incorrect.")
    salt = secrets.token_hex(16); q("UPDATE users SET salt=?, hash=? WHERE id=?", (salt, hpw(b.new, salt), u["id"]), commit=True); return {"ok": True}


# ---------------- clinician and caregiver access (consent-based) ----------------
q("CREATE TABLE IF NOT EXISTS access(id INTEGER PRIMARY KEY, patient_id INT, clinician_id INT, status TEXT, created TEXT, UNIQUE(patient_id, clinician_id))", commit=True)
q("CREATE TABLE IF NOT EXISTS clinic_notes(id INTEGER PRIMARY KEY, clinician_id INT, patient_id INT, note TEXT, created TEXT)", commit=True)
q("CREATE TABLE IF NOT EXISTS access_log(id INTEGER PRIMARY KEY, clinician_id INT, patient_id INT, created TEXT)", commit=True)

def new_user(name, email, pw, role):
    salt = secrets.token_hex(16)
    return q("INSERT INTO users(name,email,role,salt,hash,created) VALUES(?,?,?,?,?,?)", (name.strip(), email.strip().lower(), role, salt, hpw(pw, salt), now()), commit=True)

def patient(u=Depends(me)):
    if u["role"] != "Patient": raise HTTPException(403, "Only member accounts can manage sharing.")
    return u
def clin(u=Depends(me)):
    if u["role"] not in ("Doctor", "Caregiver"): raise HTTPException(403, "This area is for authorized clinicians and caregivers.")
    return u
def can_view(pid, cid): return bool(q("SELECT 1 FROM access WHERE patient_id=? AND clinician_id=? AND status='active'", (pid, cid), one=True))

class ShareIn(BaseModel): email: str = Field(max_length=120)
class NoteIn(BaseModel): note: str = Field(min_length=3, max_length=1000)

@app.get("/api/sharing")
def sharing_list(u=Depends(patient)):
    g = [dict(r) for r in q("SELECT a.clinician_id id, x.name, x.email, x.role, a.status FROM access a JOIN users x ON x.id=a.clinician_id WHERE a.patient_id=? ORDER BY a.id DESC", (u["id"],))]
    v = [dict(r) for r in q("SELECT x.name, l.created FROM access_log l JOIN users x ON x.id=l.clinician_id WHERE l.patient_id=? ORDER BY l.id DESC LIMIT 20", (u["id"],))]
    return {"grants": g, "views": v}

@app.post("/api/sharing")
def sharing_grant(b: ShareIn, u=Depends(patient)):
    c = q("SELECT id,name,role FROM users WHERE email=? AND role IN ('Doctor','Caregiver')", (b.email.strip().lower(),), one=True)
    if not c: raise HTTPException(404, "No authorized clinician or caregiver account found with that email.")
    q("INSERT INTO access(patient_id,clinician_id,status,created) VALUES(?,?,'active',?) ON CONFLICT(patient_id,clinician_id) DO UPDATE SET status='active', created=excluded.created", (u["id"], c["id"], now()), commit=True)
    notify(u["id"], "Access granted", f"{c['name']} ({c['role']}) can now see your assessment scores and your mood, sleep and stress numbers. You can revoke this any time in Profile and privacy.")
    return {"ok": True}

@app.delete("/api/sharing/{cid}")
def sharing_revoke(cid: int, u=Depends(patient)):
    q("UPDATE access SET status='revoked' WHERE patient_id=? AND clinician_id=?", (u["id"], cid), commit=True)
    notify(u["id"], "Access revoked", "A clinician or caregiver can no longer see your data."); return {"ok": True}

@app.get("/api/clinic/patients")
def clinic_patients(u=Depends(clin)):
    out = []
    for r in q("SELECT x.id,x.name FROM access a JOIN users x ON x.id=a.patient_id WHERE a.clinician_id=? AND a.status='active' ORDER BY x.name", (u["id"],)):
        last = q("SELECT score,category,created FROM assess WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 1", (r["id"],), one=True)
        out.append({"id": r["id"], "name": r["name"], "last": dict(last) if last else None, "avg7": window_avgs(r["id"])["mood"]["recent"]})
    return out

@app.get("/api/clinic/patients/{pid}")
def clinic_patient(pid: int, u=Depends(clin)):
    if not can_view(pid, u["id"]): raise HTTPException(403, "This member has not given you access, or has revoked it.")
    q("INSERT INTO access_log(clinician_id,patient_id,created) VALUES(?,?,?)", (u["id"], pid, now()), commit=True)  # patient can see this
    # Shared scope: scores, mood/sleep/stress numbers, alert count. Never chat messages or journal text.
    mood = [dict(r) for r in q("SELECT substr(created,1,10) date,v,sleep_h,stress FROM mood WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 30", (pid,))][::-1]
    return {"name": q("SELECT name FROM users WHERE id=?", (pid,), one=True)["name"], "can_note": u["role"] == "Doctor",
            "assessments": [dict(r) for r in q("SELECT substr(created,1,10) date,score,category FROM assess WHERE user_id=? ORDER BY created,id", (pid,))],
            "mood": mood, "changes": window_avgs(pid),
            "open_alerts": q("SELECT COUNT(*) n FROM alerts WHERE user_id=? AND status='open'", (pid,), one=True)["n"],
            "notes": [dict(r) for r in q("SELECT id,note,substr(created,1,10) created FROM clinic_notes WHERE patient_id=? AND clinician_id=? ORDER BY id DESC", (pid, u["id"]))]}

@app.post("/api/clinic/patients/{pid}/notes")
def clinic_note(pid: int, b: NoteIn, u=Depends(clin)):
    if u["role"] != "Doctor": raise HTTPException(403, "Only doctors can write clinical notes.")
    if not can_view(pid, u["id"]): raise HTTPException(403, "This member has not given you access, or has revoked it.")
    q("INSERT INTO clinic_notes(clinician_id,patient_id,note,created) VALUES(?,?,?,?)", (u["id"], pid, b.note.strip(), now()), commit=True); return {"ok": True}


# ---------------- onboarding and password reset (development mode) ----------------
q("CREATE TABLE IF NOT EXISTS profile(user_id INTEGER PRIMARY KEY, onboarded INT, focus TEXT, consent_at TEXT)", commit=True)
q("CREATE TABLE IF NOT EXISTS resets(id INTEGER PRIMARY KEY, user_id INT, code_hash TEXT, expires INT, used INT DEFAULT 0, created INT)", commit=True)

class OnbIn(BaseModel): consent: bool; focus: list[str] = Field(max_length=5)

@app.get("/api/onboarding")
def onb_get(u=Depends(me)):
    r = q("SELECT onboarded,focus FROM profile WHERE user_id=?", (u["id"],), one=True)
    return {"onboarded": bool(r and r["onboarded"]), "focus": (r["focus"] or "").split(",") if r and r["focus"] else []}

@app.put("/api/onboarding")
def onb_put(b: OnbIn, u=Depends(me)):
    if not b.consent: raise HTTPException(422, "Please confirm that you understand how this app works.")
    f = ",".join(x for x in b.focus if x in ("Mood", "Sleep", "Stress", "Goals"))
    q("INSERT INTO profile(user_id,onboarded,focus,consent_at) VALUES(?,1,?,?) ON CONFLICT(user_id) DO UPDATE SET onboarded=1, focus=excluded.focus, consent_at=excluded.consent_at", (u["id"], f, now()), commit=True)
    return {"ok": True}

class ForgotIn(BaseModel): email: str = Field(max_length=120)
class ResetIn(BaseModel): email: str = Field(max_length=120); code: str = Field(min_length=4, max_length=40); new_password: str = Field(min_length=8, max_length=128)
_sha = lambda s: hashlib.sha256(s.encode()).hexdigest()

@app.post("/api/auth/forgot")
def forgot(b: ForgotIn):
    """DEVELOPMENT MODE: no email service is configured, so the one-time code is printed in the backend console.
    Replace the print with an email send before any real deployment. The response never reveals whether the email exists."""
    u = q("SELECT id FROM users WHERE email=?", (b.email.strip().lower(),), one=True)
    if u and not q("SELECT 1 FROM resets WHERE user_id=? AND created>?", (u["id"], int(time.time()) - 60), one=True):
        code = secrets.token_urlsafe(6)
        q("INSERT INTO resets(user_id,code_hash,expires,used,created) VALUES(?,?,?,0,?)", (u["id"], _sha(code), int(time.time()) + 900, int(time.time())), commit=True)
        print(f"[DEV] Password reset code for {b.email.strip().lower()}: {code}  (valid 15 minutes)", flush=True)
    return {"ok": True, "message": "If an account exists for this email, a reset code was created. In this development version it appears in the backend console window."}

@app.post("/api/auth/reset")
def reset(b: ResetIn):
    u = q("SELECT id FROM users WHERE email=?", (b.email.strip().lower(),), one=True)
    r = q("SELECT id,code_hash FROM resets WHERE user_id=? AND used=0 AND expires>? ORDER BY id DESC LIMIT 1", (u["id"], int(time.time())), one=True) if u else None
    if not r or not secrets.compare_digest(_sha(b.code.strip()), r["code_hash"]): raise HTTPException(400, "Invalid or expired code.")
    salt = secrets.token_hex(16)
    q("UPDATE users SET salt=?, hash=? WHERE id=?", (salt, hpw(b.new_password, salt), u["id"]), commit=True)
    q("UPDATE resets SET used=1 WHERE user_id=?", (u["id"],), commit=True); return {"ok": True}
