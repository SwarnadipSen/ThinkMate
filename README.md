# ThinkMate

<div align="center">

### AI Tutoring Platform Built At Hacktropica 2026

ThinkMate helps teachers deliver smarter courses and students learn through guided, source-grounded AI conversations.

<p>
	<a href="#local-development"><strong>Quick Start</strong></a> •
	<a href="#live-product-preview"><strong>Preview</strong></a> •
	<a href="#architecture-overview"><strong>Architecture</strong></a> •
	<a href="#api-surface"><strong>API</strong></a>
</p>

</div>

![Hackathon](https://img.shields.io/badge/Hacktropica-2026-orange?style=for-the-badge&logo=trophy&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-Powered-blue?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[![Open Issues](https://img.shields.io/github/issues/SwarnadipSen/ThinkMate?style=flat-square)](https://github.com/SwarnadipSen/ThinkMate/issues)
[![Last Commit](https://img.shields.io/github/last-commit/SwarnadipSen/ThinkMate?style=flat-square)](https://github.com/SwarnadipSen/ThinkMate/commits)
[![Repo Size](https://img.shields.io/github/repo-size/SwarnadipSen/ThinkMate?style=flat-square)](https://github.com/SwarnadipSen/ThinkMate)

ThinkMate is an AI-powered tutoring platform built in a 36-hour hackathon sprint at Hacktropica 2026. It combines role-based classroom workflows with Retrieval-Augmented Generation (RAG) to help students learn from course-specific materials and help teachers monitor learning outcomes.

---

## Live Product Preview

Real product screenshots from the current ThinkMate build.

### App Screenshots

| Student Chat | Teacher Dashboard |
|---|---|
| ![Student Chat](app/public/student.png) | ![Teacher Dashboard](app/public/teacher.png) |

| Teacher Analytics |
|---|
| ![Teacher Analytics](app/public/teacher_analytics.png) |


---

## Why ThinkMate

- Students get guided, Socratic-style answers grounded in uploaded course documents.
- Teachers can create courses, upload notes, generate exams, and track class learning signals.
- The platform supports both standard and streaming chat for a more responsive AI experience.

## Core Features

### Student Experience

- Secure authentication and role-based access.
- Course-specific AI tutoring chat.
- Streaming responses over NDJSON for token-by-token output.
- Conversation history with source traceability.
- Exam mode with MCQ and descriptive question workflows.

### Teacher Experience

- Course creation and management.
- Document upload (PDF, DOCX, TXT).
- Automatic text chunking and embedding pipeline.
- Analytics dashboard with engagement, issue signals, and at-risk course indicators.

### AI + RAG Layer

- Embeddings via sentence-transformers/all-MiniLM-L6-v2.
- MongoDB Atlas Vector Search for semantic retrieval.
- Groq llama-3.3-70b-versatile for tutor chat generation.
- Optional Gemini-powered structured generation for exams and study plans.

## Tech Stack

### Frontend

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Zustand for client state
- Axios for API layer

### Backend

- FastAPI + Uvicorn
- MongoDB Atlas (metadata + history)
- MongoDB Atlas Vector Search (embeddings)
- sentence-transformers
- Groq API (+ optional Gemini API)

## Project Structure

~~~text
thinkmate/
|- app/                      # Next.js frontend
|  |- src/app/               # Route groups: auth, teacher, student
|  |- src/features/          # Feature modules (auth, courses, chat, exam)
|  |- src/lib/               # API client, endpoint wrappers, constants
|  |- src/store/             # Zustand stores
|  |- .env.example
|
|- server/                   # FastAPI backend
|  |- app/routers/           # auth, courses, documents, chat, exam, analytics
|  |- app/vector_store.py    # Atlas vector search integration
|  |- app/llm.py             # Groq + Gemini integration
|  |- .env.example
|
|- README.md
~~~

## Architecture Overview

```mermaid
flowchart LR
	A[Teacher Uploads PDF/DOCX/TXT] --> B[Document Processor]
	B --> C[Chunking 500/50]
	C --> D[Sentence Transformer Embeddings]
	D --> E[MongoDB Atlas Vector Search]

	S[Student Query] --> Q[Query Embedding]
	Q --> E
	E --> R[Top Relevant Chunks]
	R --> L[Groq LLM - ThinkMate Tutor]
	L --> T[Streaming/Standard Response]
	T --> H[Chat History in MongoDB]
```

~~~text
Teacher uploads docs -> extract text -> chunk -> embed -> Atlas vector store

Student asks question -> query embedding -> vector search -> top chunks ->
prompted LLM response -> answer + cited sources -> saved chat history
~~~

## Local Development

### 1. Clone

~~~bash
git clone https://github.com/SwarnadipSen/ThinkMate.git
cd ThinkMate
~~~

### 2. Backend Setup (server)

~~~bash
cd server
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
~~~

Create server environment file:

~~~bash
copy .env.example .env
~~~

Recommended server .env values used by current backend code:

~~~env
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=thinkmate

JWT_SECRET_KEY=replace-with-a-secure-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

GROQ_API_KEY=your-groq-api-key

# Optional (required for exam generation routes)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro

# Vector search settings
VECTOR_DATABASE_NAME=thinkmate_vectors
VECTOR_COLLECTION_NAME=document_chunks
VECTOR_SEARCH_INDEX_NAME=vector_index
VECTOR_DIMENSIONS=384

# Upload + chunking
MAX_UPLOAD_SIZE=10485760
ALLOWED_EXTENSIONS=pdf,docx,txt
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_BATCH_SIZE=32
CHUNK_SIZE=500
CHUNK_OVERLAP=50
~~~

Run backend:

~~~bash
python main.py
# or
uvicorn main:app --reload --reload-dir app --reload-exclude .venv --reload-exclude __pycache__
~~~

Backend URLs:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

### 3. Frontend Setup (app)

Open a new terminal:

~~~bash
cd app
npm install
copy .env.example .env.local
~~~

Set frontend environment variable:

~~~env
NEXT_PUBLIC_API_URL=http://localhost:8000
~~~

Run frontend:

~~~bash
npm run dev
~~~

Frontend URL:

- App: http://localhost:3000

## API Surface

### Auth

- POST /auth/register
- POST /auth/login
- GET /auth/me

### Courses

- POST /courses
- GET /courses
- GET /courses/{course_id}
- DELETE /courses/{course_id}

### Documents

- POST /documents/courses/{course_id}/upload
- GET /documents/courses/{course_id}/documents
- DELETE /documents/{document_id}

### Chat

- POST /chat
- POST /chat/stream
- GET /chat/history
- GET /chat/history/{conversation_id}
- DELETE /chat/history/{conversation_id}

### Exam

- POST /exam/mcq/generate
- POST /exam/mcq/evaluate
- POST /exam/descriptive/generate
- POST /exam/descriptive/export-pdf

### Analytics

- GET /analytics/overview?time_range=7d|30d|90d|all

## Roles and Access

- Teacher: create/manage courses, upload/delete documents, access analytics.
- Student: view courses, chat with course context, use exam workflows.

## Hackathon Context

ThinkMate was built in a 36-hour sprint during Hacktropica 2026 to demonstrate an end-to-end education AI system:

- practical teacher tooling,
- student-centered adaptive tutoring,
- explainable responses through retrieved source chunks,
- measurable classroom insight via analytics.

## Current Status

- Frontend and backend are separated and runnable locally.
- JWT auth and role guards are implemented across routes.
- Streaming chat is implemented with NDJSON events.
- Exam and analytics modules are included in the API and UI.

## Known Setup Notes

- Ensure MongoDB Atlas Vector Search index exists or allow backend startup to create it.
- CORS currently allows local frontend origins (localhost:3000, localhost:3001).
- Exam generation requires GEMINI_API_KEY in addition to GROQ_API_KEY.

## Contributing

1. Fork the repo.
2. Create a feature branch.
3. Commit focused changes with clear messages.
4. Open a pull request with screenshots and API notes (if applicable).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
