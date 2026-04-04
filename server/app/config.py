from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str
    DATABASE_NAME: str = "thinkmate"
    
    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Groq
    GROQ_API_KEY: str

    # Gemini (controlled generation layer)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-pro"
    
    # MongoDB Vector Store (Atlas Vector Search)
    VECTOR_DATABASE_NAME: str = "thinkmate_vectors"
    VECTOR_COLLECTION_NAME: str = "document_chunks"
    VECTOR_SEARCH_INDEX_NAME: str = "vector_index"
    VECTOR_DIMENSIONS: int = 384
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    ALLOWED_EXTENSIONS: str = "pdf,docx,txt"
    
    # Embedding
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Chunking
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    
    class Config:
        env_file = str(ENV_FILE)
        case_sensitive = True


settings = Settings()
