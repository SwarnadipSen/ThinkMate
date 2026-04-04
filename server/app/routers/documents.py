from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from app.models import DocumentResponse
from app.auth import get_current_teacher, get_current_user
from app.database import get_database
from app.vector_store import vector_store
from app.document_processor import process_document
from app.config import settings
from datetime import datetime
from typing import List
import uuid
import asyncio
from bson import ObjectId

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/courses/{course_id}/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_teacher)
):
    """Upload and process a document for a course (teachers only)"""
    db = await get_database()
    
    # Verify course exists and user owns it
    course = await db.courses.find_one({"course_id": course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    if course["teacher_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to upload documents to this course"
        )
    
    # Validate file extension
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    allowed_extensions = settings.ALLOWED_EXTENSIONS.split(',')
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not supported. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Check file size
    if len(file_content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # Process document
    try:
        chunks, file_type, page_numbers = await asyncio.to_thread(
            process_document, file_content, file.filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing document: {str(e)}"
        )
    
    # Generate unique IDs for chunks
    document_id = str(uuid.uuid4())
    chunk_ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    
    # Prepare metadata
    metadatas = [
        {
            "document_id": document_id,
            "filename": file.filename,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "page_number": page_numbers[i]
        }
        for i in range(len(chunks))
    ]
    
    # Store chunk embeddings in MongoDB vector collection
    try:
        await asyncio.to_thread(
            vector_store.add_documents,
            course_id=course_id,
            documents=chunks,
            metadatas=metadatas,
            ids=chunk_ids,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error storing document embeddings: {str(e)}"
        )
    
    # Store metadata in MongoDB
    document_dict = {
        "document_id": document_id,
        "course_id": course_id,
        "filename": file.filename,
        "file_type": file_type,
        "upload_date": datetime.utcnow(),
        "chunk_count": len(chunks)
    }
    
    result = await db.documents.insert_one(document_dict)
    document_dict["_id"] = result.inserted_id
    
    # Update course document count
    await db.courses.update_one(
        {"course_id": course_id},
        {"$inc": {"document_count": 1}}
    )
    
    return DocumentResponse(
        id=str(document_dict["_id"]),
        course_id=document_dict["course_id"],
        filename=document_dict["filename"],
        file_type=document_dict["file_type"],
        upload_date=document_dict["upload_date"],
        chunk_count=document_dict["chunk_count"]
    )


@router.get("/courses/{course_id}/documents", response_model=List[DocumentResponse])
async def get_course_documents(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all documents for a course (teachers/students)."""
    db = await get_database()
    
    # Verify course exists and user owns it
    course = await db.courses.find_one({"course_id": course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    if current_user["role"] == "teacher" and course["teacher_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view documents for this course"
        )
    
    # Get documents
    documents = []
    async for doc in db.documents.find({"course_id": course_id}):
        documents.append(DocumentResponse(
            id=str(doc["_id"]),
            course_id=doc["course_id"],
            filename=doc["filename"],
            file_type=doc["file_type"],
            upload_date=doc["upload_date"],
            chunk_count=doc["chunk_count"]
        ))
    
    return documents


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_teacher)
):
    """Delete a document (teachers only)"""
    db = await get_database()
    
    # Find document by either internal document_id (UUID) or Mongo _id used by frontend.
    document = await db.documents.find_one({"document_id": document_id})
    if not document:
        try:
            object_id = ObjectId(document_id)
            document = await db.documents.find_one({"_id": object_id})
        except Exception:
            document = None

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Verify ownership through course
    course = await db.courses.find_one({"course_id": document["course_id"]})
    if not course or course["teacher_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this document"
        )
    
    # Delete from MongoDB
    await db.documents.delete_one({"_id": document["_id"]})

    # Delete associated vectors from MongoDB vector collection.
    vector_store.delete_document(document["document_id"])
    
    # Update course document count
    await db.courses.update_one(
        {"course_id": document["course_id"]},
        {"$inc": {"document_count": -1}}
    )
    
    return None
