import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,pinned,model,project_id,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Could not load conversations", { code: error.code });
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }
  return NextResponse.json({ conversations: data ?? [] });
}

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
  const body = await request.json();
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Yangi suhbat";
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title, model: body.model ?? "openai/gpt-4o-mini" })
    .select("id,title,pinned,model,project_id,updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not create conversation." }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
