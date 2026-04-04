from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING
from app.config import settings
from typing import Optional
from fastapi import HTTPException, status
import asyncio
from datetime import datetime, timedelta

class Database:
    client: Optional[AsyncIOMotorClient] = None
    is_connected: bool = False
    last_error: Optional[str] = None
    reconnect_lock: asyncio.Lock = asyncio.Lock()
    last_reconnect_attempt: Optional[datetime] = None
    
db = Database()

async def get_database():
    if not db.client or not db.is_connected:
        # Recover automatically if startup connection failed transiently.
        await ensure_connection()

    if not db.client or not db.is_connected:
        detail = "Database is currently unavailable. Please try again shortly."
        if db.last_error:
            detail = f"{detail} ({db.last_error})"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail
        )
    return db.client[settings.DATABASE_NAME]


async def ensure_connection():
    async with db.reconnect_lock:
        if db.client and db.is_connected:
            return

        now = datetime.utcnow()
        if db.last_reconnect_attempt and now - db.last_reconnect_attempt < timedelta(seconds=2):
            return

        db.last_reconnect_attempt = now
        await connect_to_mongo()

async def connect_to_mongo():
    """Connect to MongoDB and create indexes"""
    try:
        db.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
        )
        database = db.client[settings.DATABASE_NAME]

        # Force a connection check before creating indexes.
        await db.client.admin.command("ping")

        # Create indexes
        await database.users.create_index([("email", ASCENDING)], unique=True)
        await database.courses.create_index([("course_id", ASCENDING)], unique=True)
        await database.courses.create_index([("teacher_id", ASCENDING)])
        await database.documents.create_index([("course_id", ASCENDING)])
        await database.chat_history.create_index([("student_id", ASCENDING)])
        await database.chat_history.create_index([("course_id", ASCENDING)])

        db.is_connected = True
        db.last_error = None
        print("✅ Connected to MongoDB")
    except Exception as exc:
        db.is_connected = False
        db.last_error = str(exc)
        if db.client:
            db.client.close()
            db.client = None
        print(f"⚠️ MongoDB connection unavailable at startup: {exc}")

async def close_mongo_connection():
    """Close MongoDB connection"""
    if db.client:
        db.client.close()
        db.client = None
        db.is_connected = False
        print("❌ Closed MongoDB connection")
