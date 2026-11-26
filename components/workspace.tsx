"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Bot,
  ChevronDown,
  Copy,
  Folder,
  Menu,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  User,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MODEL_REGISTRY, type AIModel } from "@/lib/ai/models";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  model: string | null;
  updated_at: string;
};
type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  created_at?: string;
};

export default function Workspace() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODEL_REGISTRY[0].id);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const response = await fetch("/api/conversations");
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Suhbatlarni yuklab bo‘lmadi.");
    }
    const payload = await response.json();
    setConversations(payload.conversations ?? []);
  }

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/conversations");
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Suhbatlarni yuklab bo‘lmadi.");
        }
        setConversations(payload?.conversations ?? []);
      } catch (cause) {
        console.error("Could not load conversations", cause);
        setError(cause instanceof Error ? cause.message : "Suhbatlarni yuklab bo‘lmadi.");
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setError("");
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Suhbatni yuklab bo‘lmadi.");
      return;
    }
    const payload = await response.json();
    setMessages(payload.messages ?? []);
  }

  async function newConversation() {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Yangi suhbat", model }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Yangi suhbat yaratib bo‘lmadi.");
      return;
    }
    const payload = await response.json();
    await loadConversations();
    setActiveId(payload.conversation.id);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Bu suhbat o‘chirilsinmi?")) return;
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Suhbatni o‘chirib bo‘lmadi.");
      return;
    }
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    await loadConversations();
  }

  async function saveMessage(conversationId: string, role: "user" | "assistant", content: string, selectedModel = model) {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        role,
        content,
        provider: "OpenRouter",
        model: selectedModel,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error ?? "Xabarni saqlab bo‘lmadi.");
    }
    return payload.message as ChatMessage & { id: string };
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading || sendingRef.current) return;
    sendingRef.current = true;
    setError("");
    const selectedModel = model;
    const optimisticId = `pending-${Date.now()}`;
    setInput("");
    setMessages((current) => [...current, { id: optimisticId, role: "user", content }]);
    setLoading(true);

    let conversationId = activeId;
    let assistantText = "";
    let assistantStarted = false;
    const assistantMessageId = `assistant-${optimisticId}`;
    try {
      if (!conversationId) {
        const createResponse = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: content.slice(0, 60), model: selectedModel }),
        });
        const createPayload = await createResponse.json().catch(() => null);
        if (!createResponse.ok) {
          throw new Error(createPayload?.error ?? "Suhbatni yaratib bo‘lmadi.");
        }
        conversationId = createPayload.conversation.id;
        setActiveId(conversationId);
        setConversations((current) => [createPayload.conversation, ...current]);
      }

      if (!conversationId) throw new Error("Suhbat identifikatori mavjud emas.");
      const persistedConversationId = conversationId;
      const savedUserMessage = await saveMessage(persistedConversationId, "user", content, selectedModel);
      setMessages((current) =>
        current.map((message) => message.id === optimisticId ? savedUserMessage : message),
      );

      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          messageId: savedUserMessage.id,
          model: selectedModel,
          conversationId: persistedConversationId,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "AI providerga ulanishda xatolik.");
      }
      if (!response.body) throw new Error("Provider bo‘sh javob qaytardi.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") return;
        let parsed: {
          choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
          error?: { message?: string };
        };
        try {
          parsed = JSON.parse(data);
        } catch (cause) {
          console.error("Could not parse OpenRouter stream event", cause);
          throw new Error("AI javob oqimini o‘qib bo‘lmadi.");
        }
        if (parsed.error?.message) throw new Error(parsed.error.message);
        const delta = parsed.choices?.[0]?.delta?.content;
        const text = typeof delta === "string"
          ? delta
          : Array.isArray(delta)
            ? delta.map((part) => part.text ?? "").join("")
            : "";
        if (text) {
          assistantText += text;
          if (!assistantStarted) {
            assistantStarted = true;
            setMessages((current) => [...current, { id: assistantMessageId, role: "assistant", content: text, model: selectedModel }]);
          } else {
            setMessages((current) => {
              const next = [...current];
              const assistantIndex = next.findIndex((message) => message.id === assistantMessageId);
              if (assistantIndex !== -1) {
                next[assistantIndex] = { id: assistantMessageId, role: "assistant", content: assistantText, model: selectedModel };
              }
              return next;
            });
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) handleEvent(event);
        if (done) {
          if (buffer.trim()) handleEvent(buffer);
          break;
        }
      }
      if (!assistantText) throw new Error("AI model bo‘sh javob qaytardi.");
      const savedAssistantMessage = await saveMessage(persistedConversationId, "assistant", assistantText, selectedModel);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? savedAssistantMessage
            : message,
        ),
      );
      await loadConversations();
    } catch (caught) {
      console.error("Message send failed", caught);
      const aborted = caught instanceof DOMException && caught.name === "AbortError";
      if (aborted) {
        setMessages((current) => current.filter((message) => message.content || message.role !== "assistant"));
      } else {
        setError(caught instanceof Error ? caught.message : "Noma’lum xatolik yuz berdi.");
        if (!assistantText) {
          setMessages((current) => current.filter((message) => message.id !== optimisticId));
          setInput((current) => current || content);
        }
      }
    } finally {
      sendingRef.current = false;
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/login");
  }

  const selectedModel = MODEL_REGISTRY.find((item) => item.id === model) ?? MODEL_REGISTRY[0];
  const filtered = conversations.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="flex h-dvh overflow-hidden bg-[#090a12] text-[#f4f3fb]">
      {sidebarOpen && (
        <button className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Yopish" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/[0.07] bg-[#0d0e19] transition-transform md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl bg-[#7968ed] shadow-[0_8px_24px_rgba(121,104,237,.24)]">
              <Sparkles size={17} fill="currentColor" />
            </div>
            <span className="font-semibold tracking-tight">NEXORA <span className="text-[#a99cff]">AI</span></span>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="px-3">
          <button onClick={newConversation} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7564df] text-sm font-semibold shadow-[0_10px_30px_rgba(117,100,223,.18)] hover:bg-[#8373ed]">
            <SquarePen size={16} /> Yangi suhbat
          </button>
          <div className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3">
            <Search size={15} className="text-[#77788a]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Suhbatlarni izlash" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#666779]" />
          </div>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-3">
          <SidebarLink icon={<Bot size={16} />} label="AI modellari" />
          <SidebarLink icon={<Folder size={16} />} label="Loyihalar" />
          <SidebarLink icon={<Archive size={16} />} label="Xotira" />
          <SidebarLink icon={<Sparkles size={16} />} label="AI larni solishtirish" />

          <p className="mb-2 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#686979]">Oxirgi suhbatlar</p>
          <div className="space-y-1">
            {filtered.map((conversation) => (
              <div key={conversation.id} className={`group flex h-10 items-center rounded-lg px-3 text-sm ${activeId === conversation.id ? "bg-white/[0.07] text-white" : "text-[#aaaabd] hover:bg-white/[0.04] hover:text-white"}`}>
                <button onClick={() => openConversation(conversation.id)} className="min-w-0 flex-1 truncate text-left">
                  {conversation.title}
                </button>
                <button onClick={() => deleteConversation(conversation.id)} className="ml-2 opacity-0 group-hover:opacity-100" aria-label="Suhbatni o'chirish"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <SidebarLink icon={<Settings size={16} />} label="Sozlamalar" />
          <button onClick={logout} className="mt-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#aaaabd] hover:bg-white/[0.04] hover:text-white">
            <div className="grid size-7 place-items-center rounded-full bg-[#292a3a]"><User size={14} /></div>
            <span>Akkauntdan chiqish</span>
            <MoreHorizontal size={16} className="ml-auto" />
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-white/[0.07] px-4 lg:px-6">
          <button className="mr-3 md:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{activeId ? conversations.find((item) => item.id === activeId)?.title ?? "Suhbat" : "Yangi suhbat"}</h1>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ModelSelector model={model} onChange={setModel} />
            <button onClick={() => setContextOpen((current) => !current)} className="grid size-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#9c9dab] hover:text-white">
              <PanelRightClose size={17} />
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-5 text-center">
                  <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-[#141522] text-[#9b8df5] shadow-[0_20px_60px_rgba(0,0,0,.28)]">
                    <Sparkles size={24} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">Nimada yordam bera olaman?</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#858699]">Kod yozish, loyiha rejalashtirish, xulosalar yoki istalgan savol bo‘yicha suhbat boshlang.</p>
                  <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {["Bugungi vazifamni rejalashtir", "React komponentini tushuntir", "Maqola uchun reja tuz", "Koddagi xatoni top"].map((prompt) => (
                      <button key={prompt} onClick={() => setInput(prompt)} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left text-sm text-[#c6c6d2] hover:border-[#7564df]/50 hover:bg-[#7564df]/[0.06]">{prompt}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                  {messages.map((message, index) => (
                    <div key={message.id ?? index} className={`mb-7 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" && (
                        <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#7564df]"><Sparkles size={15} /></div>
                      )}
                      <div className={`min-w-0 ${message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-[#242538] px-4 py-3" : "max-w-[calc(100%-44px)] flex-1"}`}>
                        {message.role === "assistant" ? (
                          <div className="markdown text-[15px] leading-7 text-[#dedee8]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-[15px]">{message.content}</p>
                        )}
                        {message.role === "assistant" && message.content && (
                          <button onClick={() => navigator.clipboard.writeText(message.content)} className="mt-3 flex items-center gap-1.5 text-xs text-[#77798b] hover:text-[#b9bacc]"><Copy size={13} /> Nusxalash</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-[#7f8092]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#7564df]" /> Javob yozilmoqda...</div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {error && (
              <div className="mx-auto mb-2 w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-sm text-red-200">{error}</div>
            )}

            <div className="shrink-0 px-4 pb-4 sm:px-6">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-[#12131e] p-2 shadow-[0_12px_40px_rgba(0,0,0,.22)] focus-within:border-[#7564df]/50">
                  <button className="grid size-9 shrink-0 place-items-center rounded-xl text-[#858799] hover:bg-white/[0.05] hover:text-white" aria-label="Fayl biriktirish"><Plus size={18} /></button>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Nexora AI ga xabar yuboring..."
                    className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-[#666879]"
                  />
                  {loading ? (
                    <button onClick={() => abortRef.current?.abort()} className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#363747] text-white" aria-label="To‘xtatish"><X size={16} /></button>
                  ) : (
                    <button onClick={sendMessage} disabled={!input.trim() || loading} aria-label="Yuborish" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#7564df] text-white disabled:cursor-not-allowed disabled:opacity-35"><Sparkles size={16} /></button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] text-[#5f6070]">NEXORA xatoga yo‘l qo‘yishi mumkin. Muhim ma’lumotni tekshiring.</p>
              </div>
            </div>
          </div>

          {contextOpen && (
            <aside className="hidden w-[260px] shrink-0 border-l border-white/[0.07] bg-[#0c0d16] px-4 py-5 xl:block">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77798a]">Kontekst</h3>
                <button onClick={() => setContextOpen(false)} className="text-[#77798a]"><X size={14} /></button>
              </div>
              <div className="mt-4 space-y-3">
                <ContextCard title="Faol model" value={selectedModel.name} />
                <ContextCard title="Loyiha" value="Shaxsiy workspace" />
                <ContextCard title="Xotira" value="Avtomatik xotira faol" />
              </div>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}

function SidebarLink({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#aaaabd] hover:bg-white/[0.04] hover:text-white">
      {icon}<span>{label}</span>
    </button>
  );
}

function ContextCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="text-[11px] text-[#737486]">{title}</p>
      <p className="mt-1 truncate text-sm text-[#cfd0dc]">{value}</p>
    </div>
  );
}

function ModelSelector({ model, onChange }: { model: string; onChange: (value: string) => void }) {
  const selected = MODEL_REGISTRY.find((item) => item.id === model) ?? MODEL_REGISTRY[0];
  return (
    <label className="relative flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm">
      <Bot size={14} className="mr-2 text-[#9991dd]" />
      <select value={model} onChange={(event) => onChange(event.target.value)} className="max-w-36 appearance-none bg-transparent pr-5 outline-none">
        {MODEL_REGISTRY.map((item: AIModel) => (
          <option key={item.id} value={item.id} className="bg-[#151620]">{item.name}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 text-[#77798a]" />
      <span className="sr-only">{selected.provider}</span>
    </label>
  );
}
