# System Architecture Diagram

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOCRATIC AI TUTOR SYSTEM                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌─────────────────────────────────────────┐
│             │         │         FastAPI Backend                  │
│   Next.js   │◄───────►│         (Port 8000)                      │
│  Frontend   │  HTTP   │                                          │
│             │  +JWT   │  ┌────────────────────────────────────┐  │
└─────────────┘         │  │       API Endpoints                │  │
                        │  │  - /auth/* (JWT Auth)              │  │
                        │  │  - /courses/* (Course CRUD)        │  │
                        │  │  - /documents/* (Upload/Process)   │  │
                        │  │  - /chat/* (RAG + Socratic Chat)   │  │
                        │  └────────────────────────────────────┘  │
                        │                                          │
                        │  ┌────────────────────────────────────┐  │
                        │  │      Core Services                 │  │
                        │  │  - auth.py (JWT)                   │  │
                        │  │  - vector_store.py (ChromaDB)      │  │
                        │  │  - document_processor.py           │  │
                        │  │  - llm.py (Groq)                   │  │
                        │  └────────────────────────────────────┘  │
                        └──────────┬───────────────┬──────────────┘
                                   │               │
                    ┌──────────────┘               └───────────────┐
                    │                                              │
         ┌──────────▼──────────┐                    ┌─────────────▼─────────┐
         │   MongoDB Atlas     │                    │      ChromaDB         │
         │   (Metadata)        │                    │   (Vector Store)      │
         ├─────────────────────┤                    ├───────────────────────┤
         │ • Users             │                    │ • Course embeddings   │
         │ • Courses           │                    │ • 384-dim vectors     │
         │ • Documents         │                    │ • Cosine similarity   │
         │ • Chat history      │                    │ • Persistent storage  │
         └─────────────────────┘                    └───────────────────────┘
                                                                │
                                                    ┌───────────▼───────────┐
                                                    │   HuggingFace Model   │
                                                    │  all-MiniLM-L6-v2     │
                                                    │   (384 dimensions)    │
                                                    └───────────────────────┘
         
         ┌─────────────────────────────────────────────────────────┐
         │                    Groq API                             │
         │            llama-3.3-70b-versatile                      │
         │         (Socratic Response Generation)                  │
         └─────────────────────────────────────────────────────────┘
```

## User Flows

### Teacher Flow:

```
┌──────────┐
│ Teacher  │
└────┬─────┘
     │
     ├─► Register/Login ──────► JWT Token
     │
     ├─► Create Course ───────► Course ID: "CS101"
     │                          Name: "Intro to Python"
     │
     └─► Upload Document ─────► PDF/DOCX/TXT
             │
             ├─► Extract Text (PyPDF2/python-docx)
             │
             ├─► Chunk Text (500 chars, 50 overlap)
             │
             ├─► Generate Embeddings (384-dim)
             │
             ├─► Store in ChromaDB (vectors)
             │
             └─► Store in MongoDB (metadata)
```

### Student Flow:

```
┌──────────┐
│ Student  │
└────┬─────┘
     │
     ├─► Register/Login ──────► JWT Token
     │
     ├─► View Courses ────────► List of available courses
     │
     └─► Ask Question ────────► "What is a variable in Python?"
             │
             ├─► Generate Query Embedding
             │
             ├─► Search ChromaDB
             │       │
             │       └─► Top 3 similar chunks
             │
             ├─► Build Context
             │       │
             │       ├─► Retrieved chunks
             │       └─► Conversation history
             │
             ├─► Send to Groq LLM
             │       │
             │       └─► Socratic Prompt + Context
             │
            ├─► Stream tokens (NDJSON chunks)
            │       │
            │       └─► Update UI progressively
             │
            └─► Save final response to Chat History
```

## RAG Pipeline Detail

```
┌────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING                         │
└────────────────────────────────────────────────────────────────┘

File Upload
    │
    ├─► Validate (type, size)
    │
    ├─► Extract Text
    │   ├─► PDF: PyPDF2.PdfReader
    │   ├─► DOCX: python-docx.Document
    │   └─► TXT: UTF-8 decode
    │
    ├─► Chunk Text
    │   ├─► Size: 500 characters
    │   ├─► Overlap: 50 characters
    │   └─► Output: List[str]
    │
    ├─► Generate Embeddings
    │   ├─► Model: all-MiniLM-L6-v2
    │   ├─► Input: Text chunks
    │   └─► Output: 384-dim vectors
    │
    └─► Store
        ├─► ChromaDB: Vectors + chunk text
        └─► MongoDB: Metadata (filename, course, etc.)

┌────────────────────────────────────────────────────────────────┐
│                    QUERY PROCESSING                            │
└────────────────────────────────────────────────────────────────┘

Student Question
    │
    ├─► Generate Query Embedding
    │   └─► Same model: all-MiniLM-L6-v2
    │
    ├─► Vector Search (ChromaDB)
    │   ├─► Similarity: Cosine
    │   ├─► Results: Top 3 chunks
    │   └─► With metadata
    │
    ├─► Build Context
    │   ├─► Format chunks
    │   ├─► Add conversation history (last 10 messages)
    │   └─► Add course name
    │
    ├─► Groq LLM
    │   ├─► Model: llama-3.3-70b-versatile
    │   ├─► Temperature: 0.7
    │   ├─► Max tokens: 500
    │   ├─► System: Socratic prompt
    │   ├─► Context: Retrieved chunks + history
    │   └─► Streaming mode: stream=True (/chat/stream)
    │
    └─► Response
      ├─► Emit NDJSON `chunk` events
      ├─► Emit NDJSON `done` event with sources/conversation_id
      ├─► Save final assistant response to chat history
      └─► Return full response path still available at /chat
```

## Database Schemas

### MongoDB Collections:

```
users
├─ _id: ObjectId
├─ email: String (unique, indexed)
├─ password_hash: String
├─ role: "teacher" | "student"
└─ created_at: DateTime

courses
├─ _id: ObjectId
├─ course_id: String (unique, indexed)
├─ name: String
├─ teacher_id: String (indexed)
├─ document_count: Number
└─ created_at: DateTime

documents
├─ _id: ObjectId
├─ document_id: String
├─ course_id: String (indexed)
├─ filename: String
├─ file_type: "pdf" | "docx" | "txt"
├─ chunk_count: Number
└─ upload_date: DateTime

chat_history
├─ _id: ObjectId
├─ student_id: String (indexed)
├─ course_id: String (indexed)
├─ messages: Array[
│   ├─ role: "user" | "assistant"
│   ├─ content: String
│   └─ timestamp: DateTime
│  ]
├─ created_at: DateTime
└─ updated_at: DateTime
```

### ChromaDB Collections:

```
course_{course_id}
├─ id: String (chunk_id)
├─ document: String (chunk text)
├─ embedding: Float[384] (vector)
└─ metadata: {
    ├─ document_id: String
    ├─ filename: String
    ├─ chunk_index: Number
    └─ total_chunks: Number
   }
```

## Security & Access Control

```
┌─────────────────────────────────────────────────────────┐
│                    JWT AUTHENTICATION                    │
├─────────────────────────────────────────────────────────┤
│  Login ──► JWT Token (24h expiry)                       │
│    │                                                     │
│    ├─► Payload: {sub: email, role: teacher|student}    │
│    └─► Signature: HS256 with SECRET_KEY                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  ROLE-BASED ACCESS                       │
├─────────────────────────────────────────────────────────┤
│  TEACHER CAN:                                            │
│  ✅ Create courses                                       │
│  ✅ Upload documents to their courses                    │
│  ✅ View their courses                                   │
│  ✅ Delete their courses                                 │
│  ❌ Cannot chat                                          │
│                                                          │
│  STUDENT CAN:                                            │
│  ✅ View all courses                                     │
│  ✅ Chat with course materials                           │
│  ✅ View chat history                                    │
│  ❌ Cannot create/modify courses                         │
│  ❌ Cannot upload documents                              │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
server/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── .env                       # Environment config (SECRET!)
├── .env.example              # Template
├── .gitignore                # Git ignore
│
├── app/
│   ├── __init__.py
│   ├── config.py             # Settings (loads .env)
│   ├── database.py           # MongoDB connection
│   ├── models.py             # Pydantic models
│   ├── auth.py               # JWT utils
│   ├── vector_store.py       # ChromaDB operations
│   ├── document_processor.py # Text extraction
│   ├── llm.py                # Groq integration
│   │
│   └── routers/
│       ├── __init__.py
│       ├── auth.py           # /auth/* endpoints
│       ├── courses.py        # /courses/* endpoints
│       ├── documents.py      # /documents/* endpoints
│       └── chat.py           # /chat/* endpoints
│
├── uploads/                  # (Empty - files processed in memory)
├── chroma_db/               # ChromaDB persistent storage
│
└── Documentation/
    ├── START_HERE.md        # ⭐ Start here!
    ├── SETUP.md             # Quick setup
    ├── README.md            # Full documentation
    ├── QUICK_REFERENCE.md   # API reference
    ├── IMPLEMENTATION.md    # Technical details
    ├── test_api.py          # Test script
    ├── check_setup.py       # Verify setup
    └── generate_secret.py   # Generate JWT key
```

## Technology Stack

```
┌──────────────────────────────────────────────────────────┐
│                    BACKEND STACK                         │
├──────────────────────────────────────────────────────────┤
│  Web Framework    │ FastAPI 0.109+                       │
│  Server           │ Uvicorn (ASGI)                       │
│  Database         │ MongoDB Atlas (cloud)                │
│  Vector DB        │ ChromaDB (persistent)                │
│  Embeddings       │ HuggingFace Sentence Transformers    │
│  LLM              │ Groq API (llama-3.3-70b)            │
│  Auth             │ JWT (python-jose)                    │
│  Password Hash    │ bcrypt (passlib)                     │
│  PDF Parser       │ PyPDF2                               │
│  DOCX Parser      │ python-docx                          │
└──────────────────────────────────────────────────────────┘
```

## API Endpoints Summary

```
PUBLIC:
  POST   /auth/register       Register user
  POST   /auth/login          Get JWT token

AUTHENTICATED:
  GET    /auth/me             Get current user

TEACHER ONLY:
  POST   /courses             Create course
  DELETE /courses/{id}        Delete course
  POST   /documents/courses/{id}/upload
  GET    /documents/courses/{id}/documents
  DELETE /documents/{id}

STUDENT ONLY:
  POST   /chat                Send message
  POST   /chat/stream         Stream message response (NDJSON)
  GET    /chat/history        List conversations
  GET    /chat/history/{id}   Get conversation
  DELETE /chat/history/{id}   Delete conversation

BOTH:
  GET    /courses             List courses
  GET    /courses/{id}        Get course details
```
