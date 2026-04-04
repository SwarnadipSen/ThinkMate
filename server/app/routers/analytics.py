from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.auth import get_current_teacher
from app.database import get_database
from app.models import (
    ActionRecommendation,
    AnalyticsSummary,
    AtRiskCourse,
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


def _risk_level(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


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
            at_risk_courses=[],
            recommendations=[],
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
            "user_message_count": 0,
            "assistant_message_count": 0,
            "assistant_with_sources": 0,
            "issue_count": 0,
            "last_activity": None,
        }
        for course_id in course_ids
    }

    daily_activity: Dict[str, dict] = defaultdict(
        lambda: {"message_count": 0, "conversation_count": 0, "student_ids": set()}
    )

    async for conversation in db.chat_history.find(conversation_query):
        course_id = conversation["course_id"]
        if course_id not in course_stats:
            continue

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
                course_stats[course_id]["assistant_message_count"] += 1
                if message.get("sources"):
                    assistant_with_sources += 1
                    course_stats[course_id]["assistant_with_sources"] += 1
            elif role == "user":
                total_user_messages += 1
                course_stats[course_id]["user_message_count"] += 1
                content = (message.get("content") or "").strip()
                lowered = content.lower()

                matched_issue = False

                for issue, patterns in ISSUE_PATTERNS.items():
                    if any(pattern in lowered for pattern in patterns):
                        matched_issue = True
                        issue_counts[issue] += 1
                        if content and len(issue_examples[issue]) < 3:
                            issue_examples[issue].append(content[:140])

                if matched_issue:
                    course_stats[course_id]["issue_count"] += 1

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

    at_risk_courses: List[AtRiskCourse] = []
    now = datetime.utcnow()
    for course in top_courses:
        stats = course_stats[course.course_id]
        user_message_count = stats["user_message_count"]
        assistant_message_count = stats["assistant_message_count"]
        issue_count = stats["issue_count"]
        assistant_with_sources_count = stats["assistant_with_sources"]

        issue_rate = round((issue_count / user_message_count) * 100, 2) if user_message_count > 0 else 0.0
        source_coverage_rate = (
            round((assistant_with_sources_count / assistant_message_count) * 100, 2)
            if assistant_message_count > 0
            else 0.0
        )

        days_since_last_activity = None
        if course.last_activity:
            days_since_last_activity = max((now - course.last_activity).days, 0)

        risk_score = 0.0
        reasons: List[str] = []

        if issue_rate >= 35:
            risk_score += 40
            reasons.append(f"High issue request rate ({issue_rate}%)")
        elif issue_rate >= 20:
            risk_score += 25
            reasons.append(f"Moderate issue request rate ({issue_rate}%)")
        elif issue_rate >= 10:
            risk_score += 12

        if source_coverage_rate < 50 and assistant_message_count > 0:
            risk_score += 30
            reasons.append(f"Low citation coverage ({source_coverage_rate}%)")
        elif source_coverage_rate < 70 and assistant_message_count > 0:
            risk_score += 18

        if days_since_last_activity is not None and days_since_last_activity > 14:
            risk_score += 20
            reasons.append(f"No activity for {days_since_last_activity} days")
        elif days_since_last_activity is not None and days_since_last_activity > 7:
            risk_score += 10

        if course.conversation_count == 0:
            risk_score += 15
            reasons.append("No student conversations yet")

        risk_score = round(min(risk_score, 100.0), 2)
        level = _risk_level(risk_score)

        if level in ["high", "medium"]:
            at_risk_courses.append(
                AtRiskCourse(
                    course_id=course.course_id,
                    course_name=course.course_name,
                    risk_score=risk_score,
                    risk_level=level,
                    issue_rate=issue_rate,
                    source_coverage_rate=source_coverage_rate,
                    days_since_last_activity=days_since_last_activity,
                    reasons=reasons,
                )
            )

    at_risk_courses.sort(key=lambda item: item.risk_score, reverse=True)

    recommendations: List[ActionRecommendation] = []
    if issue_signals:
        top_issue = issue_signals[0]
        recommendations.append(
            ActionRecommendation(
                priority="high",
                title=f"Address frequent learner issue: {top_issue.issue}",
                rationale=(
                    f"{top_issue.count} prompts ({top_issue.percentage}% of student prompts) indicate repeated friction."
                ),
                suggested_actions=[
                    "Create a focused revision handout for this topic.",
                    "Add one worked example in the course documents.",
                    "Start next class with a 10-minute misconception check.",
                ],
            )
        )

    low_coverage_courses = [
        course for course in at_risk_courses if course.source_coverage_rate < 60
    ]
    if low_coverage_courses:
        recommendations.append(
            ActionRecommendation(
                priority="medium",
                title="Improve source grounding for AI responses",
                rationale=(
                    f"{len(low_coverage_courses)} course(s) have low source citation coverage, reducing answer reliability."
                ),
                suggested_actions=[
                    "Upload clearer, topic-specific reference documents.",
                    "Split oversized PDFs into smaller topic modules.",
                    "Review extraction quality for scanned/low-quality files.",
                ],
            )
        )

    stale_courses = [
        course for course in at_risk_courses
        if course.days_since_last_activity is not None and course.days_since_last_activity > 14
    ]
    if stale_courses:
        recommendations.append(
            ActionRecommendation(
                priority="low",
                title="Re-engage inactive courses",
                rationale=(
                    f"{len(stale_courses)} course(s) show low recent activity and may need intervention."
                ),
                suggested_actions=[
                    "Post a weekly challenge question in class.",
                    "Assign a short guided chat practice task.",
                    "Open office-hour sessions for difficult topics.",
                ],
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
        at_risk_courses=at_risk_courses[:5],
        recommendations=recommendations,
    )
