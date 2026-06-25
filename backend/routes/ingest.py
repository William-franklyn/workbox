import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client

from services.embedder import embed_many
from services.chunker import chunk_text
from utils.doc_reader import read_document

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


class IngestRequest(BaseModel):
    document_id: str
    organization_id: str
    storage_path: str
    file_type: str


@router.post("/api/v1/ingest")
async def ingest_document(body: IngestRequest):
    sb = get_supabase()

    # 1. Update status to processing
    sb.table("documents").update({"status": "processing"}).eq("id", body.document_id).execute()

    try:
        # 2. Download file from Supabase Storage to a temp path
        import tempfile, pathlib
        suffix = f".{body.file_type}"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        file_bytes = sb.storage.from_("documents").download(body.storage_path)
        pathlib.Path(tmp_path).write_bytes(file_bytes)

        # 3. Extract text
        text = read_document(tmp_path)
        pathlib.Path(tmp_path).unlink(missing_ok=True)

        if not text.strip():
            raise ValueError("Document appears to be empty or unreadable.")

        # 4. Chunk
        chunks = chunk_text(text)

        # 5. Embed all chunks (batched for speed)
        embeddings = embed_many([c for c in chunks])

        # 6. Insert into document_chunks
        rows = [
            {
                "document_id": body.document_id,
                "organization_id": body.organization_id,
                "chunk_index": i,
                "content": chunk,
                "embedding": embedding,
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        sb.table("document_chunks").insert(rows).execute()

        # 7. Mark ready
        sb.table("documents").update({
            "status": "ready",
            "chunk_count": len(chunks),
        }).eq("id", body.document_id).execute()

        return {"status": "ready", "chunk_count": len(chunks)}

    except Exception as e:
        sb.table("documents").update({"status": "error"}).eq("id", body.document_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
