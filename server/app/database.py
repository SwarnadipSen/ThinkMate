from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING
from app.config import settings
from typing import Optional

class Database:
    client: Optional[AsyncIOMotorClient] = None
    
db = Database()

async def get_database():
    return db.client[settings.DATABASE_NAME]

async def connect_to_mongo():
    """Connect to MongoDB and create indexes"""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = db.client[settings.DATABASE_NAME]
    
    # Create indexes
    await database.users.create_index([("email", ASCENDING)], unique=True)
    await database.courses.create_index([("course_id", ASCENDING)], unique=True)
    await database.courses.create_index([("teacher_id", ASCENDING)])
    await database.documents.create_index([("course_id", ASCENDING)])
    await database.chat_history.create_index([("student_id", ASCENDING)])
    await database.chat_history.create_index([("course_id", ASCENDING)])
    await database.chat_history.create_index([("course_id", ASCENDING), ("updated_at", ASCENDING)])
    
    print("✅ Connected to MongoDB")

async def close_mongo_connection():
    """Close MongoDB connection"""
    if db.client:
        db.client.close()
        print("❌ Closed MongoDB connection")
