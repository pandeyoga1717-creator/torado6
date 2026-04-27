/** Vendor autocomplete (mirrors ItemAutocomplete). */
import { useState, useEffect, useRef } from "react";
import { Building2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function VendorAutocomplete({
  value, onChange, onSelect, placeholder = "Cari vendor…", className, dataTestId,
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
        const res = await api.get("/ai/vendors/suggest", { params: { q: query, limit: 8 } });
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
          {results.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => { onSelect?.(v); setQuery(v.name); setOpen(false); }}
              className="w-full px-3 py-2 hover:bg-foreground/5 text-left flex items-center gap-2.5"
            >
              <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.name}</div>
                <div className="text-xs text-muted-foreground">{v.code} · {v.phone || "—"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
