import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file (if running locally)
load_dotenv(dotenv_path="../.env")

# Initialize FastAPI app
app = FastAPI(
    title="BMM API",
    description="Backend API for Bheemabhai Mahila Mandali (BMM)",
    version="1.0.0"
)

# Configure CORS so the React frontend can communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (update this in production!)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: Supabase environment variables are missing. Some endpoints may fail.")
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.get("/")
def read_root():
    return {"message": "Welcome to the BMM FastAPI Backend"}


@app.get("/health")
def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "supabase_connected": supabase is not None}


@app.get("/api/employees")
def get_employees():
    """Example endpoint to fetch employees from Supabase"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection not configured")
        
    try:
        response = supabase.table("employees").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# To run the server locally:
# uvicorn app:app --reload --port 8000
