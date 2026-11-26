import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    typeof body.conversationId !== "string" ||
    typeof body.content !== "string" ||
    !body.content.trim()
  ) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  if (body.role !== "user" && body.role !== "assistant") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", body.conversationId)
    .eq("user_id", user.id)
    .single();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: body.conversationId,
      role: body.role,
      content: body.content,
      provider: typeof body.provider === "string" ? body.provider : "OpenRouter",
      model: typeof body.model === "string" ? body.model : null,
    })
    .select("id,role,content,provider,model,created_at")
    .single();
  if (error) {
    console.error("Could not save chat message", { code: error.code });
    return NextResponse.json({ error: "Could not save message." }, { status: 500 });
  }
  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", body.conversationId as string);
  if (conversationUpdateError) {
    console.error("Message saved but conversation timestamp update failed", {
      code: conversationUpdateError.code,
    });
  }
  return NextResponse.json({ message: data }, { status: 201 });
}
