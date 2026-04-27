import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, Building2, Users, Receipt, Hash, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "items",     icon: Package,   label: "Items",     name: "name",        sub: "code" },
  { key: "vendors",   icon: Receipt,   label: "Vendors",   name: "name",        sub: "code" },
  { key: "employees", icon: Users,     label: "Employees", name: "full_name",   sub: "position" },
  { key: "outlets",   icon: Building2, label: "Outlets",   name: "name",        sub: "code" },
  { key: "brands",    icon: Building2, label: "Brands",    name: "name",        sub: "code" },
  { key: "coa",       icon: Hash,      label: "GL Accounts", name: "name",      sub: "code" },
  { key: "users",     icon: Users,     label: "Users",     name: "full_name",   sub: "email" },
];

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/search", { params: { q: q.trim() } });
        setResults(unwrap(res));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [q, open]);

  const handleClick = useCallback((section, item) => {
    onClose();
    // Navigate to admin/master for now (Phase 2)
    if (section === "items") navigate(`/admin/master/items?id=${item.id}`);
    else if (section === "vendors") navigate(`/admin/master/vendors?id=${item.id}`);
    else if (section === "employees") navigate(`/admin/master/employees?id=${item.id}`);
    else if (section === "outlets") navigate(`/admin/master/outlets?id=${item.id}`);
    else if (section === "brands") navigate(`/admin/master/brands?id=${item.id}`);
    else if (section === "coa") navigate(`/admin/master/chart-of-accounts?id=${item.id}`);
    else if (section === "users") navigate(`/admin/users?id=${item.id}`);
  }, [navigate, onClose]);

  const totalResults = results
    ? SECTIONS.reduce((sum, s) => sum + (results[s.key]?.length || 0), 0)
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/40"
            style={{ backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 top-[10vh] mx-auto z-50 max-w-2xl px-4"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="glass-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari item, vendor, employee, outlet, GL account…"
                  className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
                  data-testid="global-search-input"
                />
                <kbd className="text-xs text-muted-foreground px-2 py-1 rounded bg-foreground/5">Esc</kbd>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {q.trim().length < 2 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Ketik minimal 2 karakter untuk mulai mencari.
                  </div>
                )}
                {loading && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Searching…
                  </div>
                )}
                {!loading && results && totalResults === 0 && q.trim().length >= 2 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Tidak ada hasil untuk "{q}"
                  </div>
                )}
                {!loading && results && SECTIONS.map((sec) => {
                  const items = results[sec.key] || [];
                  if (items.length === 0) return null;
                  const Icon = sec.icon;
                  return (
                    <div key={sec.key} className="py-2">
                      <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {sec.label}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleClick(sec.key, item)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2.5 hover:bg-foreground/5 transition-colors text-left",
                          )}
                        >
                          <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item[sec.name] || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{item[sec.sub] || "—"}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
