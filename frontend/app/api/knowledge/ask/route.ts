import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireOrg } from "@/lib/auth/guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { EmbeddingsError, embeddingsConfigured } from "@/lib/knowledge/embeddings";
import { searchKnowledge } from "@/lib/knowledge/ingest";
import { ASK_MODEL, ASK_SYSTEM_PROMPT, buildAskContext, retrievalConfidence } from "@/lib/knowledge/ask";

export const maxDuration = 120;

const RETRIEVE_K = 12; // chunks fetched; collapsed to numbered sources for the model

/**
 * Ask the knowledge platform a question. Responds as an SSE stream:
 *   event {type:"sources", sources, confidence}  — permission-filtered retrieval, sent first
 *   event {type:"delta", text}                   — streamed answer tokens
 *   event {type:"done", model, usage}            — terminal
 *   event {type:"error", error}                  — terminal (mid-stream failures)
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { success: rlOk, headers: rlHeaders } = await rateLimit(ctx.userId, "ai");
  if (!rlOk) return rateLimitResponse(rlHeaders);

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  if (!embeddingsConfigured()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set VOYAGE_API_KEY or OPENAI_API_KEY" },
      { status: 503 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let matches;
  try {
    matches = await searchKnowledge(
      { orgId: ctx.orgId, userId: ctx.userId, role: ctx.role },
      question,
      RETRIEVE_K,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Retrieval failed";
    return NextResponse.json({ error: message }, { status: e instanceof EmbeddingsError ? 502 : 500 });
  }

  const encoder = new TextEncoder();
  const sse = (payload: Record<string, unknown>) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  const { sources, context } = buildAskContext(matches);
  const confidence = retrievalConfidence(matches);

  // Nothing retrieved: answer honestly without spending model tokens.
  if (!sources.length) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse({ type: "sources", sources: [], confidence: "low" }));
        controller.enqueue(sse({
          type: "delta",
          text: "I couldn't find anything in your organization's knowledge base related to this question. Try adding relevant documents under Knowledge, or running a sync of your existing docs.",
        }));
        controller.enqueue(sse({ type: "done", model: null, usage: null }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...rlHeaders },
    });
  }

  const anthropic = new Anthropic();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ type: "sources", sources, confidence }));
      try {
        const claudeStream = anthropic.messages.stream({
          model: ASK_MODEL,
          max_tokens: 16000, // shared by adaptive thinking + answer text
          system: ASK_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Sources:\n\n${context}\n\n---\n\nQuestion: ${question}`,
          }],
        });

        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(sse({ type: "delta", text: event.delta.text }));
          }
        }

        const final = await claudeStream.finalMessage();
        controller.enqueue(sse({
          type: "done",
          model: final.model,
          usage: { input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens },
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Answer generation failed";
        controller.enqueue(sse({ type: "error", error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...rlHeaders },
  });
}
