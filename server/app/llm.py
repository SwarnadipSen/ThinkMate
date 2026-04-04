from groq import Groq
from app.config import settings
from typing import Dict, Iterator, List
import json
import urllib.error
import urllib.parse
import urllib.request

client = Groq(api_key=settings.GROQ_API_KEY)

SOCRATIC_SYSTEM_PROMPT = """You are a Socratic AI tutor. Your role is to guide students to discover answers themselves through thoughtful questioning and dialogue, rather than providing direct answers.

Guidelines:
1. Ask probing questions that help students think critically
2. Build on their responses to deepen understanding
3. Reference the provided course materials when relevant
4. Encourage students to explain their reasoning
5. When students are stuck, provide gentle hints through questions
6. Acknowledge correct insights and guide them to explore further
7. Keep responses concise and focused (around 100-150 words)
8. Be encouraging and supportive

When using context from course materials:
- Reference specific concepts from the materials
- Ask students to connect ideas from the readings
- Help them discover relationships between concepts

Remember: Your goal is to facilitate learning, not to lecture. Guide through questions."""


def build_context_from_sources(sources: List[Dict]) -> str:
    """Build context string from retrieved sources"""
    if not sources:
        return "No specific course materials found for this topic."
    
    context_parts = []
    for i, source in enumerate(sources, 1):
        content = source.get('content', '')
        metadata = source.get('metadata', {})
        context_parts.append(f"[Source {i}]: {content}")
    
    return "\n\n".join(context_parts)


def build_chat_messages(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    sources: List[Dict],
    course_name: str = ""
) -> List[Dict[str, str]]:
    """Build a Groq-compatible message list with system prompt, context, history and user prompt."""
    context = build_context_from_sources(sources)

    messages = [
        {"role": "system", "content": SOCRATIC_SYSTEM_PROMPT}
    ]

    if course_name or context:
        context_message = f"Course: {course_name}\n\nRelevant Course Materials:\n{context}"
        messages.append({"role": "system", "content": context_message})

    recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
    for msg in recent_history:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    messages.append({"role": "user", "content": user_message})
    return messages


def generate_socratic_response(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    sources: List[Dict],
    course_name: str = ""
) -> str:
    """Generate Socratic response using Groq LLM"""
    messages = build_chat_messages(user_message, conversation_history, sources, course_name)
    
    # Call Groq API
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
            top_p=1,
            stream=False
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        raise Exception(f"Error generating response from Groq: {str(e)}")


def generate_socratic_response_stream(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    sources: List[Dict],
    course_name: str = ""
) -> Iterator[str]:
    """Stream Socratic response token chunks from Groq."""
    messages = build_chat_messages(user_message, conversation_history, sources, course_name)

    try:
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
            top_p=1,
            stream=True
        )

        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta

    except Exception as e:
        raise Exception(f"Error streaming response from Groq: {str(e)}")


def _extract_json_object(text: str) -> Dict:
    """Extract a JSON object from model output, including fenced responses."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model did not return a valid JSON object")

    extracted = cleaned[start : end + 1]
    parsed = json.loads(extracted)
    if not isinstance(parsed, dict):
        raise ValueError("Model JSON output is not an object")
    return parsed


def generate_gemini_json(prompt: str, temperature: float = 0.3) -> Dict:
    """Generate structured JSON output from Gemini using strict JSON response mode."""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    # Accept both "gemini-..." and "models/gemini-..." formats from env.
    model = settings.GEMINI_MODEL.replace("models/", "", 1)
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model)}:generateContent?key={urllib.parse.quote(settings.GEMINI_API_KEY)}"
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }

    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore") if exc.fp else str(exc)
        raise RuntimeError(f"Gemini API HTTP error: {exc.code} {error_body}")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Gemini API connection error: {exc}")

    parsed = json.loads(raw)
    candidates = parsed.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError("Gemini returned empty content")

    text = parts[0].get("text", "")
    if not text:
        raise RuntimeError("Gemini returned no text output")

    return _extract_json_object(text)
