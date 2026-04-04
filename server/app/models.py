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


# ============= Exam Generation Models =============
class GenerationMode(str, Enum):
    MCQ = "mcq"
    DESCRIPTIVE = "descriptive"


class ExamGenerationRequest(BaseModel):
    course_id: str
    selected_pdfs: List[str] = Field(default_factory=list)
    num_questions: int = Field(..., ge=1, le=50)
    difficulty: str = Field(default="medium")
    topic: Optional[str] = None
    top_k_per_document: int = Field(default=3, ge=1, le=10)


class MCQQuestion(BaseModel):
    question: str
    options: List[str] = Field(..., min_length=4, max_length=4)
    correct_answer: str
    explanation: str


class MCQGenerationResponse(BaseModel):
    questions: List[MCQQuestion]


class DescriptiveQuestion(BaseModel):
    question: str
    marks: int
    expected_points: List[str] = Field(default_factory=list)


class DescriptiveGenerationResponse(BaseModel):
    questions: List[DescriptiveQuestion]


class MCQAnswerItem(BaseModel):
    question_index: int = Field(..., ge=0)
    selected_answer: str


class MCQEvaluationRequest(BaseModel):
    questions: List[MCQQuestion]
    answers: List[MCQAnswerItem]


class MCQEvaluationResponse(BaseModel):
    score: int
    total: int
    feedback: str


class ImprovementPlan(BaseModel):
    focus_areas: List[str] = Field(default_factory=list)
    study_actions: List[str] = Field(default_factory=list)
    next_quiz_goal: str = ""


class MCQEvaluationWithPlanResponse(BaseModel):
    score: int
    total: int
    feedback: str
    improvement_plan: ImprovementPlan


class ExamExportRequest(BaseModel):
    title: str = "Exam Paper"
    questions: List[DescriptiveQuestion]
