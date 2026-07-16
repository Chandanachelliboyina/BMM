import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

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

# --- Supabase Setup ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: Supabase environment variables are missing. Some endpoints may fail.")
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- MongoDB Setup ---
MONGODB_URI = os.getenv("MONGODB_URI")
mongo_client = None
db = None

if MONGODB_URI:
    mongo_client = AsyncIOMotorClient(MONGODB_URI)
    db = mongo_client.get_database("bmm_database") # Default database name
    print("MongoDB Atlas connection initialized.")
else:
    print("Warning: MONGODB_URI environment variable is missing. MongoDB will not be connected.")


@app.get("/")
def read_root():
    return {"message": "Welcome to the BMM FastAPI Backend"}


@app.get("/health")
async def health_check():
    """Simple health check endpoint for both Supabase and MongoDB"""
    mongo_status = False
    if mongo_client:
        try:
            # The ping command is cheap and does not require auth.
            await mongo_client.admin.command('ping')
            mongo_status = True
        except Exception as e:
            print(f"MongoDB ping failed: {e}")
            
    return {
        "status": "healthy",
        "supabase_connected": supabase is not None,
        "mongodb_connected": mongo_status
    }


@app.get("/api/mongo-test")
async def mongo_test():
    """Example endpoint to test MongoDB connection"""
    if not db:
        raise HTTPException(status_code=500, detail="MongoDB connection not configured")
    
    try:
        # Example: count documents in a 'test' collection
        collection = db["test_collection"]
        count = await collection.count_documents({})
        return {"message": "Connected to MongoDB Atlas!", "test_collection_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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
