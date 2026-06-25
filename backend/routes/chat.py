import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client

from services.embedder import embed
from services.groq_client import build_prompt, stream_chat

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


class ChatRequest(BaseModel):
    question: str
    conversation_id: str
    organization_id: str
    history: list[dict] = []  # last N messages [{role, content}]


@router.post("/api/v1/chat")
async def chat(body: ChatRequest):
    sb = get_supabase()

    # 1. Embed the question
    question_embedding = embed(body.question)

    # 2. Vector search for relevant chunks
    result = sb.rpc("search_chunks", {
        "query_embedding": question_embedding,
        "org_id": body.organization_id,
        "match_count": 5,
    }).execute()

    chunks = [row["content"] for row in (result.data or [])]
    source_ids = [row["id"] for row in (result.data or [])]

    # 3. Build messages (system prompt + history + current question)
    system_prompt = build_prompt(chunks)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(body.history[-6:])  # last 6 messages for context
    messages.append({"role": "user", "content": body.question})

    # 4. Save user message to DB
    sb.table("messages").insert({
        "conversation_id": body.conversation_id,
        "role": "user",
        "content": body.question,
        "source_chunks": source_ids,
    }).execute()

    # 5. Stream Groq response, collect full text, then save assistant message
    def generate():
        full_response = []
        try:
            for token in stream_chat(messages):
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        finally:
            assistant_text = "".join(full_response)
            if assistant_text:
                sb.table("messages").insert({
                    "conversation_id": body.conversation_id,
                    "role": "assistant",
                    "content": assistant_text,
                    "source_chunks": source_ids,
                }).execute()
                # Update conversation timestamp
                sb.table("conversations").update({
                    "updated_at": "now()",
                }).eq("id", body.conversation_id).execute()
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
