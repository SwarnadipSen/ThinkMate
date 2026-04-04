from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from app.models import ChatRequest, ChatResponse, ConversationSummary, ConversationDetail, ChatMessage
from app.auth import get_current_student
from app.database import get_database
from app.vector_store import vector_store
from app.llm import generate_thinkmate_response, generate_thinkmate_response_stream
from datetime import datetime
from typing import List
from bson import ObjectId
import json

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    chat_request: ChatRequest,
    current_user: dict = Depends(get_current_student)
):
    """Send a message and get ThinkMate response (students only)"""
    db = await get_database()
    
    # Verify course exists
    course = await db.courses.find_one({"course_id": chat_request.course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check if course has documents
    doc_count = await db.documents.count_documents({"course_id": chat_request.course_id})
    if doc_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course has no uploaded materials yet"
        )
    
    # Get or create conversation
    conversation_id = chat_request.conversation_id
    conversation = None
    
    if conversation_id:
        # Load existing conversation
        try:
            conversation = await db.chat_history.find_one({
                "_id": ObjectId(conversation_id),
                "student_id": str(current_user["_id"]),
                "course_id": chat_request.course_id
            })
        except:
            pass
    
    if not conversation:
        # Create new conversation
        conversation = {
            "student_id": str(current_user["_id"]),
            "course_id": chat_request.course_id,
            "messages": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.chat_history.insert_one(conversation)
        conversation["_id"] = result.inserted_id
        conversation_id = str(conversation["_id"])
    
    # Search for relevant context using RAG
    try:
        search_results = vector_store.search(
            course_id=chat_request.course_id,
            query=chat_request.message,
            n_results=3
        )
        
        # Format sources
        sources = []
        if search_results and search_results['documents']:
            for i, doc in enumerate(search_results['documents'][0]):
                metadata = search_results['metadatas'][0][i] if search_results['metadatas'] else {}
                sources.append({
                    "content": doc,
                    "metadata": metadata
                })
    except Exception as e:
        print(f"Error searching vector store: {e}")
        sources = []
    
    # Generate ThinkMate response
    try:
        response_text = generate_thinkmate_response(
            user_message=chat_request.message,
            conversation_history=conversation.get("messages", []),
            sources=sources,
            course_name=course["name"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating response: {str(e)}"
        )
    
    # Update conversation history
    source_payload = [
        {
            "filename": s["metadata"].get("filename", "Unknown"),
            "chunk_index": s["metadata"].get("chunk_index", 0),
            "page_number": s["metadata"].get("page_number")
        }
        for s in sources
    ]

    user_message = {
        "role": "user",
        "content": chat_request.message,
        "timestamp": datetime.utcnow()
    }
    
    assistant_message = {
        "role": "assistant",
        "content": response_text,
        "timestamp": datetime.utcnow(),
        "sources": source_payload
    }
    
    await db.chat_history.update_one(
        {"_id": conversation["_id"]},
        {
            "$push": {
                "messages": {
                    "$each": [user_message, assistant_message]
                }
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return ChatResponse(
        conversation_id=conversation_id,
        response=response_text,
        sources=source_payload
    )


@router.post("/stream")
async def chat_stream(
    chat_request: ChatRequest,
    current_user: dict = Depends(get_current_student)
):
    """Send a message and stream ThinkMate response chunks (students only)."""
    db = await get_database()

    course = await db.courses.find_one({"course_id": chat_request.course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )

    doc_count = await db.documents.count_documents({"course_id": chat_request.course_id})
    if doc_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course has no uploaded materials yet"
        )

    conversation_id = chat_request.conversation_id
    conversation = None

    if conversation_id:
        try:
            conversation = await db.chat_history.find_one({
                "_id": ObjectId(conversation_id),
                "student_id": str(current_user["_id"]),
                "course_id": chat_request.course_id
            })
        except:
            pass

    if not conversation:
        conversation = {
            "student_id": str(current_user["_id"]),
            "course_id": chat_request.course_id,
            "messages": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.chat_history.insert_one(conversation)
        conversation["_id"] = result.inserted_id
        conversation_id = str(conversation["_id"])

    try:
        search_results = vector_store.search(
            course_id=chat_request.course_id,
            query=chat_request.message,
            n_results=3
        )

        sources = []
        if search_results and search_results['documents']:
            for i, doc in enumerate(search_results['documents'][0]):
                metadata = search_results['metadatas'][0][i] if search_results['metadatas'] else {}
                sources.append({
                    "content": doc,
                    "metadata": metadata
                })
    except Exception as e:
        print(f"Error searching vector store: {e}")
        sources = []

    source_payload = [
        {
            "filename": s["metadata"].get("filename", "Unknown"),
            "chunk_index": s["metadata"].get("chunk_index", 0),
            "page_number": s["metadata"].get("page_number")
        }
        for s in sources
    ]

    async def stream():
        response_parts: List[str] = []

        try:
            for token in generate_thinkmate_response_stream(
                user_message=chat_request.message,
                conversation_history=conversation.get("messages", []),
                sources=sources,
                course_name=course["name"]
            ):
                response_parts.append(token)
                yield json.dumps({"type": "chunk", "content": token}) + "\n"

        except Exception as e:
            yield json.dumps({"type": "error", "detail": str(e)}) + "\n"
            return

        response_text = "".join(response_parts)

        user_message = {
            "role": "user",
            "content": chat_request.message,
            "timestamp": datetime.utcnow()
        }

        assistant_message = {
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow(),
            "sources": source_payload
        }

        await db.chat_history.update_one(
            {"_id": conversation["_id"]},
            {
                "$push": {
                    "messages": {
                        "$each": [user_message, assistant_message]
                    }
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        yield json.dumps({
            "type": "done",
            "conversation_id": conversation_id,
            "sources": source_payload
        }) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@router.get("/history", response_model=List[ConversationSummary])
async def get_chat_history(current_user: dict = Depends(get_current_student)):
    """Get all chat conversations for the current student"""
    db = await get_database()
    
    conversations = []
    async for conv in db.chat_history.find({"student_id": str(current_user["_id"])}).sort("updated_at", -1):
        # Get course name
        course = await db.courses.find_one({"course_id": conv["course_id"]})
        course_name = course["name"] if course else "Unknown Course"
        
        # Get last message
        messages = conv.get("messages", [])
        last_message = messages[-1]["content"][:100] + "..." if messages else "No messages"
        
        conversations.append(ConversationSummary(
            id=str(conv["_id"]),
            course_id=conv["course_id"],
            course_name=course_name,
            last_message=last_message,
            message_count=len(messages),
            updated_at=conv["updated_at"]
        ))
    
    return conversations


@router.get("/history/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_student)
):
    """Get a specific conversation with all messages"""
    db = await get_database()
    
    try:
        conversation = await db.chat_history.find_one({
            "_id": ObjectId(conversation_id),
            "student_id": str(current_user["_id"])
        })
    except:
        conversation = None
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    messages = [
        ChatMessage(
            role=msg["role"],
            content=msg["content"],
            timestamp=msg["timestamp"],
            sources=msg.get("sources")
        )
        for msg in conversation.get("messages", [])
    ]
    
    return ConversationDetail(
        id=str(conversation["_id"]),
        course_id=conversation["course_id"],
        messages=messages,
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"]
    )


@router.delete("/history/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_student)
):
    """Delete a conversation"""
    db = await get_database()
    
    try:
        result = await db.chat_history.delete_one({
            "_id": ObjectId(conversation_id),
            "student_id": str(current_user["_id"])
        })
    except:
        result = None
    
    if not result or result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return None
