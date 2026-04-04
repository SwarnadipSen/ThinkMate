from io import BytesIO
from typing import Dict, List, Set

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import get_current_user
from app.database import get_database
from app.llm import generate_gemini_json
from app.models import (
    DescriptiveGenerationResponse,
    DescriptiveQuestion,
    ExamExportRequest,
    ExamGenerationRequest,
    ImprovementPlan,
    MCQEvaluationRequest,
    MCQEvaluationWithPlanResponse,
    MCQGenerationResponse,
    MCQQuestion,
)
from app.vector_store import vector_store

router = APIRouter(prefix="/exam", tags=["Exam"])

MAX_CONTEXT_CHARS = 14000


def _normalize_text(value: str) -> str:
    return " ".join((value or "").strip().split())


def _dedupe_mcqs(questions: List[MCQQuestion]) -> List[MCQQuestion]:
    seen: Set[str] = set()
    deduped: List[MCQQuestion] = []
    for q in questions:
        key = _normalize_text(q.question).lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(q)
    return deduped


def _dedupe_descriptive(questions: List[DescriptiveQuestion]) -> List[DescriptiveQuestion]:
    seen: Set[str] = set()
    deduped: List[DescriptiveQuestion] = []
    for q in questions:
        key = _normalize_text(q.question).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        marks = 10 if q.marks >= 10 else 5
        expected_points = [p.strip() for p in q.expected_points if p and p.strip()]
        deduped.append(
            DescriptiveQuestion(
                question=q.question.strip(),
                marks=marks,
                expected_points=expected_points,
            )
        )
    return deduped


async def _validate_course_access(course_id: str, current_user: Dict):
    db = await get_database()
    course = await db.courses.find_one({"course_id": course_id})
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    # Teachers can only use their own courses; students can use available courses.
    if current_user.get("role") == "teacher" and course.get("teacher_id") != str(current_user.get("_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this course")

    return db, course


async def _build_generation_context(
    course_id: str,
    selected_pdfs: List[str],
    topic: str,
    top_k_per_document: int,
) -> str:
    if not selected_pdfs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select at least one PDF/document",
        )

    context_blocks: List[str] = []

    for filename in selected_pdfs:
        chunks: List[str] = []

        if topic and topic.strip():
            try:
                search_results = vector_store.search(
                    course_id=course_id,
                    query=topic,
                    n_results=top_k_per_document,
                    where={"filename": filename},
                )
                docs = (search_results or {}).get("documents", [])
                if docs and docs[0]:
                    chunks.extend([doc for doc in docs[0] if doc and doc.strip()])
            except Exception:
                # Fall back to direct chunk fetch below.
                chunks = []

        if not chunks:
            raw_chunks = vector_store.get_chunks_by_filename(
                course_id=course_id,
                filename=filename,
                limit=top_k_per_document,
            )
            chunks.extend([item["content"] for item in raw_chunks if item.get("content")])

        if chunks:
            joined = "\n\n".join(chunks)
            context_blocks.append(f"[Document: {filename}]\n{joined}")

    context = "\n\n".join(context_blocks).strip()
    if not context:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No sufficient content found for question generation",
        )

    if len(context) > MAX_CONTEXT_CHARS:
        context = context[:MAX_CONTEXT_CHARS]

    return context


def _mcq_prompt(context: str, num_questions: int, difficulty: str, topic: str) -> str:
    topic_line = f"Focus more on topic: {topic}\n" if topic else ""
    return f"""You are an exam question generator.

Your task is to create multiple-choice questions (MCQs) strictly based on the provided study material.

Rules:
1. ONLY use the given context. Do NOT add external knowledge.
2. Each question must test understanding, not just memorization.
3. Avoid ambiguous or trivial questions.
4. Ensure only ONE correct answer per question.
5. Distractors (wrong options) must be realistic.
6. Maintain {difficulty} difficulty.
7. Ensure all questions are unique.

{topic_line}---------------------
Context:
{context}
---------------------

Generate {num_questions} MCQs.

Return output STRICTLY in JSON format:

{{
  "questions": [
    {{
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "exact option text",
      "explanation": "brief explanation based on context"
    }}
  ]
}}

Do NOT include anything outside JSON."""


def _descriptive_prompt(context: str, num_questions: int, difficulty: str, topic: str) -> str:
    topic_line = f"Focus more on topic: {topic}\n" if topic else ""
    return f"""You are an academic exam paper setter.

Generate descriptive questions (5-10 marks) based ONLY on the provided study material.

Rules:
1. Questions must require explanation, reasoning, or analysis.
2. Do NOT generate questions outside the context.
3. Avoid repetition.
4. Questions should reflect real exam standards.
5. Mix conceptual, analytical, and application-based questions.
6. Maintain {difficulty} difficulty.
7. Ensure all questions are unique.

{topic_line}---------------------
Context:
{context}
---------------------

Generate {num_questions} descriptive questions.

Return output in JSON format:

{{
  "questions": [
    {{
      "question": "string",
      "marks": 5,
      "expected_points": [
        "key point 1",
        "key point 2",
        "key point 3"
      ]
    }}
  ]
}}

Use only marks value 5 or 10.
Do NOT include anything outside JSON."""


def _improvement_plan_prompt(
        score: int,
        total: int,
        incorrect_items: List[Dict[str, str]],
) -> str:
        incorrect_json = str(incorrect_items)
        return f"""You are a study coach.

Create a concise, practical improvement plan for a student after an MCQ quiz.

Rules:
1. Use only the provided quiz performance details.
2. Do not invent external topics.
3. Keep items actionable and specific.
4. Keep output concise.

Performance:
- Score: {score}/{total}
- Incorrect items: {incorrect_json}

Return output STRICTLY in JSON format:

{{
    "focus_areas": ["string", "string"],
    "study_actions": ["string", "string", "string"],
    "next_quiz_goal": "string"
}}

Do NOT include anything outside JSON."""


@router.post("/mcq/generate", response_model=MCQGenerationResponse)
async def generate_mcq_exam(
    request: ExamGenerationRequest,
    current_user: Dict = Depends(get_current_user),
):
    db, _ = await _validate_course_access(request.course_id, current_user)

    documents = await db.documents.count_documents(
        {
            "course_id": request.course_id,
            "filename": {"$in": request.selected_pdfs},
        }
    )
    if documents == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected PDFs/documents were not found in this course",
        )

    context = await _build_generation_context(
        course_id=request.course_id,
        selected_pdfs=request.selected_pdfs,
        topic=request.topic or "",
        top_k_per_document=request.top_k_per_document,
    )

    prompt = _mcq_prompt(
        context=context,
        num_questions=request.num_questions,
        difficulty=request.difficulty,
        topic=request.topic or "",
    )

    try:
        generated = generate_gemini_json(prompt)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Generation failed: {exc}")

    raw_questions = generated.get("questions", [])
    questions = [MCQQuestion(**item) for item in raw_questions]
    questions = _dedupe_mcqs(questions)[: request.num_questions]

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No sufficient content found for question generation",
        )

    return MCQGenerationResponse(questions=questions)


@router.post("/mcq/evaluate", response_model=MCQEvaluationWithPlanResponse)
async def evaluate_mcq_answers(request: MCQEvaluationRequest):
    answer_map = {item.question_index: _normalize_text(item.selected_answer) for item in request.answers}

    score = 0
    incorrect_items: List[Dict[str, str]] = []
    for idx, question in enumerate(request.questions):
        selected = answer_map.get(idx, "")
        correct = _normalize_text(question.correct_answer)
        if selected and selected.lower() == correct.lower():
            score += 1
        else:
            incorrect_items.append(
                {
                    "question": question.question,
                    "selected_answer": selected or "(unanswered)",
                    "correct_answer": question.correct_answer,
                    "explanation": question.explanation,
                }
            )

    total = len(request.questions)
    pct = (score / total) * 100 if total else 0

    if pct >= 85:
        feedback = "Excellent performance with strong conceptual accuracy."
    elif pct >= 60:
        feedback = "Good effort. Review explanations for missed concepts."
    else:
        feedback = "Needs improvement. Revisit the selected materials and retry."

    fallback_plan = ImprovementPlan(
        focus_areas=["Review incorrectly answered concepts"],
        study_actions=[
            "Re-read the related material for missed questions",
            "Summarize each missed concept in your own words",
            "Retake a short quiz on the same topic",
        ],
        next_quiz_goal="Improve by at least 20% on the next attempt",
    )

    if total == 0:
        return MCQEvaluationWithPlanResponse(
            score=score,
            total=total,
            feedback=feedback,
            improvement_plan=fallback_plan,
        )

    try:
        plan_payload = generate_gemini_json(
            _improvement_plan_prompt(
                score=score,
                total=total,
                incorrect_items=incorrect_items,
            ),
            temperature=0.2,
        )
        plan = ImprovementPlan(**plan_payload)
    except Exception:
        plan = fallback_plan

    return MCQEvaluationWithPlanResponse(
        score=score,
        total=total,
        feedback=feedback,
        improvement_plan=plan,
    )


@router.post("/descriptive/generate", response_model=DescriptiveGenerationResponse)
async def generate_descriptive_exam(
    request: ExamGenerationRequest,
    current_user: Dict = Depends(get_current_user),
):
    db, _ = await _validate_course_access(request.course_id, current_user)

    documents = await db.documents.count_documents(
        {
            "course_id": request.course_id,
            "filename": {"$in": request.selected_pdfs},
        }
    )
    if documents == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected PDFs/documents were not found in this course",
        )

    context = await _build_generation_context(
        course_id=request.course_id,
        selected_pdfs=request.selected_pdfs,
        topic=request.topic or "",
        top_k_per_document=request.top_k_per_document,
    )

    prompt = _descriptive_prompt(
        context=context,
        num_questions=request.num_questions,
        difficulty=request.difficulty,
        topic=request.topic or "",
    )

    try:
        generated = generate_gemini_json(prompt)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Generation failed: {exc}")

    raw_questions = generated.get("questions", [])
    questions = [DescriptiveQuestion(**item) for item in raw_questions]
    questions = _dedupe_descriptive(questions)[: request.num_questions]

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No sufficient content found for question generation",
        )

    return DescriptiveGenerationResponse(questions=questions)


@router.post("/descriptive/export-pdf")
async def export_descriptive_pdf(request: ExamExportRequest):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF export requires reportlab. Install with: pip install reportlab",
        )

    if not request.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions to export")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    x = 18 * mm
    y = height - 20 * mm

    def ensure_space(lines: int = 1):
        nonlocal y
        if y < (20 * mm) + (lines * 6 * mm):
            pdf.showPage()
            y = height - 20 * mm

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(x, y, request.title.strip() or "Exam Paper")
    y -= 10 * mm

    pdf.setFont("Helvetica", 11)
    for idx, q in enumerate(request.questions, start=1):
        ensure_space(4)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(x, y, f"Q{idx} ({q.marks} marks)")
        y -= 6 * mm

        pdf.setFont("Helvetica", 11)
        question_text = _normalize_text(q.question)
        pdf.drawString(x, y, question_text[:120])
        y -= 6 * mm

        for point in q.expected_points[:6]:
            ensure_space(1)
            pdf.drawString(x + 4 * mm, y, f"- {_normalize_text(point)[:100]}")
            y -= 5 * mm

        y -= 3 * mm

    pdf.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="exam_paper.pdf"'},
    )
