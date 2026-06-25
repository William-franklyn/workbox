import os
import httpx

HF_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")


def _headers():
    return {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}


def embed(text: str) -> list[float]:
    return embed_many([text])[0]


def embed_many(texts: list[str]) -> list[list[float]]:
    response = httpx.post(
        HF_API_URL,
        headers=_headers(),
        json={"inputs": texts, "options": {"wait_for_model": True}},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()
