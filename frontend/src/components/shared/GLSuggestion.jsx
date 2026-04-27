/** GL Account suggestion box. Calls /api/ai/categorize with description. */
import { useState, useEffect } from "react";
import { Sparkles, Check, X } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function GLSuggestion({ description, amount, outletId, onAccept, onLearn }) {
  const [sug, setSug] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!description || description.trim().length < 5) { setSug(null); return; }
    setDismissed(false);
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.post("/ai/categorize", {
          description, amount, outlet_id: outletId,
        });
        const s = unwrap(res);
        setSug(s && s.gl_id ? s : null);
      } finally { setLoading(false); }
    }, 800);
    return () => clearTimeout(t);
  }, [description, amount, outletId]);

  return (
    <AnimatePresence>
      {sug && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="glass-card border-aurora-1/30 p-3 grad-aurora-soft"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-aurora-1 mt-0.5" style={{ color: "hsl(var(--aurora-1))" }} />
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                AI Suggestion ({Math.round((sug.confidence || 0) * 100)}% yakin · {sug.source || "rule"})
              </div>
              <div className="text-sm font-medium">
                {sug.gl_code} — {sug.gl_name}
              </div>
              {sug.reason && (
                <div className="text-xs text-muted-foreground mt-1 italic">{sug.reason}</div>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { onAccept?.(sug); onLearn?.(sug); }}
                className="h-7 w-7 rounded-lg pill-active flex items-center justify-center"
                title="Pakai saran"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="h-7 w-7 rounded-lg hover:bg-foreground/5 flex items-center justify-center text-muted-foreground"
                title="Tutup"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
