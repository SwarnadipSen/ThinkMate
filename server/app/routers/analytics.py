from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.auth import get_current_teacher
from app.database import get_database
from app.models import (
    AnalyticsSummary,
    CourseAnalytics,
    DailyActivity,
    IssueSignal,
    SourceCoverage,
    TeacherAnalyticsOverview,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


ISSUE_PATTERNS: Dict[str, List[str]] = {
    "Concept confusion": [
        "don't understand",
        "do not understand",
        "confused",
        "not clear",
        "unclear",
        "hard to understand",
        "difficult to understand",
    ],
    "Need examples": [
        "example",
        "examples",
        "sample",
        "real world",
        "illustrate",
        "demo",
    ],
    "Step-by-step guidance": [
        "step by step",
        "how to",
        "walk me through",
        "guide me",
        "procedure",
    ],
    "Assessment concerns": [
        "exam",
        "test",
        "quiz",
        "assignment",
        "deadline",
        "grade",
        "marks",
    ],
    "Revision requests": [
        "summarize",
        "summary",
        "recap",
        "revise",
        "revision",
        "quick review",
    ],
}


def _get_start_date(time_range: str) -> Optional[datetime]:
    now = datetime.utcnow()
    if time_range == "7d":
        return now - timedelta(days=7)
    if time_range == "30d":
        return now - timedelta(days=30)
    if time_range == "90d":
        return now - timedelta(days=90)
    return None


@router.get("/overview", response_model=TeacherAnalyticsOverview)
async def get_teacher_analytics_overview(
    time_range: str = Query("30d", pattern="^(7d|30d|90d|all)$"),
    current_user: dict = Depends(get_current_teacher),
):
    """Get analytics overview for the logged-in teacher."""
    db = await get_database()
    teacher_id = str(current_user["_id"])
    start_date = _get_start_date(time_range)

    # Load teacher courses first.
    course_docs = []
    async for course in db.courses.find({"teacher_id": teacher_id}):
        course_docs.append(course)

    if not course_docs:
        return TeacherAnalyticsOverview(
            time_range=time_range,
            generated_at=datetime.utcnow(),
            summary=AnalyticsSummary(
                total_courses=0,
                active_courses=0,
                total_documents=0,
                active_students=0,
                total_conversations=0,
                total_messages=0,
                avg_messages_per_conversation=0.0,
                engagement_rate=0.0,
            ),
            source_coverage=SourceCoverage(
                assistant_messages_with_sources=0,
                total_assistant_messages=0,
                coverage_rate=0.0,
            ),
            top_courses=[],
            activity_by_day=[],
            issue_signals=[],
        )

    course_ids = [course["course_id"] for course in course_docs]
    course_name_map = {course["course_id"]: course["name"] for course in course_docs}
    course_document_map = {course["course_id"]: int(course.get("document_count", 0)) for course in course_docs}

    conversation_query = {"course_id": {"$in": course_ids}}
    if start_date:
        conversation_query["updated_at"] = {"$gte": start_date}

    total_conversations = 0
    total_messages = 0
    active_students = set()
    active_courses = set()

    assistant_messages = 0
    assistant_with_sources = 0
    total_user_messages = 0

    issue_counts = defaultdict(int)
    issue_examples = defaultdict(list)

    course_stats: Dict[str, dict] = {
        course_id: {
            "student_ids": set(),
            "conversation_count": 0,
            "message_count": 0,
            "last_activity": None,
        }
        for course_id in course_ids
    }

    daily_activity: Dict[str, dict] = defaultdict(
        lambda: {"message_count": 0, "conversation_count": 0, "student_ids": set()}
    )

    async for conversation in db.chat_history.find(conversation_query):
        course_id = conversation["course_id"]
        student_id = conversation.get("student_id")
        messages = conversation.get("messages", [])
        updated_at = conversation.get("updated_at")

        total_conversations += 1
        total_messages += len(messages)

        active_courses.add(course_id)
        if student_id:
            active_students.add(student_id)
            course_stats[course_id]["student_ids"].add(student_id)

        course_stats[course_id]["conversation_count"] += 1
        course_stats[course_id]["message_count"] += len(messages)

        last_activity = course_stats[course_id]["last_activity"]
        if updated_at and (last_activity is None or updated_at > last_activity):
            course_stats[course_id]["last_activity"] = updated_at

        day_key_from_conversation = None
        if updated_at:
            day_key_from_conversation = updated_at.strftime("%Y-%m-%d")
            daily_activity[day_key_from_conversation]["conversation_count"] += 1
            if student_id:
                daily_activity[day_key_from_conversation]["student_ids"].add(student_id)

        for message in messages:
            timestamp = message.get("timestamp")
            if start_date and isinstance(timestamp, datetime) and timestamp < start_date:
                continue

            if isinstance(timestamp, datetime):
                day_key = timestamp.strftime("%Y-%m-%d")
            else:
                day_key = day_key_from_conversation

            if day_key:
                daily_activity[day_key]["message_count"] += 1
                if student_id:
                    daily_activity[day_key]["student_ids"].add(student_id)

            role = message.get("role")
            if role == "assistant":
                assistant_messages += 1
                if message.get("sources"):
                    assistant_with_sources += 1
            elif role == "user":
                total_user_messages += 1
                content = (message.get("content") or "").strip()
                lowered = content.lower()

                for issue, patterns in ISSUE_PATTERNS.items():
                    if any(pattern in lowered for pattern in patterns):
                        issue_counts[issue] += 1
                        if content and len(issue_examples[issue]) < 3:
                            issue_examples[issue].append(content[:140])

    avg_messages = round(total_messages / total_conversations, 2) if total_conversations > 0 else 0.0
    engagement_rate = (
        round((len(active_courses) / len(course_ids)) * 100, 2)
        if len(course_ids) > 0
        else 0.0
    )

    coverage_rate = (
        round((assistant_with_sources / assistant_messages) * 100, 2)
        if assistant_messages > 0
        else 0.0
    )

    top_courses: List[CourseAnalytics] = []
    for course_id in course_ids:
        stats = course_stats[course_id]
        conv_count = stats["conversation_count"]
        msg_count = stats["message_count"]

        top_courses.append(
            CourseAnalytics(
                course_id=course_id,
                course_name=course_name_map.get(course_id, "Unknown Course"),
                document_count=course_document_map.get(course_id, 0),
                student_count=len(stats["student_ids"]),
                conversation_count=conv_count,
                message_count=msg_count,
                avg_messages_per_conversation=round(msg_count / conv_count, 2) if conv_count > 0 else 0.0,
                last_activity=stats["last_activity"],
            )
        )

    top_courses.sort(
        key=lambda item: (item.conversation_count, item.message_count, item.student_count),
        reverse=True,
    )

    activity_by_day: List[DailyActivity] = []
    for day in sorted(daily_activity.keys()):
        row = daily_activity[day]
        activity_by_day.append(
            DailyActivity(
                date=day,
                message_count=row["message_count"],
                conversation_count=row["conversation_count"],
                active_students=len(row["student_ids"]),
            )
        )

    issue_signals: List[IssueSignal] = []
    for issue, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
        issue_signals.append(
            IssueSignal(
                issue=issue,
                count=count,
                percentage=round((count / total_user_messages) * 100, 2) if total_user_messages > 0 else 0.0,
                example_prompts=issue_examples[issue],
            )
        )

    total_documents = sum(course_document_map.values())

    return TeacherAnalyticsOverview(
        time_range=time_range,
        generated_at=datetime.utcnow(),
        summary=AnalyticsSummary(
            total_courses=len(course_ids),
            active_courses=len(active_courses),
            total_documents=total_documents,
            active_students=len(active_students),
            total_conversations=total_conversations,
            total_messages=total_messages,
            avg_messages_per_conversation=avg_messages,
            engagement_rate=engagement_rate,
        ),
        source_coverage=SourceCoverage(
            assistant_messages_with_sources=assistant_with_sources,
            total_assistant_messages=assistant_messages,
            coverage_rate=coverage_rate,
        ),
        top_courses=top_courses,
        activity_by_day=activity_by_day,
        issue_signals=issue_signals[:5],
    )
