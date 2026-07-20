from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
from bson import ObjectId
import bcrypt
import jwt as pyjwt
import base64
import certifi
from contextlib import asynccontextmanager

# Load .env — works locally; on Vercel, env vars are injected by the platform
load_dotenv()
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)


MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("JWT_SECRET", "bmm-super-secret-jwt-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

client = None
db = None

async def init_db():
    global client, db
    if db is not None:
        return db
        
    try:
        # Vercel AWS Lambda connections to MongoDB Atlas often hang due to CA cert issues.
        # We use tlsInsecure=True and a fast 5000ms timeout so Vercel doesn't kill the function 
        # (Vercel max execution time is 10s on free tier).
        client = AsyncIOMotorClient(
            MONGO_URI,
            tls=True,
            tlsInsecure=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=30000,
        )
        db = client.bmm_database
        await client.admin.command("ping")
        # Ensure indexes in background
        await db.employees.create_index("employee_id", unique=True)
        await db.employees.create_index("email", unique=True)
        await db.employees.create_index("mobile_number", unique=True)
        await db.attendance.create_index([("employee_id", 1), ("login_date", 1)], unique=True)
        print("[OK] Connected to MongoDB Atlas")
    except Exception as e:
        print(f"[ERROR] MongoDB connection failed: {e}")
        # db remains None, get_db() will throw 503
        db = None
        raise
    return db

app = FastAPI(
    title="BMM Backend API",
    description="FastAPI + MongoDB backend for Bheemabhai Mahila Mandali (BMM)",
    version="2.0.0",
)

# Read allowed origins from env (comma-separated) or fall back to permissive defaults
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)

# ── DB guard ─────────────────────────────────────────────────────────────────
async def get_db():
    """Dependency: returns the database, initializing it if necessary."""
    try:
        return await init_db()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database is unavailable. Please try again in a moment. ({e})",
        )

# ── Helpers ──────────────────────────────────────────────────────────────────
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_employee(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme), database=Depends(get_db)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id: str = payload.get("sub")
        if not employee_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    emp = await database.employees.find_one({"employee_id": employee_id}, {"password_hash": 0})
    if not emp:
        raise HTTPException(status_code=401, detail="Employee not found")
    emp["id"] = str(emp.pop("_id"))
    return emp

def clean_emp(emp: dict) -> dict:
    emp = dict(emp)
    emp.pop("password_hash", None)
    if "_id" in emp:
        emp["id"] = str(emp.pop("_id"))
    return emp

# ── Models ────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    employee_id: str
    full_name: str
    mobile_number: str
    email: str
    password: str
    role: str
    address: Optional[str] = None
    village: Optional[str] = None
    mandal: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    office_location: Optional[str] = None
    department: Optional[str] = None
    head: Optional[str] = None
    donor_name: Optional[str] = None
    target_villages: Optional[str] = None
    target_mandals: Optional[str] = None
    targets: Optional[str] = None
    profile_photo_b64: Optional[str] = None  # base64 encoded photo

class LoginRequest(BaseModel):
    employee_id: str
    password: str

class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    head: Optional[str] = None
    donor_name: Optional[str] = None
    department: Optional[str] = None
    target_villages: Optional[str] = None
    target_mandals: Optional[str] = None
    targets: Optional[str] = None

class CheckinRequest(BaseModel):
    employee_name: str
    role: str
    gps_latitude: float
    gps_longitude: float
    full_address: Optional[str] = None
    selfie_b64: Optional[str] = None  # base64 encoded selfie

class CheckoutRequest(BaseModel):
    gps_latitude: float
    gps_longitude: float
    full_address: Optional[str] = None
    selfie_b64: Optional[str] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "BMM Backend API v2.0 — MongoDB Connected ✅"}

@app.get("/api/health")
async def health():
    try:
        await init_db()
        await client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database ping failed: {e}")

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=201)
async def register(req: RegisterRequest, database=Depends(get_db)):
    emp_id = req.employee_id.strip().upper()

    # Check duplicates
    if await database.employees.find_one({"employee_id": emp_id}):
        raise HTTPException(status_code=400, detail="Employee ID already taken")
    if await database.employees.find_one({"email": req.email.strip().lower()}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await database.employees.find_one({"mobile_number": req.mobile_number.strip()}):
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": emp_id,
        "full_name": req.full_name.strip(),
        "mobile_number": req.mobile_number.strip(),
        "email": req.email.strip().lower(),
        "password_hash": hash_password(req.password),
        "role": req.role,
        "address": req.address or None,
        "village": req.village or None,
        "mandal": req.mandal or None,
        "district": req.district or None,
        "state": req.state or None,
        "pin_code": req.pin_code or None,
        "gender": req.gender or None,
        "date_of_birth": req.date_of_birth or None,
        "office_location": req.office_location or None,
        "department": req.department or None,
        "head": req.head or None,
        "donor_name": req.donor_name or None,
        "target_villages": req.target_villages or None,
        "target_mandals": req.target_mandals or None,
        "targets": req.targets or None,
        "profile_photo_b64": req.profile_photo_b64 or None,
        "casual_leaves": 12,
        "sick_leaves": 12,
        "joining_date": now[:10],
        "created_at": now,
        "updated_at": now,
    }
    await db.employees.insert_one(doc)
    token = create_token({"sub": emp_id})
    return {"employee_id": emp_id, "token": token, "message": "Registration successful"}

@app.post("/api/auth/login")
async def login(req: LoginRequest, database=Depends(get_db)):
    emp_id = req.employee_id.strip().upper()
    emp = await database.employees.find_one({"employee_id": emp_id})
    if not emp:
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    if not verify_password(req.password, emp["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    token = create_token({"sub": emp_id})
    return {"token": token, "employee_id": emp_id}

@app.get("/api/auth/me")
async def me(current: dict = Depends(get_current_employee)):
    return current

# ── Employees ─────────────────────────────────────────────────────────────────

@app.put("/api/employees/me")
async def update_profile(req: UpdateProfileRequest, current: dict = Depends(get_current_employee)):
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.email is not None:
        updates["email"] = req.email.strip().lower()
    if req.mobile_number is not None:
        updates["mobile_number"] = req.mobile_number.strip()
    if req.address is not None:
        updates["address"] = req.address or None
    if req.village is not None:
        updates["village"] = req.village or None
    if req.head is not None:
        updates["head"] = req.head or None
    if req.donor_name is not None:
        updates["donor_name"] = req.donor_name or None
    if req.department is not None:
        updates["department"] = req.department or None
    if req.target_villages is not None:
        updates["target_villages"] = req.target_villages or None
    if req.target_mandals is not None:
        updates["target_mandals"] = req.target_mandals or None
    if req.targets is not None:
        updates["targets"] = req.targets or None
    await db.employees.update_one(
        {"employee_id": current["employee_id"]},
        {"$set": updates}
    )
    updated = await db.employees.find_one({"employee_id": current["employee_id"]}, {"password_hash": 0})
    return clean_emp(updated)

@app.post("/api/employees/me/photo")
async def update_photo(photo: UploadFile = File(...), current: dict = Depends(get_current_employee)):
    data = await photo.read()
    b64 = base64.b64encode(data).decode()
    content_type = photo.content_type or "image/jpeg"
    b64_data_url = f"data:{content_type};base64,{b64}"
    await db.employees.update_one(
        {"employee_id": current["employee_id"]},
        {"$set": {"profile_photo_b64": b64_data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"profile_photo_b64": b64_data_url}

@app.get("/api/employees/count")
async def employee_count(current: dict = Depends(get_current_employee)):
    count = await db.employees.count_documents({})
    return {"count": count}

# ── Attendance ─────────────────────────────────────────────────────────────────

@app.post("/api/attendance/checkin", status_code=201)
async def checkin(req: CheckinRequest, current: dict = Depends(get_current_employee)):
    now = datetime.now(timezone.utc)
    
    # Sunday holiday check
    if now.weekday() == 6:
        raise HTTPException(status_code=400, detail="Today is Sunday (Holiday). Attendance cannot be marked.")
        
    today = now.strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": current["employee_id"], "login_date": today})
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already marked for today")
    now_iso = now.isoformat()
    doc = {
        "employee_id": current["employee_id"],
        "employee_name": req.employee_name,
        "role": req.role,
        "login_date": today,
        "login_time": now_iso,
        "gps_latitude": req.gps_latitude,
        "gps_longitude": req.gps_longitude,
        "full_address": req.full_address,
        "selfie_b64": req.selfie_b64 or None,
        "logout_time": None,
        "logout_selfie_b64": None,
        "logout_gps_latitude": None,
        "logout_gps_longitude": None,
        "logout_full_address": None,
        "attendance_status": "Present",
        "created_at": now_iso,
    }
    result = await db.attendance.insert_one(doc)
    return {"id": str(result.inserted_id), "login_time": now_iso, "message": "Attendance marked"}

@app.put("/api/attendance/checkout")
async def checkout(req: CheckoutRequest, current: dict = Depends(get_current_employee)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.attendance.find_one({"employee_id": current["employee_id"], "login_date": today})
    if not record:
        raise HTTPException(status_code=404, detail="No check-in found for today")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.attendance.update_one(
        {"employee_id": current["employee_id"], "login_date": today},
        {"$set": {
            "logout_time": now_iso,
            "logout_selfie_b64": req.selfie_b64 or None,
            "logout_gps_latitude": req.gps_latitude,
            "logout_gps_longitude": req.gps_longitude,
            "logout_full_address": req.full_address,
        }}
    )
    return {"logout_time": now_iso, "message": "Logout recorded"}

@app.get("/api/attendance/today")
async def attendance_today(current: dict = Depends(get_current_employee)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.attendance.find_one({"employee_id": current["employee_id"], "login_date": today})
    if not record:
        return None
    record["id"] = str(record.pop("_id"))
    return record

@app.get("/api/attendance/history")
async def attendance_history(current: dict = Depends(get_current_employee)):
    query = {"employee_id": current["employee_id"]}
    if current.get("role", "").upper() != "ADMIN":
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": thirty_days_ago}
        
    records = []
    async for r in db.attendance.find(query, sort=[("login_date", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records

@app.get("/api/attendance/all")
async def all_attendance(current: dict = Depends(get_current_employee)):
    """All attendance records (for admin/reports)"""
    records = []
    async for r in db.attendance.find({}, sort=[("login_date", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records

# ── Activities ────────────────────────────────────────────────────────────────

class ActivityIn(BaseModel):
    employee_id: Optional[str] = None
    date: str
    meetings_conducted: Optional[str] = None
    remarks: Optional[str] = None

@app.post("/api/activities", status_code=201)
async def create_activity(req: ActivityIn, current: dict = Depends(get_current_employee)):
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": req.employee_id or current["employee_id"],
        "date": req.date,
        "meetings_conducted": req.meetings_conducted or "",
        "remarks": req.remarks or "",
        "created_at": now_iso,
    }
    result = await db.activities.insert_one(doc)
    return {"id": str(result.inserted_id)}

@app.get("/api/activities")
async def get_activities(current: dict = Depends(get_current_employee)):
    query = {"employee_id": current["employee_id"]}
    if current.get("role", "").upper() != "ADMIN":
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": thirty_days_ago}
        
    records = []
    async for r in db.activities.find(query, sort=[("date", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records

# ── Leaves ────────────────────────────────────────────────────────────────────

class LeaveIn(BaseModel):
    leave_date: str
    leave_type: str
    reason: Optional[str] = None
    status: Optional[str] = "Approved"
    image_b64: Optional[str] = None

@app.post("/api/leaves", status_code=201)
async def create_leave(req: LeaveIn, current: dict = Depends(get_current_employee)):
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": current["employee_id"],
        "leave_date": req.leave_date,
        "leave_type": req.leave_type,
        "reason": req.reason or "",
        "status": req.status or "Approved",
        "image_b64": req.image_b64 or None,
        "created_at": now_iso,
    }
    result = await db.leaves.insert_one(doc)
    return {"id": str(result.inserted_id)}

@app.get("/api/leaves")
async def get_leaves(current: dict = Depends(get_current_employee)):
    query = {"employee_id": current["employee_id"]}
    if current.get("role", "").upper() != "ADMIN":
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": thirty_days_ago}
        
    records = []
    async for r in db.leaves.find(query, sort=[("leave_date", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records

# ── Reports ───────────────────────────────────────────────────────────────────

class ReportIn(BaseModel):
    date: str
    report_type: str
    description: Optional[str] = None
    image_url_1: Optional[str] = None
    image_url_2: Optional[str] = None

@app.post("/api/reports", status_code=201)
async def create_report(req: ReportIn, current: dict = Depends(get_current_employee)):
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": current["employee_id"],
        "date": req.date,
        "report_type": req.report_type,
        "description": req.description or "",
        "image_url_1": req.image_url_1,
        "image_url_2": req.image_url_2,
        "created_at": now_iso,
    }
    result = await db.reports.insert_one(doc)
    return {"id": str(result.inserted_id)}

@app.get("/api/reports")
async def get_reports(current: dict = Depends(get_current_employee)):
    query = {"employee_id": current["employee_id"]}
    if current.get("role", "").upper() != "ADMIN":
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": thirty_days_ago}
        
    records = []
    async for r in db.reports.find(query, sort=[("date", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records

# ── Daily Updates ─────────────────────────────────────────────────────────────

class DailyUpdateIn(BaseModel):
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    notes: Optional[str] = None
    images: Optional[List[str]] = []

@app.post("/api/daily-updates", status_code=201)
async def create_daily_update(req: DailyUpdateIn, current: dict = Depends(get_current_employee)):
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": req.employee_id or current["employee_id"],
        "employee_name": req.employee_name or current.get("full_name", ""),
        "notes": req.notes or "",
        "images": req.images or [],
        "created_at": now_iso,
    }
    result = await db.daily_updates.insert_one(doc)
    return {"id": str(result.inserted_id)}

@app.get("/api/daily-updates")
async def get_daily_updates(current: dict = Depends(get_current_employee)):
    query = {"employee_id": current["employee_id"]}
    if current.get("role", "").upper() != "ADMIN":
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": thirty_days_ago}
        
    records = []
    async for r in db.daily_updates.find(query, sort=[("created_at", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records


# ── Cron Jobs ─────────────────────────────────────────────────────────────────

@app.get("/api/cron/daily")
async def daily_cron(database=Depends(get_db)):
    """
    To be triggered daily (e.g. at midnight) by Vercel Cron.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    # 1. On the 1st of every month, minus one casual leave and sick leave for everyone
    if now.day == 1:
        await database.employees.update_many(
            {},
            {"$inc": {"casual_leaves": -1, "sick_leaves": -1}}
        )

    # 2. Process yesterday's missing check-outs
    missing_checkouts = database.attendance.find({"login_date": yesterday, "logout_time": None})
    async for record in missing_checkouts:
        emp_id = record["employee_id"]
        emp = await database.employees.find_one({"employee_id": emp_id})
        
        if not emp:
            continue
            
        casual_leaves = emp.get("casual_leaves", 0)
        
        if casual_leaves > 0:
            # Minus the casual leave
            await database.employees.update_one(
                {"employee_id": emp_id},
                {"$inc": {"casual_leaves": -1}}
            )
        else:
            # Next day repeat the process is mark as absent list
            # If they have no casual leaves left, mark today as Absent
            existing_today = await database.attendance.find_one({"employee_id": emp_id, "login_date": today})
            if not existing_today:
                absent_doc = {
                    "employee_id": emp_id,
                    "employee_name": record.get("employee_name", ""),
                    "role": record.get("role", ""),
                    "login_date": today,
                    "login_time": None,
                    "logout_time": None,
                    "attendance_status": "Absent",
                    "remarks": "Marked absent due to missing check-out yesterday and 0 casual leaves remaining.",
                    "created_at": now.isoformat(),
                }
                await database.attendance.insert_one(absent_doc)

    # 3. Clean up images older than 20 days
    date_20_days_ago = (now - timedelta(days=20)).isoformat()
    await database.leaves.update_many({"created_at": {"$lt": date_20_days_ago}}, {"$unset": {"image_b64": ""}})
    await database.attendance.update_many({"created_at": {"$lt": date_20_days_ago}}, {"$unset": {"selfie_b64": "", "logout_selfie_b64": ""}})
    await database.daily_updates.update_many({"created_at": {"$lt": date_20_days_ago}}, {"$set": {"images": []}})
    await database.reports.update_many({"created_at": {"$lt": date_20_days_ago}}, {"$unset": {"image_url_1": "", "image_url_2": ""}})

    # 4. Clean up all records older than 6 months (180 days)
    date_180_days_ago = (now - timedelta(days=180)).isoformat()
    await database.leaves.delete_many({"created_at": {"$lt": date_180_days_ago}})
    await database.attendance.delete_many({"created_at": {"$lt": date_180_days_ago}})
    await database.activities.delete_many({"created_at": {"$lt": date_180_days_ago}})
    await database.daily_updates.delete_many({"created_at": {"$lt": date_180_days_ago}})
    await database.reports.delete_many({"created_at": {"$lt": date_180_days_ago}})

    return {"message": "Daily cron job completed successfully."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
