from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import connect_to_mongo, close_mongo_connection
from app.vector_store import vector_store
from app.routers import auth, courses, documents, chat, exam, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    vector_store.initialize()
    print("🚀 Application started successfully!")
    yield
    # Shutdown
    vector_store.close()
    await close_mongo_connection()
    print("👋 Application shutdown complete")


app = FastAPI(
    title="ThinkMate API",
    description="RAG-based AI tutoring system with course management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(exam.router)
app.include_router(analytics.router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to ThinkMate API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
