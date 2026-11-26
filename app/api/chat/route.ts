import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { MODEL_REGISTRY } from "@/lib/ai/models";
import { buildModelContext, type ContextMessage } from "@/lib/ai/context";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Add the required environment variables." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const content = typeof body.message === "string" ? body.message.trim() : "";
  const modelId = typeof body.model === "string" ? body.model : "";
  if (!content) return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });

  const model = MODEL_REGISTRY.find((item) => item.id === modelId);
  if (!model?.available || !model.streaming) {
    return NextResponse.json({ error: "This model is unavailable for streaming." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter is not configured. Set OPENROUTER_API_KEY on the server." },
      { status: 503 },
    );
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  let history: ContextMessage[] = [];

  if (conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();
    if (conversationError || !conversation) {
      if (conversationError && conversationError.code !== "PGRST116") {
        console.error("Could not verify chat conversation", { code: conversationError.code });
        return NextResponse.json({ error: "Could not load this conversation." }, { status: 500 });
      }
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id,role,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (messagesError) {
      console.error("Could not load chat history", { code: messagesError.code });
      return NextResponse.json({ error: "Could not load conversation history." }, { status: 500 });
    }
    history = (messages ?? [])
      .filter(
        (message) =>
          message.id !== body.messageId &&
          (message.role === "user" || message.role === "assistant"),
      )
      .reverse()
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
  }

  const { data: memories, error: memoriesError } = await supabase
    .from("memories")
    .select("content")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .limit(20);
  if (memoriesError) {
    console.error("Could not load user memory", { code: memoriesError.code });
    return NextResponse.json({ error: "Could not load your saved memory." }, { status: 500 });
  }
  const memoryContext = memories?.map((memory) => memory.content).join("\n");

  const modelMessages = buildModelContext(
    [...history, { role: "user", content }],
    memoryContext ? `Relevant user memory:\n${memoryContext}` : undefined,
  );

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "NEXORA AI",
      },
      body: JSON.stringify({ model: model.id, messages: modelMessages, stream: true }),
      signal: request.signal,
    });
  } catch (cause) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error("OpenRouter connection failed", cause);
    return NextResponse.json({ error: "Could not connect to the AI provider. Check your network and retry." }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    const status = upstream.status === 429 ? 429 : 502;
    console.error("OpenRouter request failed", { status: upstream.status, detail: detail.slice(0, 500) });
    return NextResponse.json(
      { error: upstream.status === 429 ? "Provider rate limit reached. Please retry shortly." : "The AI provider could not process this request." },
      { status },
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "The provider returned an empty response." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
