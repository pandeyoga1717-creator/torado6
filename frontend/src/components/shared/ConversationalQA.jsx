/** Conversational Q&A button + dialog. Posts question to /api/executive/qa. */
import { useState } from "react";
import { Sparkles, Send, MessageCircle, ExternalLink, X } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  "Bagaimana penjualan minggu ini dibanding minggu lalu?",
  "Outlet mana yang performanya terbaik bulan ini?",
  "Apakah ada anomali sales yang perlu saya periksa?",
  "Berapa total AP exposure saat ini?",
];

export default function ConversationalQA() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]); // [{q, a, sources}]
  const [loading, setLoading] = useState(false);

  async function ask(q = question) {
    const text = (q || "").trim();
    if (!text) return;
    setLoading(true);
    setHistory(h => [...h, { q: text, a: null, sources: [] }]);
    setQuestion("");
    try {
      const res = await api.post("/executive/qa", { question: text });
      const d = unwrap(res) || {};
      setHistory(h => {
        const next = [...h];
        next[next.length - 1] = { q: text, a: d.answer, sources: d.sources || [] };
        return next;
      });
    } catch (e) {
      setHistory(h => {
        const next = [...h];
        next[next.length - 1] = { q: text, a: "Maaf, layanan AI sedang tidak tersedia. Coba lagi sebentar.", sources: [] };
        return next;
      });
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="rounded-full gap-2 grad-aurora text-white border-none hover:opacity-90" data-testid="qa-open">
        <Sparkles className="h-4 w-4" /> Tanya AI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Conversational Q&amp;A
            </DialogTitle>
            <DialogDescription>
              Tanya tentang sales, jurnal, atau insights. Jawaban berbasis data realtime.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 px-1 -mx-1 py-2" data-testid="qa-history">
            {history.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Coba pertanyaan ini:</p>
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => ask(s)} className="w-full text-left text-sm glass-input rounded-xl px-3 py-2.5 hover:bg-foreground/5 transition-colors" data-testid={`qa-suggest-${i}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {history.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className="glass-input rounded-2xl rounded-tr-md px-3 py-2 ml-12 text-sm bg-foreground/5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Anda</div>
                  {m.q}
                </div>
                <div className="rounded-2xl rounded-tl-md px-3 py-2 mr-12 text-sm grad-aurora-soft">
                  <div className="text-[10px] uppercase tracking-wider text-foreground/60 mb-0.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> AI
                  </div>
                  {m.a == null ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="animate-pulse">Berpikir…</span>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-line">{m.a}</div>
                      {m.sources?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-foreground/10 flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <Link key={idx} to={s.link || "#"} className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 hover:bg-foreground/20">
                              {s.label} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <Input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !loading) ask(); }}
              placeholder="Tulis pertanyaan…"
              disabled={loading}
              className="glass-input flex-1"
              data-testid="qa-input"
            />
            <Button onClick={() => ask()} disabled={loading || !question.trim()} className="rounded-full pill-active gap-1" data-testid="qa-send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
