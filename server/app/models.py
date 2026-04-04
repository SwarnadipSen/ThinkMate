from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    TEACHER = "teacher"
    STUDENT = "student"

# ============= Auth Models =============
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: datetime

# ============= Course Models =============
class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1)
    course_id: str = Field(..., min_length=1)

class CourseResponse(BaseModel):
    id: str
    course_id: str
    name: str
    teacher_id: str
    created_at: datetime
    document_count: int = 0

# ============= Document Models =============
class DocumentResponse(BaseModel):
    id: str
    course_id: str
    filename: str
    file_type: str
    upload_date: datetime
    chunk_count: int

# ============= Chat Models =============
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sources: Optional[List[dict]] = None

class ChatRequest(BaseModel):
    course_id: str
    message: str
    conversation_id: Optional[str] = None

class ChatSource(BaseModel):
    filename: str
    chunk_index: int
    page_number: Optional[int] = None

class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    sources: List[ChatSource] = []

class ConversationSummary(BaseModel):
    id: str
    course_id: str
    course_name: str
    last_message: str
    message_count: int
    updated_at: datetime

class ConversationDetail(BaseModel):
    id: str
    course_id: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime


# ============= Analytics Models =============
class AnalyticsSummary(BaseModel):
    total_courses: int
    active_courses: int
    total_documents: int
    active_students: int
    total_conversations: int
    total_messages: int
    avg_messages_per_conversation: float
    engagement_rate: float


class CourseAnalytics(BaseModel):
    course_id: str
    course_name: str
    document_count: int
    student_count: int
    conversation_count: int
    message_count: int
    avg_messages_per_conversation: float
    last_activity: Optional[datetime] = None


class DailyActivity(BaseModel):
    date: str
    message_count: int
    conversation_count: int
    active_students: int


class IssueSignal(BaseModel):
    issue: str
    count: int
    percentage: float
    example_prompts: List[str] = []


class SourceCoverage(BaseModel):
    assistant_messages_with_sources: int
    total_assistant_messages: int
    coverage_rate: float


class TeacherAnalyticsOverview(BaseModel):
    time_range: str
    generated_at: datetime
    summary: AnalyticsSummary
    source_coverage: SourceCoverage
    top_courses: List[CourseAnalytics]
    activity_by_day: List[DailyActivity]
    issue_signals: List[IssueSignal]
