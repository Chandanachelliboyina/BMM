from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="BMM Backend API",
    description="Python FastAPI backend for Bheemabhai Mahila Mandali (BMM) App",
    version="1.0.0"
)

# Configure CORS so the frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, change this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = None
db = None

@app.on_event("startup")
async def startup_db_client():
    global client, db
    try:
        # Initialize MongoDB Async Client
        client = AsyncIOMotorClient(MONGO_URI)
        # Select the database
        db = client.bmm_database
        # Verify connection by pinging the server
        await client.admin.command('ping')
        print("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        print(f"Failed to connect to MongoDB Atlas: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
        print("MongoDB connection closed.")


# --- Pydantic Models ---
class ActivityModel(BaseModel):
    user_id: str
    date: str
    villages_visited: Optional[int] = 0
    village_names: Optional[str] = ""
    meetings_conducted: Optional[str] = ""
    remarks: Optional[str] = ""

class ActivityResponseModel(ActivityModel):
    id: str

# Helper function to parse ObjectId
def activity_helper(activity) -> dict:
    return {
        "id": str(activity["_id"]),
        "user_id": activity.get("user_id"),
        "date": activity.get("date"),
        "villages_visited": activity.get("villages_visited", 0),
        "village_names": activity.get("village_names", ""),
        "meetings_conducted": activity.get("meetings_conducted", ""),
        "remarks": activity.get("remarks", "")
    }

# --- Routes ---

@app.get("/")
async def root():
    return {"message": "Welcome to BMM Backend API. Server is running!"}

@app.get("/api/health")
async def health_check():
    """Check if database is connected and responsive"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection is not initialized")
    
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")

@app.post("/api/activities", response_model=ActivityResponseModel, status_code=201)
async def create_activity(activity: ActivityModel):
    """Create a new activity log"""
    try:
        collection = db.activities
        new_activity = await collection.insert_one(activity.dict())
        created_activity = await collection.find_one({"_id": new_activity.inserted_id})
        return activity_helper(created_activity)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/activities", response_model=List[ActivityResponseModel])
async def get_activities():
    """Retrieve all activities"""
    try:
        collection = db.activities
        activities = []
        async for activity in collection.find():
            activities.append(activity_helper(activity))
        return activities
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    # Run the FastAPI server
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
