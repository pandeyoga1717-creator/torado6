/** AI-powered Item autocomplete. Calls /api/ai/items/suggest. */
import { useState, useEffect, useRef } from "react";
import { Package, Sparkles } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function ItemAutocomplete({
  value, onChange, onSelect, placeholder = "Cari item…", className,
  showLastPrice = true, dataTestId,
}) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    if (!open || query.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/ai/items/suggest", { params: { q: query, limit: 8 } });
        setResults(unwrap(res) || []);
      } finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange?.(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="glass-input"
        data-testid={dataTestId}
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 glass-card max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Mencari…</div>}
          {results.map((it) => (
            <button
              type="button"
              key={it.id}
              onClick={() => { onSelect?.(it); setQuery(it.name); setOpen(false); }}
              className="w-full px-3 py-2 hover:bg-foreground/5 text-left flex items-center gap-2.5"
            >
              <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{it.code}</span>
                  <span>·</span>
                  <span>{it.unit}</span>
                  {showLastPrice && it.last_price && (
                    <>
                      <span>·</span>
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>{fmtRp(it.last_price)}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
