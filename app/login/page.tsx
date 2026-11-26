"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase sozlanmagan. NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY ni kiriting.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.push("/workspace");
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        setNotice("Ro‘yxatdan o‘tish bo‘yicha tasdiqlash xabari yuborildi.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Autentifikatsiyada xatolik.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#090a12] px-5 text-white">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#7968ed] shadow-[0_12px_35px_rgba(121,104,237,.25)]"><Sparkles size={22} fill="currentColor" /></div>
          <h1 className="mt-4 text-2xl font-semibold">NEXORA <span className="text-[#a99cff]">AI</span></h1>
          <p className="mt-2 text-sm text-[#858699]">Shaxsiy AI ishxonangizga kiring</p>
        </div>
        <form onSubmit={submitAuth} className="rounded-2xl border border-white/[0.08] bg-[#11121d] p-5 shadow-[0_24px_80px_rgba(0,0,0,.32)]">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-black/20 p-1">
            <button type="button" onClick={() => setMode("login")} className={`h-9 rounded-md text-sm ${mode === "login" ? "bg-[#252638] text-white" : "text-[#858699]"}`}>Kirish</button>
            <button type="button" onClick={() => setMode("register")} className={`h-9 rounded-md text-sm ${mode === "register" ? "bg-[#252638] text-white" : "text-[#858699]"}`}>Ro‘yxatdan o‘tish</button>
          </div>
          <label className="block text-sm text-[#bbbcca]">Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 outline-none focus:border-[#7564df]" />
          </label>
          <label className="mt-4 block text-sm text-[#bbbcca]">Parol
            <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 outline-none focus:border-[#7564df]" />
          </label>
          {error && <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-sm text-red-200">{error}</p>}
          {notice && <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-sm text-emerald-200">{notice}</p>}
          <button disabled={loading} className="mt-5 h-11 w-full rounded-lg bg-[#7564df] text-sm font-semibold hover:bg-[#8373ed] disabled:opacity-50">
            {loading ? "Kutib turing..." : mode === "login" ? "Kirish" : "Akkaunt yaratish"}
          </button>
        </form>
      </div>
    </main>
  );
}
