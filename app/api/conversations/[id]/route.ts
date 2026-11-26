import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,provider,model,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Could not load conversation messages", { code: error.code });
    return NextResponse.json({ error: "Could not load conversation messages." }, { status: 500 });
  }
  return NextResponse.json({ messages: data ?? [] });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 120);
  if (typeof body.pinned === "boolean") update.pinned = body.pinned;
  if (typeof body.model === "string") update.model = body.model;
  const { data, error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,title,pinned,model,project_id,updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete conversation." }, { status: 500 });
  return NextResponse.json({ success: true });
}
