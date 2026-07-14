from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

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
        # Select the database (you can change the name)
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

@app.post("/api/test-db")
async def test_db_write():
    """Test writing to MongoDB Atlas"""
    try:
        collection = db.test_collection
        test_doc = {"name": "test_user", "status": "active", "project": "BMM"}
        result = await collection.insert_one(test_doc)
        
        # Retrieve the document we just created
        saved_doc = await collection.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string for JSON serialization
        saved_doc["_id"] = str(saved_doc["_id"])
        
        return {
            "message": "Database write successful!", 
            "data": saved_doc
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run the FastAPI server
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
