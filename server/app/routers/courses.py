from fastapi import APIRouter, HTTPException, status, Depends
from app.models import CourseCreate, CourseResponse
from app.auth import get_current_teacher, get_current_user, get_current_student
from app.database import get_database
from app.vector_store import vector_store
from datetime import datetime
from typing import List

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_data: CourseCreate,
    current_user: dict = Depends(get_current_teacher)
):
    """Create a new course (teachers only)"""
    db = await get_database()
    
    # Check if course_id already exists
    existing_course = await db.courses.find_one({"course_id": course_data.course_id})
    if existing_course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course ID already exists"
        )
    
    # Create course
    course_dict = {
        "course_id": course_data.course_id,
        "name": course_data.name,
        "teacher_id": str(current_user["_id"]),
        "created_at": datetime.utcnow(),
        "document_count": 0
    }
    
    result = await db.courses.insert_one(course_dict)
    course_dict["_id"] = result.inserted_id
    
    return CourseResponse(
        id=str(course_dict["_id"]),
        course_id=course_dict["course_id"],
        name=course_dict["name"],
        teacher_id=course_dict["teacher_id"],
        created_at=course_dict["created_at"],
        document_count=0
    )


@router.get("", response_model=List[CourseResponse])
async def get_courses(current_user: dict = Depends(get_current_user)):
    """Get courses (teachers see their courses, students see all courses)"""
    db = await get_database()
    
    # Teachers see only their courses
    if current_user["role"] == "teacher":
        query = {"teacher_id": str(current_user["_id"])}
    else:
        # Students see all courses
        query = {}
    
    courses = []
    async for course in db.courses.find(query):
        courses.append(CourseResponse(
            id=str(course["_id"]),
            course_id=course["course_id"],
            name=course["name"],
            teacher_id=course["teacher_id"],
            created_at=course["created_at"],
            document_count=course.get("document_count", 0)
        ))
    
    return courses


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get course details"""
    db = await get_database()
    
    course = await db.courses.find_one({"course_id": course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Teachers can only see their own courses
    if current_user["role"] == "teacher" and course["teacher_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this course"
        )
    
    return CourseResponse(
        id=str(course["_id"]),
        course_id=course["course_id"],
        name=course["name"],
        teacher_id=course["teacher_id"],
        created_at=course["created_at"],
        document_count=course.get("document_count", 0)
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: str,
    current_user: dict = Depends(get_current_teacher)
):
    """Delete a course (teachers only)"""
    db = await get_database()
    
    # Find course
    course = await db.courses.find_one({"course_id": course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check ownership
    if course["teacher_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this course"
        )
    
    # Delete course
    await db.courses.delete_one({"course_id": course_id})
    
    # Delete associated documents
    await db.documents.delete_many({"course_id": course_id})
    
    # Delete all vectors for this course
    vector_store.delete_collection(course_id)
    
    return None
