from groq import Groq
from app.config import settings
from typing import Dict, Iterator, List

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
