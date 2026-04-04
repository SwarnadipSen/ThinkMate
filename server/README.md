# Socratic AI Tutor - Backend

A FastAPI-based backend for a RAG (Retrieval-Augmented Generation) powered Socratic AI tutoring system.

## Features

- **JWT Authentication**: Secure user authentication with teacher/student roles
- **Course Management**: Teachers can create and manage courses
- **Document Processing**: Upload and process PDF, DOCX, and TXT files
- **RAG Pipeline**: 
  - Text extraction and chunking (500 chars, 50 overlap)
  - Embeddings using HuggingFace all-MiniLM-L6-v2 (384-dim)
  - Vector storage in ChromaDB
  - Metadata storage in MongoDB Atlas
- **Socratic Chat**: AI-powered tutoring using Groq's llama-3.3-70b-versatile
- **Streaming Chat**: Progressive token-by-token assistant responses via NDJSON stream
- **Chat History**: Persistent conversation tracking

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# MongoDB Atlas
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=socratic_tutor

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=your-secret-key-here

# Groq API
GROQ_API_KEY=your-groq-api-key-here

# ChromaDB
CHROMA_PERSIST_DIRECTORY=./chroma_db

# Other settings (optional)
CHUNK_SIZE=500
CHUNK_OVERLAP=50
```

### 3. Run the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`
API Documentation: `http://localhost:8000/docs`

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user (teacher/student)
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Courses (Teachers)
- `POST /courses` - Create new course
- `GET /courses` - List courses
- `GET /courses/{course_id}` - Get course details
- `DELETE /courses/{course_id}` - Delete course

### Documents (Teachers)
- `POST /documents/courses/{course_id}/upload` - Upload document
- `GET /documents/courses/{course_id}/documents` - List documents
- `DELETE /documents/{document_id}` - Delete document

### Chat (Students)
- `POST /chat` - Send message and get Socratic response
- `POST /chat/stream` - Send message and stream Socratic response chunks
- `GET /chat/history` - Get all conversations
- `GET /chat/history/{conversation_id}` - Get specific conversation
- `DELETE /chat/history/{conversation_id}` - Delete conversation

### Analytics (Teachers)
- `GET /analytics/overview?time_range=30d` - Teacher analytics dashboard metrics

## Architecture

```
File Upload → Extract Text → Chunk → Embed → Store
                                              ↓
                                      ChromaDB + MongoDB

Student Query → Embed → Vector Search → Top 3 Chunks → Groq LLM → Socratic Response

Student Query (Stream) → Embed → Vector Search → Groq LLM (stream=True) → NDJSON chunks → Final save to history
```

## Project Structure

```
server/
├── app/
│   ├── routers/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── courses.py       # Course management
│   │   ├── documents.py     # Document upload/processing
│   │   └── chat.py          # Chat functionality
│   ├── config.py            # Configuration
│   ├── database.py          # MongoDB connection
│   ├── models.py            # Pydantic models
│   ├── auth.py              # JWT authentication
│   ├── vector_store.py      # ChromaDB operations
│   ├── document_processor.py # File processing
│   └── llm.py               # Groq LLM integration
├── main.py                  # FastAPI application
├── requirements.txt
└── .env
```

## Usage Example

### 1. Register a Teacher
```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "password123",
    "role": "teacher"
  }'
```

### 2. Login
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "password123"
  }'
```

### 3. Create Course
```bash
curl -X POST "http://localhost:8000/courses" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Introduction to Python",
    "course_id": "CS101"
  }'
```

### 4. Upload Document
```bash
curl -X POST "http://localhost:8000/documents/courses/CS101/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

### 5. Chat (as Student)
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": "CS101",
    "message": "What is a variable in Python?"
  }'
```

### 6. Streaming Chat (as Student)
```bash
curl -N -X POST "http://localhost:8000/chat/stream" \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": "CS101",
    "message": "Can you guide me through variables with an example?",
    "conversation_id": null
  }'
```

The stream returns newline-delimited JSON events:

- `{"type":"chunk","content":"..."}` for progressive text updates
- `{"type":"done","conversation_id":"...","sources":[...]}` when response is complete and persisted
- `{"type":"error","detail":"..."}` if generation fails

## Notes

- Maximum file upload size: 10MB
- Supported file types: PDF, DOCX, TXT
- JWT tokens expire after 24 hours
- ChromaDB data persists in `./chroma_db` directory
- Chat history is stored per student per course
