import os
import httpx
from typing import Generator

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
PRIMARY_MODEL  = "qwen2.5-72b-instruct"
FALLBACK_MODEL = "llama-3.1-8b-instant"
MAX_RESPONSE_TOKENS = 1024

BASE_SYSTEM_PROMPT = (
    "You are WorkBox, a professional internal company assistant. "
    "Answer employee questions clearly, concisely, and professionally. "
    "Be helpful, direct, and use plain language."
)

def build_prompt(context_chunks: list[str]) -> str:
    if not context_chunks:
        return (
            BASE_SYSTEM_PROMPT +
            " If asked about company-specific information, let the user know "
            "that no documents have been uploaded yet."
        )
    context = "\n\n---\n\n".join(context_chunks)
    return (
        BASE_SYSTEM_PROMPT +
        f"\n\nCONTEXT FROM COMPANY DOCUMENTS:\n{context}\n\n"
        "Answer based on the context above. "
        "If the answer is not in the context, say so clearly and offer general guidance."
    )

def _stream_model(messages: list[dict], model: str, client: httpx.Client):
    import json
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": MAX_RESPONSE_TOKENS,
        "stream": True,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    with client.stream("POST", GROQ_URL, headers=headers, json=payload) as response:
        if response.status_code == 429 or not response.is_success:
            return False, []
        tokens = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    token = chunk["choices"][0]["delta"].get("content", "")
                    if token:
                        tokens.append(token)
                except Exception:
                    continue
        return True, tokens

def stream_chat(messages: list[dict]) -> Generator[str, None, None]:
    with httpx.Client(timeout=30) as client:
        for model in (PRIMARY_MODEL, FALLBACK_MODEL):
            ok, tokens = _stream_model(messages, model, client)
            if ok:
                yield from tokens
                return
        yield "I'm having trouble responding right now — please try again in a moment."
