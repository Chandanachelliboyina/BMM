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
import uuid
import re
from contextlib import asynccontextmanager

# Load .env — works locally; on Vercel, env vars are injected by the platform
load_dotenv(override=True)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)


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
        emp = await database.employees.find_one({"employee_id": re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)}, {"password_hash": 0})
    if not emp:
        raise HTTPException(status_code=401, detail="Employee not found")
    if emp.get("has_access", True) == False:
        raise HTTPException(status_code=403, detail="admin not give grant access to view your dashboard")
    emp["id"] = str(emp.pop("_id"))
    return emp
def get_current_fin_year():
    now = datetime.now(timezone.utc)
    if now.month >= 4:
        return str(now.year)
    return str(now.year - 1)

def get_current_fin_year_int() -> int:
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 4 else now.year - 1

def compute_months_earned_for_fy(fy_start_year: int, join_date_str: str = None) -> int:
    """Calculate the number of earned months in a given financial year.
    Starts from April (or join month if later).
    Ends at March (or current month if it's the current FY)."""
    
    fy_start_date = datetime(fy_start_year, 4, 1, tzinfo=timezone.utc)
    fy_end_date = datetime(fy_start_year + 1, 3, 31, 23, 59, 59, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    if now < fy_start_date:
        return 0
    elif now > fy_end_date:
        end_date = fy_end_date
    else:
        end_date = now
        
    start_date = fy_start_date
    if join_date_str:
        try:
            join_date_obj = datetime.fromisoformat(join_date_str.replace("Z", "+00:00")) if "T" in join_date_str else datetime.strptime(join_date_str, "%Y-%m-%d")
            # Convert naive to aware if necessary
            if join_date_obj.tzinfo is None:
                join_date_obj = join_date_obj.replace(tzinfo=timezone.utc)
                
            if join_date_obj > fy_end_date:
                return 0
            if join_date_obj > fy_start_date:
                start_date = join_date_obj
        except (ValueError, TypeError):
            pass
            
    months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
    return max(0, months)

def get_fin_year_start():
    """Return the April 1 date string of the current financial year."""
    now = datetime.now(timezone.utc)
    if now.month >= 4:
        return f"{now.year}-04-01"
    else:
        return f"{now.year - 1}-04-01"

async def compute_leave_usage(employee_id: str):
    """Count approved leaves for the current FY from the leaves collection."""
    fin_start = get_fin_year_start()
    casual_used = 0
    sick_used = 0
    async for leave in db.leaves.find({
        "employee_id": employee_id,
        "status": "Approved",
        "leave_date": {"$gte": fin_start}
    }):
        lt = leave.get("leave_type", "").upper()
        if "CASUAL" in lt:
            casual_used += 1
        elif "SICK" in lt:
            sick_used += 1
    return casual_used, sick_used

async def inject_leave_balances(emp: dict):
    """Compute leave balances dynamically: earned (months elapsed) - used (approved leaves)."""
    months_earned = compute_months_earned_for_fy(get_current_fin_year_int(), emp.get("created_at"))
    casual_used, sick_used = await compute_leave_usage(emp.get("employee_id", ""))
    
    # Check for admin overrides stored in leave_balances
    fin_year = get_current_fin_year()
    overrides = emp.get("leave_balances", {}).get(fin_year, {})
    extra_casual = overrides.get("extra_casual", 0)
    extra_sick = overrides.get("extra_sick", 0)
    
    emp["casual_leaves"] = max(0, months_earned + extra_casual - casual_used)
    emp["sick_leaves"] = max(0, months_earned + extra_sick - sick_used)
    emp["casual_earned"] = months_earned + extra_casual
    emp["sick_earned"] = months_earned + extra_sick
    emp["casual_used"] = casual_used
    emp["sick_used"] = sick_used
    return emp

async def clean_emp(emp: dict) -> dict:
    emp = dict(emp)
    emp.pop("password_hash", None)
    if "_id" in emp:
        emp["id"] = str(emp.pop("_id"))
    return await inject_leave_balances(emp)

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

class PasswordResetRequestModel(BaseModel):
    employee_id: str
    email: str

class SetNewPasswordRequest(BaseModel):
    new_password: str

class ResetWithApprovalModel(BaseModel):
    employee_id: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    role: Optional[str] = None
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

class HolidayCreate(BaseModel):
    start_date: str
    end_date: str
    name: str
    remarks: Optional[str] = None

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

# ── Holidays ──────────────────────────────────────────────────────────────────

@app.post("/api/holidays", status_code=201)
async def create_holiday(req: HolidayCreate, current: dict = Depends(get_current_employee)):
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "start_date": req.start_date,
        "end_date": req.end_date,
        "name": req.name,
        "remarks": req.remarks,
        "created_by": current["employee_id"],
        "created_at": now_iso
    }
    result = await db.holidays.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@app.get("/api/holidays")
async def get_holidays(current: dict = Depends(get_current_employee)):
    records = []
    async for r in db.holidays.find():
        r["id"] = str(r.pop("_id"))
        # Normalize: old records use from_date/to_date/type, new use start_date/end_date/remarks
        if "from_date" in r and "start_date" not in r:
            r["start_date"] = r.pop("from_date")
        if "to_date" in r and "end_date" not in r:
            r["end_date"] = r.pop("to_date")
        if "type" in r and "remarks" not in r:
            r["remarks"] = r.pop("type")
        elif "type" in r:
            r.pop("type", None)
        records.append(r)
    # Sort by start_date ascending
    records.sort(key=lambda x: x.get("start_date", ""))
    return records

@app.delete("/api/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str, current: dict = Depends(get_current_employee)):
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.holidays.delete_one({"_id": ObjectId(holiday_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=201)
async def register(req: RegisterRequest, database=Depends(get_db)):
    emp_id = req.employee_id.strip().upper()

    # Check duplicates and existing accounts created by admin
    existing_emp = await database.employees.find_one({"employee_id": emp_id})
    if existing_emp:
        # If the existing employee doesn't have a password hash, it means they were created by admin
        # and this is their first time registering on the portal, so we let them claim the account.
        if "password_hash" in existing_emp and existing_emp["password_hash"]:
            raise HTTPException(status_code=400, detail="Employee ID already taken")
    
    # We only check for email/mobile conflicts if they belong to a different employee
    existing_email = await database.employees.find_one({"email": req.email.strip().lower()})
    if existing_email and existing_email["employee_id"] != emp_id:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    existing_mobile = await database.employees.find_one({"mobile_number": req.mobile_number.strip()})
    if existing_mobile and existing_mobile["employee_id"] != emp_id:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    now = datetime.now(timezone.utc)
    current_month = now.month
    if current_month >= 4:
        remaining_months = 12 - (current_month - 4)
    else:
        remaining_months = 4 - current_month

    now_iso = now.isoformat()
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
        "casual_leaves": remaining_months,
        "sick_leaves": remaining_months,
        "joining_date": now_iso[:10],
        "updated_at": now_iso,
        "has_access": True, # Ensure access is granted when they register
    }
    
    if existing_emp:
        await database.employees.update_one({"employee_id": emp_id}, {"$set": doc})
    else:
        doc["created_at"] = now_iso
        await database.employees.insert_one(doc)
    token = create_token({"sub": emp_id})
    return {"employee_id": emp_id, "token": token, "message": "Registration successful"}

@app.post("/api/auth/login")
async def login(req: LoginRequest, database=Depends(get_db)):
    emp_id = req.employee_id.strip().upper()
    emp = await database.employees.find_one({"employee_id": emp_id})
    if not emp:
        emp = await database.employees.find_one({"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE)})
    if not emp:
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    if emp.get("has_access", True) == False:
        raise HTTPException(status_code=403, detail="admin not give grant access to view your dashboard")
    if not verify_password(req.password, emp["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    real_emp_id = emp.get("employee_id", emp_id)
    token = create_token({"sub": real_emp_id})
    return {"token": token, "employee_id": real_emp_id}

# ── Password Reset (Admin-Approval Flow) ────────────────────────────────────

@app.post("/api/auth/forgot-password/request")
async def submit_password_reset_request(req: PasswordResetRequestModel, database=Depends(get_db)):
    """Employee submits a password reset request. Admin must approve before they can set a new password."""
    emp_id = req.employee_id.strip().upper()
    emp = await database.employees.find_one({"employee_id": emp_id})

    if not emp:
        raise HTTPException(status_code=404, detail="Employee ID not found")

    if emp.get("email", "").strip().lower() != req.email.strip().lower():
        raise HTTPException(status_code=400, detail="Email does not match our records")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Cancel any existing pending request for this employee
    await database.password_reset_requests.update_many(
        {"employee_id": emp_id, "status": "pending"},
        {"$set": {"status": "cancelled", "reviewed_at": now_iso}}
    )

    # Create new request document
    doc = {
        "employee_id": emp_id,
        "full_name": emp.get("full_name", ""),
        "email": req.email.strip().lower(),
        "status": "pending",
        "created_at": now_iso,
        "reviewed_at": None,
        "reviewed_by": None,
    }
    result = await database.password_reset_requests.insert_one(doc)

    # Clear any existing approval flag on the employee
    await database.employees.update_one(
        {"employee_id": emp_id},
        {"$set": {"password_reset_approved": False, "updated_at": now_iso}}
    )

    return {"message": "Password reset request submitted. Please wait for admin approval.", "request_id": str(result.inserted_id)}


@app.get("/api/auth/forgot-password/requests")
async def list_password_reset_requests(current: dict = Depends(get_current_employee)):
    """Admin only: List all pending password reset requests."""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    records = []
    async for r in db.password_reset_requests.find({"status": "pending"}, sort=[("created_at", -1)]):
        r["id"] = str(r.pop("_id"))
        records.append(r)
    return records


@app.put("/api/auth/forgot-password/requests/{request_id}/approve")
async def approve_password_reset(request_id: str, current: dict = Depends(get_current_employee), database=Depends(get_db)):
    """Admin only: Approve a password reset request, allowing the employee to set a new password."""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req_doc = await database.password_reset_requests.find_one({"_id": oid})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    await database.password_reset_requests.update_one(
        {"_id": oid},
        {"$set": {"status": "approved", "reviewed_at": now_iso, "reviewed_by": current["employee_id"]}}
    )

    # Grant the approval flag on the employee
    emp_id = req_doc["employee_id"]
    await database.employees.update_one(
        {"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE)},
        {"$set": {"password_reset_approved": True, "updated_at": now_iso}}
    )

    return {"message": f"Password reset approved for {emp_id}"}


@app.put("/api/auth/forgot-password/requests/{request_id}/reject")
async def reject_password_reset(request_id: str, current: dict = Depends(get_current_employee), database=Depends(get_db)):
    """Admin only: Reject a password reset request."""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req_doc = await database.password_reset_requests.find_one({"_id": oid})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    await database.password_reset_requests.update_one(
        {"_id": oid},
        {"$set": {"status": "rejected", "reviewed_at": now_iso, "reviewed_by": current["employee_id"]}}
    )

    # Ensure the approval flag is cleared
    emp_id = req_doc["employee_id"]
    await database.employees.update_one(
        {"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE)},
        {"$set": {"password_reset_approved": False, "updated_at": now_iso}}
    )

    return {"message": f"Password reset rejected for {emp_id}"}


@app.post("/api/auth/forgot-password/set-password")
async def set_new_password_after_approval(req: SetNewPasswordRequest, current: dict = Depends(get_current_employee), database=Depends(get_db)):
    """Authenticated employee: Set a new password after admin has approved the reset request."""
    if not current.get("password_reset_approved", False):
        raise HTTPException(status_code=403, detail="Password reset not approved by admin yet")

    new_hash = hash_password(req.new_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    await database.employees.update_one(
        {"employee_id": current["employee_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "password_reset_approved": False,
                "updated_at": now_iso,
            },
            "$unset": {"reset_token": "", "reset_token_expiry": ""}
        }
    )

    # Mark all approved requests for this employee as completed
    await database.password_reset_requests.update_many(
        {"employee_id": current["employee_id"], "status": "approved"},
        {"$set": {"status": "completed", "reviewed_at": now_iso}}
    )

    return {"message": "Password updated successfully"}


@app.get("/api/auth/forgot-password/check-status")
async def check_password_reset_status(employee_id: str, database=Depends(get_db)):
    """Check if admin has approved password reset for a given employee_id."""
    emp_id = employee_id.strip().upper()
    emp = await database.employees.find_one({"employee_id": emp_id})
    if not emp:
        emp = await database.employees.find_one({"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE)})
    
    if not emp:
        return {"approved": False, "status": "not_found", "message": f"Employee ID '{emp_id}' not found in database"}
    
    real_emp_id = emp.get("employee_id", emp_id)

    if emp.get("password_reset_approved", False):
        return {"approved": True, "status": "approved", "employee_id": real_emp_id, "employee_name": emp.get("full_name", "")}
    
    req_doc = await database.password_reset_requests.find_one(
        {"employee_id": real_emp_id, "status": "approved"}
    )
    if req_doc:
        return {"approved": True, "status": "approved", "employee_id": real_emp_id, "employee_name": emp.get("full_name", "")}
    
    pending_req = await database.password_reset_requests.find_one(
        {"employee_id": real_emp_id, "status": "pending"}
    )
    if pending_req:
        return {"approved": False, "status": "pending", "message": "Your request is still waiting for Admin approval. Admin must click Approve in the Database tab."}
        
    return {"approved": False, "status": "none", "message": "No active password reset request found. Please submit a request first."}


@app.post("/api/auth/forgot-password/reset-with-approval")
async def reset_password_with_approval(req: ResetWithApprovalModel, database=Depends(get_db)):
    """Public endpoint: Allows an employee to set a new password if Admin has approved their reset request."""
    emp_id = req.employee_id.strip().upper()
    emp = await database.employees.find_one({"employee_id": emp_id})
    if not emp:
        emp = await database.employees.find_one({"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE)})

    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    real_emp_id = emp.get("employee_id", emp_id)
    is_approved = emp.get("password_reset_approved", False)
    if not is_approved:
        req_doc = await database.password_reset_requests.find_one(
            {"employee_id": real_emp_id, "status": "approved"}
        )
        if req_doc:
            is_approved = True

    if not is_approved:
        raise HTTPException(status_code=403, detail="Password reset request has not been approved by Admin yet.")

    new_hash = hash_password(req.new_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    await database.employees.update_one(
        {"employee_id": real_emp_id},
        {
            "$set": {
                "password_hash": new_hash,
                "password_reset_approved": False,
                "updated_at": now_iso,
            }
        }
    )

    await database.password_reset_requests.update_many(
        {"employee_id": real_emp_id, "status": {"$in": ["approved", "pending"]}},
        {"$set": {"status": "completed", "reviewed_at": now_iso}}
    )

    return {"message": "Password updated successfully! You can now log in."}


@app.get("/api/auth/me")
async def me(current: dict = Depends(get_current_employee), database=Depends(get_db)):
    emp_id = current.get("employee_id", "")
    if emp_id:
        req_approved = await database.password_reset_requests.find_one(
            {"employee_id": re.compile(f"^{re.escape(emp_id)}$", re.IGNORECASE), "status": "approved"}
        )
        if req_approved:
            current["password_reset_approved"] = True
    return current

# ── Employees ─────────────────────────────────────────────────────────────────

@app.put("/api/employees/me")
async def update_profile(req: UpdateProfileRequest, current: dict = Depends(get_current_employee)):
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.email is not None:
        updates["email"] = req.email.strip().lower()
    if req.mobile_number is not None:
        updates["mobile_number"] = req.mobile_number.strip()
    if req.role is not None:
        updates["role"] = req.role.strip()
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
    return await clean_emp(updated)

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

@app.get("/api/employees")
async def get_all_employees(current: dict = Depends(get_current_employee)):
    """Fetch all employees (Admin only)"""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    records = []
    async for emp in db.employees.find({}, {"password_hash": 0}, sort=[("full_name", 1)]):
        cleaned_emp = await clean_emp(emp)
        records.append(cleaned_emp)
    return records

@app.put("/api/employees/{employee_id}/allow-late-signin")
async def toggle_late_signin(employee_id: str, payload: dict, current: dict = Depends(get_current_employee)):
    """Admin only: Toggle late signin allowance for an employee"""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    allow = payload.get("allow_late_signin", False)
    
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"allow_late_signin": allow}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    return {"message": "Late sign-in updated", "allow_late_signin": allow}


@app.put("/api/employees/{employee_id}/access")
async def toggle_access(employee_id: str, payload: dict, current: dict = Depends(get_current_employee)):
    """Admin only: Toggle dashboard access for an employee"""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    has_access = payload.get("has_access", True)
    
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"has_access": has_access}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    return {"message": "Access updated", "has_access": has_access}


@app.put("/api/employees/{employee_id}/leaves")
async def update_employee_leaves(employee_id: str, payload: dict, current: dict = Depends(get_current_employee)):
    """Admin only: Update leave balances for an employee"""
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    casual_leaves = payload.get("casual_leaves")
    sick_leaves = payload.get("sick_leaves")
    
    fin_year = get_current_fin_year()
    
    # Get current balances for calculation and audit log
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    months_earned = compute_months_earned_for_fy(get_current_fin_year_int(), emp.get("created_at"))
    casual_used, sick_used = await compute_leave_usage(employee_id)
    
    updates = {}
    if casual_leaves is not None:
        # Calculate extra_casual needed to achieve the target casual_leaves
        extra_casual = int(casual_leaves) - months_earned + casual_used
        updates[f"leave_balances.{fin_year}.extra_casual"] = extra_casual
        updates[f"leave_balances.{fin_year}.casual"] = int(casual_leaves)
        
    if sick_leaves is not None:
        # Calculate extra_sick needed to achieve the target sick_leaves
        extra_sick = int(sick_leaves) - months_earned + sick_used
        updates[f"leave_balances.{fin_year}.extra_sick"] = extra_sick
        updates[f"leave_balances.{fin_year}.sick"] = int(sick_leaves)
        
    if not updates:
        raise HTTPException(status_code=400, detail="No leave updates provided")
        
    old_casual = emp.get("leave_balances", {}).get(fin_year, {}).get("casual", 0)
    old_sick = emp.get("leave_balances", {}).get(fin_year, {}).get("sick", 0)
        
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": updates}
    )
    
    # Insert audit log
    await db.audit_logs.insert_one({
        "action": "BALANCE_UPDATED",
        "admin_id": current["employee_id"],
        "target_employee_id": employee_id,
        "details": f"Updated balance for {fin_year}. Casual: {old_casual}->{casual_leaves}, Sick: {old_sick}->{sick_leaves}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Leave balances updated"}


# ── Attendance ─────────────────────────────────────────────────────────────────

@app.post("/api/attendance/checkin", status_code=201)
async def checkin(req: CheckinRequest, current: dict = Depends(get_current_employee)):
    now = datetime.now(timezone.utc)
    
    # IST is UTC+5:30
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = now.astimezone(ist_tz)
    
    # Sunday holiday check
    if now_ist.weekday() == 6:
        raise HTTPException(status_code=400, detail="Today is Sunday (Holiday). Attendance cannot be marked.")
        
    today = now_ist.strftime("%Y-%m-%d")
    
    # Declared holiday check
    holiday = await db.holidays.find_one({"start_date": {"$lte": today}, "end_date": {"$gte": today}})
    if holiday:
        raise HTTPException(status_code=400, detail=f"Today is a Holiday ({holiday['name']}). Attendance cannot be marked.")
    
    # ── Time Constraint Logic ──
    # Regular sign-in: 09:00 to 10:00
    if now_ist.hour < 9:
        raise HTTPException(status_code=400, detail="Check-in starts at 9:00 AM.")
        
    allow_late = current.get("allow_late_signin", False)
    
    if now_ist.hour >= 10:
        # If it's exactly 10:00:xx, we treat it as past 10 AM limit 
        if not allow_late or str(allow_late).lower() == "false":
            raise HTTPException(status_code=403, detail="Sign-in time is over (10:00 AM). Please contact Admin for permission.")
        else:
            # Late signin allowed up to the specified time string, e.g., "11:30"
            try:
                allowed_hour, allowed_minute = map(int, str(allow_late).split(":"))
                is_late = False
                if now_ist.hour > allowed_hour:
                    is_late = True
                elif now_ist.hour == allowed_hour and now_ist.minute > allowed_minute:
                    is_late = True
                    
                if is_late:
                    # Explicitly mark absent
                    absent_doc = {
                        "employee_id": current["employee_id"],
                        "employee_name": req.employee_name,
                        "role": req.role,
                        "login_date": today,
                        "login_time": None,
                        "logout_time": None,
                        "attendance_status": "Absent",
                        "remarks": f"Marked absent (tried to sign in after allowed late time {allow_late}).",
                        "created_at": now.isoformat(),
                    }
                    existing_absent = await db.attendance.find_one({"employee_id": current["employee_id"], "login_date": today})
                    if not existing_absent:
                        await db.attendance.insert_one(absent_doc)
                    
                    # Reset the flag so they can't try again
                    await db.employees.update_one(
                        {"employee_id": current["employee_id"]},
                        {"$set": {"allow_late_signin": False}}
                    )
                    raise HTTPException(status_code=403, detail=f"Late sign-in period ({allow_late}) is over. Marked as absent.")
            except ValueError:
                # Fallback if allow_late is malformed
                if now_ist.hour > 10 or (now_ist.hour == 10 and now_ist.minute > 30):
                    raise HTTPException(status_code=403, detail="Late sign-in period (10:30 AM) is over.")
                
    # ───────────────────────────
        
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
        "attendance_status": "Incomplete",
        "created_at": now_iso,
    }
    result = await db.attendance.insert_one(doc)
    
    # If late signin was used, automatically revoke it for next time
    if allow_late:
        await db.employees.update_one(
            {"employee_id": current["employee_id"]},
            {"$set": {"allow_late_signin": False}}
        )
        
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
            "attendance_status": "Present",
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
        "status": req.status if req.status and req.status != "Approved" else "Pending",
        "image_b64": req.image_b64 or None,
        "created_at": now_iso,
    }
    result = await db.leaves.insert_one(doc)
    return {"id": str(result.inserted_id)}

class LeaveStatusUpdate(BaseModel):
    status: str

@app.put("/api/leaves/{leave_id}/status")
async def update_leave_status(leave_id: str, req: LeaveStatusUpdate, current: dict = Depends(get_current_employee)):
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can update leave status")
    
    leave = await db.leaves.find_one({"_id": ObjectId(leave_id)})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
        
    old_status = leave.get("status", "Pending")
    new_status = req.status
    
    # If transitioning to Approved, validate balance
    if old_status != "Approved" and new_status == "Approved":
        months_earned = compute_months_earned_for_fy(get_current_fin_year_int(), current.get("created_at"))
        casual_used, sick_used = await compute_leave_usage(leave["employee_id"])
        
        leave_type_upper = leave["leave_type"].upper()
        if "CASUAL" in leave_type_upper:
            remaining = months_earned - casual_used
            if remaining < 1:
                raise HTTPException(status_code=400, detail="Insufficient casual leave balance for this financial year")
            # Audit log
            await db.audit_logs.insert_one({
                "action": "LEAVE_APPROVED",
                "admin_id": current["employee_id"],
                "target_employee_id": leave["employee_id"],
                "details": f"Approved 1 Casual leave. Earned: {months_earned}, Used after: {casual_used + 1}, Remaining: {remaining - 1}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
        elif "SICK" in leave_type_upper:
            remaining = months_earned - sick_used
            if remaining < 1:
                raise HTTPException(status_code=400, detail="Insufficient sick leave balance for this financial year")
            # Audit log
            await db.audit_logs.insert_one({
                "action": "LEAVE_APPROVED",
                "admin_id": current["employee_id"],
                "target_employee_id": leave["employee_id"],
                "details": f"Approved 1 Sick leave. Earned: {months_earned}, Used after: {sick_used + 1}, Remaining: {remaining - 1}",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
        # Push to attendance collection
        emp = await db.employees.find_one({"employee_id": leave["employee_id"]})
        if emp and leave.get("leave_date"):
            leave_date = leave["leave_date"]
            attendance_doc = {
                "employee_id": leave["employee_id"],
                "employee_name": emp.get("full_name", leave["employee_id"]),
                "role": emp.get("role", ""),
                "login_date": leave_date,
                "attendance_status": f"On Leave ({leave.get('leave_type')})",
                "remarks": f"Approved {leave.get('leave_type')} leave",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.attendance.update_one(
                {"employee_id": leave["employee_id"], "login_date": leave_date},
                {"$set": attendance_doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
            
    if old_status == "Approved" and new_status != "Approved":
        # Remove the attendance record if it was marked as On Leave
        if leave.get("leave_date"):
            await db.attendance.delete_one({
                "employee_id": leave["employee_id"], 
                "login_date": leave["leave_date"],
                "attendance_status": {"$regex": "On Leave"}
            })
            
    if new_status == "Rejected":
        await db.audit_logs.insert_one({
            "action": "LEAVE_REJECTED",
            "admin_id": current["employee_id"],
            "target_employee_id": leave["employee_id"],
            "details": f"Rejected 1 {leave.get('leave_type')} leave.",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    await db.leaves.update_one({"_id": ObjectId(leave_id)}, {"$set": {"status": new_status}})
    return {"message": f"Leave status updated to {new_status}"}

@app.get("/api/leaves")
async def get_leaves(year: Optional[int] = None, current: dict = Depends(get_current_employee)):
    query = {}
    
    now = datetime.now(timezone.utc)
    
    # Determine financial year from optional year param
    if year is not None:
        fy_start_year = year
    else:
        fy_start_year = now.year if now.month >= 4 else now.year - 1
    fy_end_year = fy_start_year + 1
    
    fin_year_start = f"{fy_start_year}-04-01"
    fin_year_end = f"{fy_end_year}-03-31"
    
    query["leave_date"] = {"$gte": fin_year_start, "$lte": fin_year_end}
    
    if current.get("role", "").upper() != "ADMIN":
        query["employee_id"] = current["employee_id"]
        
    records = []
    async for r in db.leaves.find(query, sort=[("leave_date", -1)]):
        r["id"] = str(r.pop("_id"))
        # Include employee name for admin view
        if current.get("role", "").upper() == "ADMIN" and r.get("employee_id"):
            emp = await db.employees.find_one({"employee_id": r["employee_id"]}, {"full_name": 1})
            r["employee_name"] = emp.get("full_name", r["employee_id"]) if emp else r["employee_id"]
        records.append(r)
    return records

@app.get("/api/leaves/balance-summary")
async def get_leave_balance_summary(year: Optional[int] = None, current: dict = Depends(get_current_employee)):
    """Month-wise leave breakdown for a financial year.
    Pass ?year=2025 for FY 2025-26, etc. Defaults to current FY.
    Returns allocation (1 per month) and usage per month from April to March."""
    
    now = datetime.now(timezone.utc)
    employee_id = current["employee_id"]
    
    # Determine financial year from optional year param
    if year is not None:
        fy_start_year = year
    else:
        fy_start_year = now.year if now.month >= 4 else now.year - 1
    fy_end_year = fy_start_year + 1
    
    # Determine current FY start year for comparison
    current_fy_start = now.year if now.month >= 4 else now.year - 1
    is_current_fy = (fy_start_year == current_fy_start)
    is_past_fy = (fy_start_year < current_fy_start)
    
    # Calculate months earned using the new logic which correctly bounds based on FY
    months_earned = compute_months_earned_for_fy(fy_start_year, current.get("created_at"))
    
    fin_start = f"{fy_start_year}-04-01"
    fin_end = f"{fy_end_year}-03-31"
    
    # Fetch all approved leaves for this employee in the selected FY
    approved_leaves = []
    async for leave in db.leaves.find({
        "employee_id": employee_id,
        "status": "Approved",
        "leave_date": {"$gte": fin_start, "$lte": fin_end}
    }):
        approved_leaves.append(leave)
    
    # Build month-wise breakdown (April=month 0, May=month 1, ..., March=month 11)
    month_names = ["April", "May", "June", "July", "August", "September",
                   "October", "November", "December", "January", "February", "March"]
    
    monthly_data = []
    running_casual_remaining = 0
    running_sick_remaining = 0
    
    for i in range(12):
        if i < 9:  # April(0) to December(8)
            month_num = i + 4
            year_val = fy_start_year
        else:  # January(9) to March(11)
            month_num = i - 8
            year_val = fy_end_year
        
        month_label = f"{month_names[i]} {year_val}"
        is_earned = (i + 1) <= months_earned
        
        # Count approved leaves in this specific month
        casual_used_month = 0
        sick_used_month = 0
        for leave in approved_leaves:
            leave_date_str = leave.get("leave_date", "")
            try:
                ld = datetime.fromisoformat(leave_date_str.replace("Z", "+00:00")) if "T" in leave_date_str else datetime.strptime(leave_date_str, "%Y-%m-%d")
                if ld.month == month_num and ld.year == year_val:
                    lt = leave.get("leave_type", "").upper()
                    if "CASUAL" in lt:
                        casual_used_month += 1
                    elif "SICK" in lt:
                        sick_used_month += 1
            except (ValueError, TypeError):
                continue
        
        if is_earned:
            running_casual_remaining += 1 - casual_used_month
            running_sick_remaining += 1 - sick_used_month
        
        monthly_data.append({
            "month": month_label,
            "month_index": i,
            "is_earned": is_earned,
            "casual_allocated": 1 if is_earned else 0,
            "casual_used": casual_used_month,
            "casual_remaining": max(0, running_casual_remaining) if is_earned else 0,
            "sick_allocated": 1 if is_earned else 0,
            "sick_used": sick_used_month,
            "sick_remaining": max(0, running_sick_remaining) if is_earned else 0,
        })
    
    # Totals
    total_casual_used = sum(m["casual_used"] for m in monthly_data)
    total_sick_used = sum(m["sick_used"] for m in monthly_data)
    
    return {
        "financial_year": f"FY {fy_start_year}-{str(fy_end_year)[-2:]}",
        "fy_label": f"April {fy_start_year} – March {fy_end_year}",
        "fy_start_year": fy_start_year,
        "is_current_fy": is_current_fy,
        "months_earned": months_earned,
        "total_casual_earned": months_earned,
        "total_sick_earned": months_earned,
        "total_casual_used": total_casual_used,
        "total_sick_used": total_sick_used,
        "remaining_casual": max(0, months_earned - total_casual_used),
        "remaining_sick": max(0, months_earned - total_sick_used),
        "monthly_breakdown": monthly_data,
    }

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

# ── Employees ─────────────────────────────────────────────────────────────────

@app.get("/api/employees/me")
async def get_me(current: dict = Depends(get_current_employee)):
    emp = await db.employees.find_one({"employee_id": current["employee_id"]})
    if emp:
        emp["id"] = str(emp.pop("_id"))
        return await inject_leave_balances(emp)
    return {}

@app.get("/api/employees")
async def list_employees(current: dict = Depends(get_current_employee)):
    # Everyone can view employees, maybe filter based on role if needed
    employees = []
    async for emp in db.employees.find().sort("created_at", -1):
        emp["id"] = str(emp.pop("_id"))
        employees.append(await inject_leave_balances(emp))
    return employees

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


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationIn(BaseModel):
    employee_id: str
    title: str
    message: str
    type: str

@app.post("/api/notifications", status_code=201)
async def create_notification(req: NotificationIn, current: dict = Depends(get_current_employee)):
    if current.get("role", "").upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Only Admins can create notifications")
    
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "employee_id": req.employee_id,
        "title": req.title,
        "message": req.message,
        "type": req.type,
        "read": False,
        "created_at": now_iso,
    }
    result = await db.notifications.insert_one(doc)
    return {"id": str(result.inserted_id)}

@app.get("/api/notifications")
async def get_notifications(current: dict = Depends(get_current_employee)):
    import re
    # Match employee_id case-insensitively just in case
    query = {"employee_id": re.compile(f"^{current['employee_id']}$", re.IGNORECASE)}
    
    records = []
    # Fetch all, sorted by created_at desc, max 50
    async for r in db.notifications.find(query, sort=[("created_at", -1)]).limit(50):
        r["id"] = str(r.pop("_id"))
        # Ensure read is a boolean (handle older records without read field)
        r["read"] = r.get("read", False)
        # Ensure type exists
        r["type"] = r.get("type", "info")
        
        # Ensure created_at is string for frontend
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
            
        # Ignore deleted ones if the old schema had isDeleted
        if r.get("isDeleted"):
            continue
            
        records.append(r)
    return records

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current: dict = Depends(get_current_employee)):
    try:
        obj_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    import re
    result = await db.notifications.update_one(
        {"_id": obj_id, "employee_id": re.compile(f"^{current['employee_id']}$", re.IGNORECASE)},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found or already read")
    return {"message": "Marked as read"}

@app.delete("/api/notifications/{notification_id}")
async def delete_notification(notification_id: str, current: dict = Depends(get_current_employee)):
    try:
        obj_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    import re
    result = await db.notifications.delete_one(
        {"_id": obj_id, "employee_id": re.compile(f"^{current['employee_id']}$", re.IGNORECASE)}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}

@app.put("/api/notifications/read-all")
async def mark_all_notifications_read(current: dict = Depends(get_current_employee)):
    import re
    await db.notifications.update_many(
        {"employee_id": re.compile(f"^{current['employee_id']}$", re.IGNORECASE), "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}
# ── Cron Jobs ─────────────────────────────────────────────────────────────────

@app.get("/api/cron/daily")
async def daily_cron(database=Depends(get_db)):
    """
    To be triggered daily (e.g. at midnight) by Vercel Cron.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    # Note: Leave balances are now computed dynamically (1 CL + 1 SL per elapsed month).
    # No need to increment stored balances monthly.

    # 2. Process yesterday's attendance (Absents and Incomplete)
    # If they signed in but didn't sign out, mark them Absent
    await database.attendance.update_many(
        {"login_date": yesterday, "logout_time": None},
        {"$set": {"attendance_status": "Absent", "remarks": "Marked absent (incomplete sign-out yesterday)."}}
    )

    # For employees who didn't sign in at all yesterday, generate an Absent record (if it was a working day)
    yesterday_date_obj = datetime.strptime(yesterday, "%Y-%m-%d")
    
    # Check if yesterday was a declared holiday
    is_holiday = False
    holiday = await database.holidays.find_one({"start_date": {"$lte": yesterday}, "end_date": {"$gte": yesterday}})
    if holiday:
        is_holiday = True

    if yesterday_date_obj.weekday() != 6 and not is_holiday: # Skip Sundays and Holidays
        all_emps = database.employees.find({})
        async for emp in all_emps:
            emp_id = emp["employee_id"]
            
            # Did they check in yesterday?
            record = await database.attendance.find_one({"employee_id": emp_id, "login_date": yesterday})
            if not record:
                # Did they have an approved leave yesterday?
                leave_record = await database.leaves.find_one({"employee_id": emp_id, "leave_date": yesterday})
                if leave_record:
                    continue # Skip marking absent if they were on leave
                    
                absent_doc = {
                    "employee_id": emp_id,
                    "employee_name": emp.get("full_name", ""),
                    "role": emp.get("role", ""),
                    "login_date": yesterday,
                    "login_time": None,
                    "logout_time": None,
                    "attendance_status": "Absent",
                    "remarks": "Marked absent (did not sign in yesterday).",
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
